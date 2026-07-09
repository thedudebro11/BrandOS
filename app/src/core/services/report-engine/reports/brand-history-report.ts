import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { listResolvedDates, getClassification } from "../../../db/knowledge-repositories";
import { REPORT_SCHEMA_VERSION, type Citation, type ReportContent } from "../report-types";
import { buildCitationIndex, obsidianNotePathFor, section } from "../report-helpers";

/**
 * A chronological narrative built entirely from resolved dates (Phase 3.5) —
 * every sentence is a template filled from real fields (date, category,
 * confidence, reasoning), never free-form generated prose.
 */
export function generateBrandHistoryReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  const resolved = [...listResolvedDates(db)].sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate));

  const entries = resolved.map((rd) => {
    const assetRow = db.get<{ asset_id: string; filename: string }>("SELECT asset_id, filename FROM assets WHERE id = ?", [rd.assetId]);
    const classification = getClassification(db, rd.assetId);
    return { rd, assetRow, classification };
  });

  const body =
    entries.length === 0
      ? "No resolved dates found — no chronological brand history can be assembled yet."
      : entries
          .map(({ rd, assetRow, classification }) => {
            const category = classification ? classification.category : "unclassified";
            return `- **${rd.resolvedDate.slice(0, 10)}** — ${category} evidence recorded: ${assetRow?.asset_id ?? "?"} (${
              assetRow?.filename ?? "?"
            }), confidence ${rd.confidence}/100. ${rd.reasoning}`;
          })
          .join("\n");

  const citations: Citation[] = entries
    .filter(({ assetRow }) => !!assetRow)
    .map(({ rd, assetRow }) => ({
      assetId: assetRow!.asset_id,
      description: `Resolved date ${rd.resolvedDate.slice(0, 10)} contributing to brand history timeline`,
      confidence: rd.confidence,
      sourceType: rd.sourceType,
      obsidianNotePath: obsidianNotePathFor(db, assetRow!.asset_id),
    }));

  const sections = [
    section(
      "summary",
      "Summary",
      `${entries.length} dated evidence event(s) found, spanning ${
        entries.length > 0 ? `${entries[0].rd.resolvedDate.slice(0, 10)} to ${entries[entries.length - 1].rd.resolvedDate.slice(0, 10)}` : "(no span)"
      }.`,
      [{ description: `Computed from ${entries.length} resolved_dates row(s).` }]
    ),
    section("timeline", "Chronological Timeline", body, citations, entries.length === 0),
  ];

  return {
    reportType: "brand_history",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Brand History Report — ${workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
