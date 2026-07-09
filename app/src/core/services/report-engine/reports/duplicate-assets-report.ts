import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { QueryEngine } from "../../query-engine/query-engine";
import { REPORT_SCHEMA_VERSION, type ReportSection, type ReportContent } from "../report-types";
import { buildCitationIndex, obsidianNotePathFor, section } from "../report-helpers";

/** Renders exact SHA-256 duplicate groups (Phase 2's registerDuplicateIfNeeded, queried via the Phase 3 QueryEngine) — byte-identical files only, never a similarity heuristic. */
export function generateDuplicateAssetsReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  const groups = new QueryEngine(db).duplicateGroups();

  const sections: ReportSection[] = groups.map((g) => {
    const members = g.assetIds.map((id) => db.get<{ asset_id: string; filename: string; original_path: string }>(
      "SELECT asset_id, filename, original_path FROM assets WHERE id = ?",
      [id]
    )).filter((m): m is { asset_id: string; filename: string; original_path: string } => !!m);

    const body = `${members.length} asset(s) share SHA-256 \`${g.sha256}\`:\n` + members.map((m) => `- ${m.asset_id} — ${m.original_path}`).join("\n");
    const citations = members.map((m) => ({
      assetId: m.asset_id,
      description: `Member of duplicate group ${g.groupId} (SHA-256 ${g.sha256})`,
      sourceType: "sha256_match",
      obsidianNotePath: obsidianNotePathFor(db, m.asset_id),
    }));

    return section(`group-${g.groupId}`, `Duplicate Group ${g.groupId}`, body, citations);
  });

  const summary = section(
    "summary",
    "Summary",
    groups.length === 0
      ? "No exact-duplicate assets found in this workspace."
      : `${groups.length} duplicate group(s) found, covering ${groups.reduce((sum, g) => sum + g.assetIds.length, 0)} asset(s) total.`,
    [{ description: `Computed via QueryEngine.duplicateGroups() against ${groups.length} group(s).` }]
  );

  const allSections = [summary, ...sections];

  return {
    reportType: "duplicate_assets",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Duplicate Assets Report — ${workspace.name}`,
    legalDisclaimer: null,
    sections: allSections,
    citationIndex: buildCitationIndex(allSections),
  };
}
