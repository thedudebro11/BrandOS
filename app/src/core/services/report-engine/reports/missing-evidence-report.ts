import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { assessWorkspaceEvidence } from "../../evidence-engine/evidence-engine";
import { listEvidenceGaps } from "../../../db/knowledge-repositories";
import { REPORT_SCHEMA_VERSION, type ReportContent } from "../report-types";
import { buildCitationIndex, citeGap, section } from "../report-helpers";

/** Every gap here is a real `evidence_gaps` row written by the Phase 3 Evidence Engine — this report renders them, it does not detect them. */
export function generateMissingEvidenceReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  assessWorkspaceEvidence(db); // ensure gaps reflect the current workspace state, not a stale prior run
  const gaps = listEvidenceGaps(db, "workspace", null);

  const byPriority = { high: gaps.filter((g) => g.priority === "high"), normal: gaps.filter((g) => g.priority !== "high") };

  const summaryBody =
    gaps.length === 0
      ? "No missing-evidence gaps found for this workspace."
      : `${gaps.length} evidence gap(s) found: ${byPriority.high.length} high priority, ${byPriority.normal.length} normal priority.`;

  const highBody =
    byPriority.high.length === 0
      ? "No high-priority gaps."
      : byPriority.high.map((g) => `- [${g.gapType}] ${g.description}`).join("\n");

  const normalBody =
    byPriority.normal.length === 0
      ? "No normal-priority gaps."
      : byPriority.normal.map((g) => `- [${g.gapType}] ${g.description}`).join("\n");

  const sections = [
    section("summary", "Summary", summaryBody, [{ description: `Sourced from ${gaps.length} evidence_gaps row(s), recomputed at generation time.` }]),
    section("high-priority", "High-Priority Gaps", highBody, byPriority.high.map((g) => citeGap(db, g)), byPriority.high.length === 0),
    section("normal-priority", "Normal-Priority Gaps", normalBody, byPriority.normal.map((g) => citeGap(db, g)), byPriority.normal.length === 0),
  ];

  return {
    reportType: "missing_evidence",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Missing Evidence Report — ${workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
