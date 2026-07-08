import { WorkspaceDatabase } from "../../db/connection";
import { runMigrations } from "../../db/migrate";
import { WorkspaceFs } from "../../fs/workspace-fs";
import { EventBus } from "../../events/event-bus";
import { Logger } from "../../logging/logger";
import { scanWorkspaceFiles } from "../file-scanner/scanner";
import { hashFile, writeManifests } from "../hashing-engine/hash-engine";
import { extractMetadata } from "../metadata-engine";
import { detectSourceToExportRelationships } from "../relationship-engine/relationship-engine";
import { recordAssetTimelineEvents } from "../timeline-engine/timeline-engine";
import { classifyAssetAndEnrichReview } from "../classification-engine";
import { tagAssetAutomatically } from "../tag-engine";
import {
  collectCandidateDatesForAsset,
  resolveAssetDate,
  buildRelationshipDerivedCandidate,
} from "../timeline-intelligence";
import { getClassification, getResolvedDate, recordCandidateDate } from "../../db/knowledge-repositories";
import {
  createAsset,
  createScanRun,
  findAssetByPath,
  finishScanRun,
  listActiveAssets,
  markAssetsMissing,
  registerDuplicateIfNeeded,
  replaceAssetMetadata,
  touchAssetSeen,
  updateAssetOnRescan,
  upsertWorkspaceInfo,
} from "../../db/repositories";
import type { AssetRecord, LoadedWorkspace, ScanRunSummary, ScanTrigger } from "../../types";

export interface ScanResult {
  summary: ScanRunSummary;
  wfs: WorkspaceFs;
  db: WorkspaceDatabase;
}

/**
 * Read-only orchestrator: scan -> hash -> extract metadata -> upsert asset ->
 * duplicate check -> (after all files) relationships -> timeline -> manifests.
 * Never moves, renames, or deletes anything in the evidence tree — the only
 * filesystem writes happen through WorkspaceFs.writeGenerated(), which is
 * structurally confined to .brandos/.
 */
