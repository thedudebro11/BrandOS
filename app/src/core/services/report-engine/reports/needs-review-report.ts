import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { listOpenReviewQueue } from "../../../db/knowledge-repositories";
import { REPORT_SCHEMA_VERSION, type Citation, type ReportContent } from "../report-types";
import { buildCitationIndex, obsidianNotePathFor, section } from "../report-helpers";

/** Renders the real Human Review Queue (Phase 3) — every entry here has confidence below the 70 threshold the classification engine uses; this report never re-decides anything, only lists what's already flagged. */
export function generateNeedsReviewReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  const queue = listOpenReviewQueue(db);
  const withAssets = queue.map((entry) => ({
    entry,
    asset: entry.assetId
      ? db.get<{ asset_id: string; filename: string }>("SELECT asset_id, filename FROM assets WHERE id = ?", [entry.assetId])
      : undefined,
  }));

  const citations: Citation[] = withAssets.map(({ entry, asset }) => ({
    assetId: asset?.asset_id,
    description: `${entry.reason}${entry.suggestedClassifications ? ` — suggested: ${entry.suggestedClassifications}` : ""}`,
    confidence: entry.confidence ?? undefined,
    obsidianNotePath: asset ? obsidianNotePathFor(db, asset.asset_id) : undefined,
  }));

  const body =
    queue.length === 0
      ? "The review queue is empty — no assets currently need human review."
      : withAssets
          .map(
            ({ entry, asset }) =>
              `- ${asset?.asset_id ?? "(unknown asset)"} (${asset?.filename ?? "?"}): ${entry.reason}` +
              (entry.confidence !== null ? ` (confidence ${entry.confidence})` : "")
          )
          .join("\n");

  const sections = [section("review-queue", "Open Review Queue", body, citations, queue.length === 0)];

  return {
    reportType: "needs_review",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Needs Review Report — ${workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
