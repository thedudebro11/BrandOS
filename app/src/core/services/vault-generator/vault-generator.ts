import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import { getObsidianNoteByEntity, upsertObsidianNote } from "../../db/vault-repositories";
import { splitNoteContent, buildNoteFile, hashContent } from "./edit-preservation";
import {
  assetNoteFrontmatter,
  assetNoteBody,
  caseNoteFrontmatter,
  caseNoteBody,
  workspaceNoteFrontmatter,
  workspaceNoteBody,
  indexNoteFrontmatter,
  indexNoteBody,
  type CaseNoteData,
  type WorkspaceNoteData,
} from "./note-templates";
import { getAssetIntelligence } from "../asset-intelligence/asset-intelligence";
import { CaseBuilderService } from "../case-builder/case-builder-service";
import { QueryEngine } from "../query-engine/query-engine";
import { computeEvidenceQualityMetrics } from "../evidence-quality-metrics/evidence-quality-metrics";
import { latestEvidenceAssessments, listCaseLinks, listCases, listRelatedCases, listOpenReviewQueue } from "../../db/knowledge-repositories";
import { listActiveAssets } from "../../db/repositories";
import type { ObsidianEntityType, NoteWriteResult, WorkspaceConfig } from "../../types";

/**
 * The core write primitive every note-generating function below funnels
 * through. Implements incremental regeneration (skip if the generated block
 * is unchanged) and edit preservation (never overwrite a generated block a
 * human has hand-edited) in one place — Phase 6 Sections 5 and 6.
 */
function writeNote(
  wfs: WorkspaceFs,
  db: WorkspaceDatabase,
  entityType: ObsidianEntityType,
  entityId: string,
  vaultPath: string,
  frontmatter: string,
  generatedBody: string
): NoteWriteResult {
  const newHash = hashContent(generatedBody);
  const existingRecord = getObsidianNoteByEntity(db, entityType, entityId);
  const onDiskRaw = wfs.readVaultFile(vaultPath);

  let preservedAfter = "";
  if (onDiskRaw !== null) {
    const split = splitNoteContent(onDiskRaw);
    preservedAfter = split.after;
    if (split.generated !== null && existingRecord) {
      const onDiskHash = hashContent(split.generated);
      if (onDiskHash !== existingRecord.contentHash) {
        // The generated block itself no longer matches what BrandOS last wrote —
        // a human edited it. Never overwrite; record the drift and stop.
        upsertObsidianNote(db, entityType, entityId, vaultPath, existingRecord.contentHash, true);
        return { vaultPath, outcome: "skipped_manual_edit" };
      }
    }
  }

  if (existingRecord && !existingRecord.hasManualEdits && existingRecord.contentHash === newHash && onDiskRaw !== null) {
    return { vaultPath, outcome: "skipped_unchanged" };
  }

  wfs.writeVaultFile(vaultPath, buildNoteFile(frontmatter, generatedBody, preservedAfter));
  upsertObsidianNote(db, entityType, entityId, vaultPath, newHash, false);
  return { vaultPath, outcome: existingRecord ? "updated" : "created" };
}

export function generateAssetNote(wfs: WorkspaceFs, db: WorkspaceDatabase, assetId: string): NoteWriteResult | undefined {
  const view = getAssetIntelligence(db, assetId);
  if (!view) return undefined;
  const vaultPath = `Assets/${assetId}.md`;
  return writeNote(wfs, db, "asset", assetId, vaultPath, assetNoteFrontmatter(view), assetNoteBody(view));
}

export function generateCaseNote(wfs: WorkspaceFs, db: WorkspaceDatabase, caseId: number): NoteWriteResult | undefined {
  const service = new CaseBuilderService(db);
  const theCase = service.get(caseId);
  if (!theCase) return undefined;
  service.recomputeEvidenceStrength(caseId);

  const links = service.listLinks(caseId);
  const supportingAssetIds = links
    .filter((l) => l.linkedType === "asset")
    .map((l) => db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [l.linkedId])?.asset_id)
    .filter((id): id is string => !!id);
  const missingEvidence = db.all<{ description: string; priority: string }>(
    "SELECT description, priority FROM case_missing_evidence WHERE case_id = ?",
    [caseId]
  );
  const relatedCaseIds = listRelatedCases(db, caseId).map((c) => c.id);
  const evidenceOverview = latestEvidenceAssessments(db, "case", caseId).find((a) => a.dimension === "strength");

  const data: CaseNoteData = { theCase, evidenceOverview, supportingAssetIds, missingEvidence, relatedCaseIds };
  const caseKey = theCase.caseKey ?? `case-${caseId}`;
  const vaultPath = `Cases/${caseKey}.md`;
  return writeNote(wfs, db, "case", caseKey, vaultPath, caseNoteFrontmatter(data), caseNoteBody(data));
}

export function generateWorkspaceNote(wfs: WorkspaceFs, db: WorkspaceDatabase, config: WorkspaceConfig): NoteWriteResult {
  const metrics = computeEvidenceQualityMetrics(db);
  const data: WorkspaceNoteData = {
    name: config.name,
    status: config.status,
    healthScore: metrics.healthScore,
    casesCount: listCases(db).length,
    assetsCount: listActiveAssets(db).length,
    needsReviewCount: listOpenReviewQueue(db).length,
    duplicateGroupsCount: db.get<{ c: number }>("SELECT COUNT(*) as c FROM duplicate_groups")?.c ?? 0,
  };
  return writeNote(wfs, db, "workspace", "workspace", "Workspace.md", workspaceNoteFrontmatter(), workspaceNoteBody(data));
}