export async function runScan(workspace: LoadedWorkspace, trigger: ScanTrigger = "manual"): Promise<ScanResult> {
  const wfs = new WorkspaceFs(workspace);
  wfs.ensureBrandosDir();
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);
  upsertWorkspaceInfo(db, workspace.config);

  const bus = new EventBus();
  const logger = new Logger(db, bus);
  const runKey = `${workspace.config.id}-${new Date().toISOString()}`;
  const scanRunId = createScanRun(db, runKey, trigger);

  bus.emit("scan.started", { workspaceId: workspace.config.id, runKey, trigger });
  logger.info("scan.started", `Starting ${trigger} scan of workspace "${workspace.config.id}"`, { scanRunId });

  const counts = {
    filesDiscovered: 0,
    filesScanned: 0,
    filesSkipped: 0,
    filesErrored: 0,
    assetsCreated: 0,
    assetsUpdated: 0,
    assetsMissing: 0,
    duplicateGroupsFound: 0,
  };

  try {
    const { files, stats } = scanWorkspaceFiles(wfs, logger, scanRunId);
    counts.filesDiscovered = stats.discovered;

    const seenAssetIds = new Set<number>();
    const touchedAssets: AssetRecord[] = [];

    for (const file of files) {
      bus.emit("file.discovered", { workspaceId: workspace.config.id, relPath: file.relPath });

      const existing = findAssetByPath(db, file.relPath);
      const unchanged =
        existing &&
        existing.sizeBytes === file.sizeBytes &&
        existing.modifiedAt === file.modifiedAt;

      if (unchanged) {
        touchAssetSeen(db, existing.id);
        seenAssetIds.add(existing.id);
        counts.filesScanned++;
        continue;
      }

      let sha256: string | null = null;
      try {
        sha256 = await hashFile(file.absPath);
        bus.emit("hash.computed", { workspaceId: workspace.config.id, relPath: file.relPath, sha256 });
      } catch (err) {
        logger.error("hash.failed", `Could not hash ${file.relPath}: ${(err as Error).message}`, { scanRunId });
        counts.filesErrored++;
        continue;
      }

      let metadata: Awaited<ReturnType<typeof extractMetadata>> = [];
      try {
        metadata = await extractMetadata(file.absPath, file.extension, logger);
        bus.emit("metadata.extracted", {
          workspaceId: workspace.config.id,
          relPath: file.relPath,
          count: metadata.length,
        });
      } catch (err) {
        logger.warn("metadata.failed", `Metadata extraction errored for ${file.relPath}: ${(err as Error).message}`, {
          scanRunId,
        });
      }

      let asset: AssetRecord;
      if (existing) {
        updateAssetOnRescan(db, existing, file, sha256);
        asset = findAssetByPath(db, file.relPath)!;
        bus.emit("asset.updated", { workspaceId: workspace.config.id, assetId: asset.assetId, relPath: file.relPath });
        logger.info("asset.updated", `Asset changed: ${asset.assetId} (${file.relPath})`, {
          scanRunId,
          assetId: asset.assetId,
        });
        counts.assetsUpdated++;
      } else {
        asset = createAsset(db, file, sha256);
        bus.emit("asset.created", { workspaceId: workspace.config.id, assetId: asset.assetId, relPath: file.relPath });
        logger.info("asset.created", `New asset: ${asset.assetId} (${file.relPath})`, {
          scanRunId,
          assetId: asset.assetId,
        });
        counts.assetsCreated++;
      }

      replaceAssetMetadata(db, asset.id, metadata);

      if (sha256) {
        registerDuplicateIfNeeded(db, sha256, asset.id);
      }

      recordAssetTimelineEvents(db, asset, metadata);
      bus.emit("timeline.updated", { workspaceId: workspace.config.id, count: 1 });

      // Phase 3.5: collect every candidate date this asset offers (filesystem,
      // metadata, filename/folder patterns). Filesystem timestamps are stored
      // as just one candidate among these, never assumed true — see
      // ARCHITECTURE_DECISIONS.md ADR-010.
      collectCandidateDatesForAsset(db, asset, metadata);

      seenAssetIds.add(asset.id);
      touchedAssets.push(asset);
      counts.filesScanned++;
    }

    counts.filesSkipped = stats.skippedGenerated + stats.skippedIgnored;
    counts.assetsMissing = markAssetsMissing(db, seenAssetIds);
    // Count distinct duplicate groups (not per-asset registration events) for an accurate summary metric.
    counts.duplicateGroupsFound = db.get<{ c: number }>("SELECT COUNT(*) AS c FROM duplicate_groups")?.c ?? 0;

    const allActive = listActiveAssets(db);
    const relCount = detectSourceToExportRelationships(db, allActive);
    if (relCount > 0) {
      bus.emit("relationship.updated", { workspaceId: workspace.config.id, count: relCount });
      logger.info("relationships.detected", `Detected ${relCount} source-to-export relationship(s)`, { scanRunId });
    }

    // Rule-based classification + tagging (no AI — see classification-engine/rules.ts).
    // Runs after relationship detection so "is this image an Export?" can see
    // whether a source_to_export relationship was actually found for it.
    // Reclassifies anything touched this run, plus anything from a prior scan
    // that has no classification yet (e.g. the first scan after this feature shipped).
    const touchedIds = new Set(touchedAssets.map((a) => a.id));
    const needsClassification = allActive.filter((a) => touchedIds.has(a.id) || !getClassification(db, a.id));
    let classifiedCount = 0;
    for (const asset of needsClassification) {
      const hasExport =
        db.get("SELECT 1 as x FROM relationships WHERE to_asset_id = ? AND relationship_type = 'source_to_export'", [
          asset.id,
        ]) !== undefined;
      const classification = classifyAssetAndEnrichReview(db, asset, hasExport);
      bus.emit("classification.assigned", {
        workspaceId: workspace.config.id,
        assetId: asset.assetId,
        category: classification.category,
        confidence: classification.confidence,
      });
      const tagCount = tagAssetAutomatically(db, asset, classification.category);
      bus.emit("tags.assigned", { workspaceId: workspace.config.id, assetId: asset.assetId, count: tagCount });
      classifiedCount++;
    }
    if (classifiedCount > 0) {
      logger.info("classification.completed", `Classified and tagged ${classifiedCount} asset(s)`, { scanRunId });
    }

    // Phase 3.5: resolve a best-supported date for every asset that needs one
    // (touched this run, or never resolved before). Pass 1 uses whatever
    // non-relationship candidates exist; Pass 2 adds relationship-derived
    // candidates for assets connected to an asset that now has a resolved
    // date, then re-resolves only those — avoiding unbounded iteration while
    // still covering the "PSD -> PNG inherits a nearby date" case.
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
      // If the "to" side has no strong resolution but the "from" side does, offer a
      // relationship-derived candidate and let the priority system decide if it wins.
      if (fromResolved && (!toResolved || toResolved.confidence < fromResolved.confidence)) {
        const candidate = buildRelationshipDerivedCandidate(from, fromResolved.resolvedDate, rel.relationship_type);
        recordCandidateDate(db, to.id, candidate, true, null);
        if (resolveAssetDate(db, to.id)) resolvedCount++;
      }
    }
    if (resolvedCount > 0) {
      bus.emit("timeline.updated", { workspaceId: workspace.config.id, count: resolvedCount });
      logger.info("timeline.resolved", `Resolved a best-supported date for ${resolvedCount} asset(s)`, { scanRunId });
    }

    writeManifests(wfs, allActive);

    finishScanRun(db, scanRunId, "completed", counts);
    bus.emit("scan.completed", { workspaceId: workspace.config.id, runKey });
    logger.info(
      "scan.completed",
      `Scan complete: ${counts.assetsCreated} created, ${counts.assetsUpdated} updated, ${counts.assetsMissing} missing, ${counts.duplicateGroupsFound} duplicate group(s)`,
      { scanRunId }
    );

    const summary: ScanRunSummary = {
      runKey,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "completed",
      trigger,
      ...counts,
    };
    return { summary, wfs, db };
  } catch (err) {
    finishScanRun(db, scanRunId, "failed", counts);
    bus.emit("scan.error", { workspaceId: workspace.config.id, runKey, message: (err as Error).message });
    logger.error("scan.error", `Scan failed: ${(err as Error).message}`, { scanRunId });
    throw err;
  } finally {
    db.save();
  }
}

/** Best-effort polling watch mode — re-runs an incremental scan on an interval. Foundation only, not fs.watch-based. */
export function watchWorkspace(
  workspace: LoadedWorkspace,
  intervalMs: number,
  onScan: (result: ScanResult) => void
): () => void {
  const timer = setInterval(() => {
    runScan(workspace, "watch")
      .then(onScan)
      .catch((err) => console.error(`[watch] scan failed for ${workspace.config.id}:`, err.message));
  }, intervalMs);
  return () => clearInterval(timer);
}
