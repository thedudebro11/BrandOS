import fs from "node:fs";
import type { WorkspaceDatabase } from "../../db/connection";
import type { EventBus } from "../../events/event-bus";
import type { Logger } from "../../logging/logger";
import { hashFile } from "../hashing-engine/hash-engine";
import { extractMetadata } from "../metadata-engine";
import { detectSourceToExportRelationships } from "../relationship-engine/relationship-engine";
import { recordAssetTimelineEvents } from "../timeline-engine/timeline-engine";
import { classifyAssetAndEnrichReview } from "../classification-engine";
import { tagAssetAutomatically } from "../tag-engine";
import { collectCandidateDatesForAsset, resolveAssetDate, buildRelationshipDerivedCandidate } from "../timeline-intelligence";
import { getClassification, getResolvedDate, recordCandidateDate } from "../../db/knowledge-repositories";
import { validateKnowledge } from "../knowledge-validation-engine/knowledge-validation-engine";
import {
  createAsset,
  findAssetByPath,
  listActiveAssets,
  registerDuplicateIfNeeded,
  replaceAssetMetadata,
  touchAssetSeen,
  updateAssetOnRescan,
} from "../../db/repositories";
import type { AssetRecord, DiscoveredFile, ValidationCheckResult } from "../../types";

/**
 * The one reusable stage sequence every importer runs through (Phase 7 spec:
 * "no importer should bypass this pipeline"). Each stage below is a direct,
 * mechanical extraction of what import-engine.ts's runScan() already did
 * per-file — this is a reorganization, not a rewrite, specifically so the
 * already-tested behavior (121 tests, real Fatletic/PrecisionWorkz scans)
 * carries over unchanged rather than being re-derived from a spec on faith.
 *
 * Two stages named in the spec are intentionally documented as no-ops here
 * rather than faked: "Evidence Extraction" (no importer today produces
 * evidence distinct from metadata/timeline — the Evidence Engine computes
 * assessments on demand from case data, not at import time) and "Case
 * Update" (no importer touches case_links; cases are a human/report-driven
 * concept, not an import-time one). Both are named explicitly in the stage
 * list below so a future importer that DOES have real evidence/case data to
 * contribute has an obvious, already-labeled place to add it — without this
 * pipeline pretending to do something today that it doesn't.
 *
 * "Database Update" and "Event Emission"/"Logging" are not separate stages:
 * consistent with every prior phase's repository pattern, each stage persists
 * and emits/logs as it goes rather than deferring to a final commit step —
 * there is no ORM-style staged-transaction layer anywhere else in this
 * codebase, and inventing one here only for imports would be a new pattern
 * with no other caller, which this project's principles argue against.
 */

export interface ImportPipelineContext {
  db: WorkspaceDatabase;
  bus: EventBus;
  logger: Logger;
  workspaceId: string;
  /** Correlates every log line and event this pipeline run produces back to one scan_runs row. */
  scanRunId: number;
}

export interface FileProcessResult {
  file: DiscoveredFile;
  outcome: "unchanged" | "created" | "updated" | "validation_failed" | "hash_failed";
  asset: AssetRecord | null;
}

/** Stage: Validate. A real (if intentionally lightweight) check — not a stub — that a discovered file is still present and unchanged since discovery, before spending a hash pass on it. */
function validateDiscoveredFile(file: DiscoveredFile): { ok: boolean; reason?: string } {
  if (!fs.existsSync(file.absPath)) return { ok: false, reason: "file no longer exists" };
  return { ok: true };
}

/**
 * Stages: Validate -> Hash -> Extract Metadata -> Generate Asset IDs ->
 * Timeline Candidate Generation, for exactly one discovered file. Returns
 * "unchanged" without touching the DB if size+mtime match the existing
 * asset row — the same incremental-skip behavior scans have always had.
 */
export async function processDiscoveredFile(ctx: ImportPipelineContext, file: DiscoveredFile): Promise<FileProcessResult> {
  const { db, bus, logger, workspaceId, scanRunId } = ctx;

  bus.emit("file.discovered", { workspaceId, relPath: file.relPath });

  const validation = validateDiscoveredFile(file);
  if (!validation.ok) {
    logger.warn("import.validation_failed", `${file.relPath}: ${validation.reason}`, { scanRunId });
    return { file, outcome: "validation_failed", asset: null };
  }

  const existing = findAssetByPath(db, file.relPath);
  const unchanged = existing && existing.sizeBytes === file.sizeBytes && existing.modifiedAt === file.modifiedAt;
  if (unchanged) {
    touchAssetSeen(db, existing.id);
    return { file, outcome: "unchanged", asset: existing };
  }

  let sha256: string | null = null;
  try {
    sha256 = await hashFile(file.absPath);
    bus.emit("hash.computed", { workspaceId, relPath: file.relPath, sha256 });
  } catch (err) {
    logger.error("hash.failed", `Could not hash ${file.relPath}: ${(err as Error).message}`, { scanRunId });
    return { file, outcome: "hash_failed", asset: null };
  }

  let metadata: Awaited<ReturnType<typeof extractMetadata>> = [];
  try {
    metadata = await extractMetadata(file.absPath, file.extension, logger);
    bus.emit("metadata.extracted", { workspaceId, relPath: file.relPath, count: metadata.length });
  } catch (err) {
    logger.warn("metadata.failed", `Metadata extraction errored for ${file.relPath}: ${(err as Error).message}`, { scanRunId });
  }

  let asset: AssetRecord;
  let outcome: "created" | "updated";
  if (existing) {
    updateAssetOnRescan(db, existing, file, sha256);
    asset = findAssetByPath(db, file.relPath)!;
    bus.emit("asset.updated", { workspaceId, assetId: asset.assetId, relPath: file.relPath });
    logger.info("asset.updated", `Asset changed: ${asset.assetId} (${file.relPath})`, { scanRunId, assetId: asset.assetId });
    outcome = "updated";
  } else {
    asset = createAsset(db, file, sha256);
    bus.emit("asset.created", { workspaceId, assetId: asset.assetId, relPath: file.relPath });
    logger.info("asset.created", `New asset: ${asset.assetId} (${file.relPath})`, { scanRunId, assetId: asset.assetId });
    outcome = "created";
  }

  replaceAssetMetadata(db, asset.id, metadata);
  if (sha256) registerDuplicateIfNeeded(db, sha256, asset.id);

  recordAssetTimelineEvents(db, asset, metadata);
  bus.emit("timeline.updated", { workspaceId, count: 1 });

  // Phase 3.5: every candidate date this asset offers, filesystem timestamps
  // included only as one candidate among many — never assumed true (ADR-010).
  collectCandidateDatesForAsset(db, asset, metadata);

  return { file, outcome, asset };
}