function writeIndex(
  wfs: WorkspaceFs,
  db: WorkspaceDatabase,
  slug: string,
  title: string,
  description: string,
  items: { id: string; label: string; detail?: string }[]
): NoteWriteResult {
  const vaultPath = `Indexes/${slug}.md`;
  return writeNote(wfs, db, "index", slug, vaultPath, indexNoteFrontmatter(slug), indexNoteBody(title, description, items));
}

/**
 * Every "index" here is a filtered/sorted VIEW over real Asset/Case notes —
 * never a duplicate copy. "Logo Evolution", "Products", etc. are not real
 * database entities; they're real tag/classification queries against real
 * assets, rendered as a list of links to the one canonical note each asset
 * already has under Assets/ (Phase 6 architecture decision — see
 * ARCHITECTURE_DECISIONS.md).
 */
export function generateIndexes(wfs: WorkspaceFs, db: WorkspaceDatabase): NoteWriteResult[] {
  const query = new QueryEngine(db);
  const results: NoteWriteResult[] = [];

  const allAssets = listActiveAssets(db);
  results.push(
    writeIndex(
      wfs,
      db,
      "All Assets",
      "All Assets",
      "Every active asset BrandOS has cataloged.",
      allAssets.map((a) => ({ id: a.assetId, label: a.filename }))
    )
  );

  const allCases = listCases(db);
  results.push(
    writeIndex(
      wfs,
      db,
      "All Cases",
      "All Cases",
      "Every case in this workspace.",
      allCases.map((c) => ({ id: c.caseKey ?? `case-${c.id}`, label: c.title, detail: c.caseType }))
    )
  );

  const needsReview = listOpenReviewQueue(db);
  results.push(
    writeIndex(
      wfs,
      db,
      "Needs Review",
      "Needs Review",
      "Assets with classification confidence below 70 — not yet usable as settled evidence.",
      needsReview
        .map((r) => {
          const asset = r.assetId ? db.get<{ asset_id: string; filename: string }>("SELECT asset_id, filename FROM assets WHERE id = ?", [r.assetId]) : null;
          return asset ? { id: asset.asset_id, label: asset.filename, detail: r.reason } : null;
        })
        .filter((x): x is { id: string; label: string; detail: string } => !!x)
    )
  );

  const dupGroups = query.duplicateGroups();
  results.push(
    writeIndex(
      wfs,
      db,
      "Duplicates",
      "Duplicate Groups",
      "Assets sharing identical content (same SHA-256 hash).",
      dupGroups.map((g) => ({ id: `dup-group-${g.groupId}`, label: `Group ${g.groupId} (${g.assetIds.length} assets, sha256 ${g.sha256.slice(0, 12)}…)` }))
    )
  );
  // Duplicate groups aren't individually-linkable entities with their own notes yet
  // (Phase 6 scope) — listed here for visibility; each member asset has its own real note.

  const priorityOfUse = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "priority_of_use");
  const priorityAssets = query.assetsSupportingDimension("priority_of_use");
  results.push(
    writeIndex(
      wfs,
      db,
      "Priority of Use",
      "Priority of Use",
      priorityOfUse ? `${priorityOfUse.score}/100 (${priorityOfUse.status}). ${priorityOfUse.notes}` : "Not yet assessed.",
      priorityAssets.map((a) => ({ id: a.assetId, label: a.filename }))
    )
  );

  const logoAssetIds = query.assetsByTag("Logo");
  results.push(
    writeIndex(
      wfs,
      db,
      "Logo Evolution",
      "Logo Evolution",
      "Every asset tagged Logo, for browsing the brand's logo history.",
      logoAssetIds.map((a) => ({ id: a.assetId, label: a.filename }))
    )
  );

  const designSourceAssets = query.listAssetsFiltered({ classification: "Design Source" });
  results.push(
    writeIndex(
      wfs,
      db,
      "Design Evolution",
      "Design Evolution",
      "Every asset classified as a Design Source file.",
      designSourceAssets.map((a) => ({ id: a.assetId, label: a.filename }))
    )
  );

  const productAssets = query.listAssetsFiltered({ classification: "Product Photo" });
  results.push(
    writeIndex(
      wfs,
      db,
      "Products",
      "Products",
      "Every asset classified as a Product Photo.",
      productAssets.map((a) => ({ id: a.assetId, label: a.filename }))
    )
  );

  return results;
}

export interface VaultGenerationSummary {
  results: NoteWriteResult[];
  created: number;
  updated: number;
  skippedUnchanged: number;
  skippedManualEdit: number;
}

/** The single entry point: regenerates every note this workspace's data supports. Read from DB, write only to the vault dir — never the evidence tree. */
export function generateVault(wfs: WorkspaceFs, db: WorkspaceDatabase, config: WorkspaceConfig): VaultGenerationSummary {
  const results: NoteWriteResult[] = [];

  results.push(generateWorkspaceNote(wfs, db, config));

  for (const asset of listActiveAssets(db)) {
    const r = generateAssetNote(wfs, db, asset.assetId);
    if (r) results.push(r);
  }

  for (const c of listCases(db)) {
    const r = generateCaseNote(wfs, db, c.id);
    if (r) results.push(r);
  }

  results.push(...generateIndexes(wfs, db));

  return {
    results,
    created: results.filter((r) => r.outcome === "created").length,
    updated: results.filter((r) => r.outcome === "updated").length,
    skippedUnchanged: results.filter((r) => r.outcome === "skipped_unchanged").length,
    skippedManualEdit: results.filter((r) => r.outcome === "skipped_manual_edit").length,
  };
}
