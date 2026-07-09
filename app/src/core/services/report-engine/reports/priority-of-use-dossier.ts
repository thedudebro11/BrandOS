import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { assessWorkspaceEvidence } from "../../evidence-engine/evidence-engine";
import { latestEvidenceAssessments, listEvidenceGaps, getResolvedDate } from "../../../db/knowledge-repositories";
import { listActiveAssets } from "../../../db/repositories";
import { QueryEngine } from "../../query-engine/query-engine";
import { getAssetIntelligence, type AssetIntelligenceView } from "../../asset-intelligence/asset-intelligence";
import { findConflictingAssets } from "../../evidence-provenance-engine/evidence-provenance-engine";
import { REPORT_SCHEMA_VERSION, type ReportSection, type ReportContent } from "../report-types";
import { buildCitationIndex, citeAsset, citeGap, section } from "../report-helpers";

interface EarliestCategoryResult {
  categoryLabel: string;
  view: AssetIntelligenceView | undefined;
}

/** Earliest-by-category, using resolved dates (Phase 3.5) — never a raw filesystem timestamp, and never QueryEngine.firstAssetByCategory() (which orders by unreliable filesystem created_at; see ADR-010). This is the correct composition of two existing engines, not a new scoring formula. */
function earliestInCategory(db: WorkspaceDatabase, label: string, assetIds: number[]): EarliestCategoryResult {
  let best: { assetId: number; date: string } | undefined;
  for (const id of assetIds) {
    const resolved = getResolvedDate(db, id);
    if (!resolved) continue;
    if (!best || resolved.resolvedDate < best.date) best = { assetId: id, date: resolved.resolvedDate };
  }
  if (!best) return { categoryLabel: label, view: undefined };
  const assetRow = db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [best.assetId]);
  return { categoryLabel: label, view: assetRow ? getAssetIntelligence(db, assetRow.asset_id) : undefined };
}

export function generatePriorityOfUseDossier(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  assessWorkspaceEvidence(db);
  const query = new QueryEngine(db);
  const active = listActiveAssets(db);

  const categoryQueries: { label: string; assetIds: number[] }[] = [
    { label: "Earliest Known Brand Evidence (any category)", assetIds: active.map((a) => a.id) },
    { label: "Earliest Known Logo Evidence", assetIds: query.assetsByTag("Logo").map((a) => a.id) },
    {
      label: "Earliest Known Product Evidence",
      assetIds: active.filter((a) => db.get("SELECT 1 as x FROM classifications WHERE asset_id = ? AND category = 'Product Photo'", [a.id])).map((a) => a.id),
    },
    {
      label: "Earliest Known Commercial Evidence",
      assetIds: active.filter((a) => db.get("SELECT 1 as x FROM classifications WHERE asset_id = ? AND category = 'Commerce Evidence'", [a.id])).map((a) => a.id),
    },
    {
      label: "Earliest Known Customer/Marketplace Evidence",
      assetIds: active.filter((a) => db.get("SELECT 1 as x FROM classifications WHERE asset_id = ? AND category = 'Marketplace Evidence'", [a.id])).map((a) => a.id),
    },
  ];

  const results = categoryQueries.map((c) => earliestInCategory(db, c.label, c.assetIds));
  const earliestSections: ReportSection[] = results.map((r) => {
    if (!r.view) {
      return section(r.categoryLabel.toLowerCase().replace(/[^a-z]+/g, "-"), r.categoryLabel, "No dated evidence found in this category.", [], true);
    }
    const rd = r.view.resolvedDate!;
    const body = `**${rd.resolvedDate.slice(0, 10)}** (confidence ${rd.confidence}/100, source: ${rd.sourceType}) — ${r.view.asset.assetId} (${r.view.asset.filename}). ${rd.reasoning}`;
    return section(r.categoryLabel.toLowerCase().replace(/[^a-z]+/g, "-"), r.categoryLabel, body, [citeAsset(db, r.view, r.categoryLabel)]);
  });

  const continuousUse = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "continuous_use");
  const continuousUseSection = section(
    "continuous-use",
    "Continuous Use Analysis",
    continuousUse ? `Score: ${continuousUse.score}/100 (${continuousUse.status}). ${continuousUse.notes}` : "No continuous-use assessment available.",
    [{ description: "Sourced from the workspace's continuous_use evidence assessment (Phase 3 Evidence Engine)." }]
  );

  const gaps = listEvidenceGaps(db, "workspace", null).filter((g) => g.gapType.startsWith("priority_of_use"));
  const missingSection = section(
    "missing-evidence",
    "Missing Evidence",
    gaps.length === 0 ? "No priority-of-use evidence gaps found." : gaps.map((g) => `- ${g.description}`).join("\n"),
    gaps.map((g) => citeGap(db, g)),
    gaps.length === 0
  );

  const citedViews = results.map((r) => r.view).filter((v): v is AssetIntelligenceView => !!v);
  const conflicts = findConflictingAssets(db, citedViews);
  const conflictsSection = section(
    "conflicts",
    "Conflicts",
    conflicts.length === 0
      ? "No conflicting dates detected among the cited evidence."
      : conflicts.map((v) => `- ${v.asset.assetId}: ${v.resolvedDate?.reasoning ?? "(reasoning unavailable)"}`).join("\n"),
    conflicts.map((v) => citeAsset(db, v, "Flagged as a conflicting resolved date")),
    conflicts.length === 0
  );

  const sections = [...earliestSections, continuousUseSection, missingSection, conflictsSection];

  return {
    reportType: "priority_of_use_dossier",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Priority of Use Dossier — ${workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