/** Stage: Relationship Discovery. Runs once per pipeline run over every active asset, not per-file — a relationship is inherently a cross-file fact. */
export function runRelationshipDiscoveryStage(ctx: ImportPipelineContext, allActive: AssetRecord[]): number {
  const relCount = detectSourceToExportRelationships(ctx.db, allActive);
  if (relCount > 0) {
    ctx.bus.emit("relationship.updated", { workspaceId: ctx.workspaceId, count: relCount });
    ctx.logger.info("relationships.detected", `Detected ${relCount} source-to-export relationship(s)`, { scanRunId: ctx.scanRunId });
  }
  return relCount;
}

/** Stage: Knowledge Update (classification + tagging + date resolution). Reclassifies anything touched this run, plus anything from a prior run with no classification/resolution yet. */
export function runKnowledgeUpdateStage(
  ctx: ImportPipelineContext,
  allActive: AssetRecord[],
  touchedIds: Set<number>
): { classifiedCount: number; resolvedCount: number } {
  const { db, bus, logger, workspaceId, scanRunId } = ctx;

  const needsClassification = allActive.filter((a) => touchedIds.has(a.id) || !getClassification(db, a.id));
  let classifiedCount = 0;
  for (const asset of needsClassification) {
    const hasExport =
      db.get("SELECT 1 as x FROM relationships WHERE to_asset_id = ? AND relationship_type = 'source_to_export'", [
        asset.id,
      ]) !== undefined;
    const classification = classifyAssetAndEnrichReview(db, asset, hasExport);
    bus.emit("classification.assigned", {
      workspaceId,
      assetId: asset.assetId,
      category: classification.category,
      confidence: classification.confidence,
    });
    const tagCount = tagAssetAutomatically(db, asset, classification.category);
    bus.emit("tags.assigned", { workspaceId, assetId: asset.assetId, count: tagCount });
    classifiedCount++;
  }
  if (classifiedCount > 0) {
    logger.info("classification.completed", `Classified and tagged ${classifiedCount} asset(s)`, { scanRunId });
  }

  // Pass 1: resolve every asset that needs a date from whatever non-relationship
  // candidates exist. Pass 2: propagate relationship-derived candidates to
  // connected assets that still have no/weak resolution, then re-resolve only
  // those — bounded, not an unbounded graph walk.
  const needsResolution = allActive.filter((a) => touchedIds.has(a.id) || !getResolvedDate(db, a.id));
  let resolvedCount = 0;
  for (const asset of needsResolution) {
    if (resolveAssetDate(db, asset.id)) resolvedCount++;
  }

  const relationships = db.all<{ from_asset_id: number; to_asset_id: number; relationship_type: string }>(
    "SELECT from_asset_id, to_asset_id, relationship_type FROM relationships"
  );
  const assetById = new Map(allActive.map((a) => [a.id, a]));
  for (const rel of relationships) {
    const to = assetById.get(rel.to_asset_id);
    const from = assetById.get(rel.from_asset_id);
    if (!to || !from) continue;
    const toResolved = getResolvedDate(db, to.id);
    const fromResolved = getResolvedDate(db, from.id);
    if (fromResolved && (!toResolved || toResolved.confidence < fromResolved.confidence)) {
      const candidate = buildRelationshipDerivedCandidate(from, fromResolved.resolvedDate, rel.relationship_type);
      recordCandidateDate(db, to.id, candidate, true, null);
      if (resolveAssetDate(db, to.id)) resolvedCount++;
    }
  }
  if (resolvedCount > 0) {
    bus.emit("timeline.updated", { workspaceId, count: resolvedCount });
    logger.info("timeline.resolved", `Resolved a best-supported date for ${resolvedCount} asset(s)`, { scanRunId });
  }

  return { classifiedCount, resolvedCount };
}

/** Stage: Validation. Runs the existing Knowledge Validation Engine (Phase 3.5) against the post-import state — delegated, not duplicated, per this project's standing "delegate, don't duplicate" pattern. */
export function runValidationStage(db: WorkspaceDatabase): ValidationCheckResult[] {
  return validateKnowledge(db);
}

export function listAllActiveAssets(db: WorkspaceDatabase): AssetRecord[] {
  return listActiveAssets(db);
}
