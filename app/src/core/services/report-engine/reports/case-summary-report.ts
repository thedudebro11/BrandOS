import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { composeCaseDetail } from "../../case-builder/case-detail-composer";
import { REPORT_SCHEMA_VERSION, type ReportContent, type ReportGenerateOpts } from "../report-types";
import { buildCitationIndex, citeAsset, section } from "../report-helpers";

/** Reuses composeCaseDetail() — the exact same composition the Case Detail API route calls (Phase 4.5, extracted Phase 8) — so this report and Mission Control's Case Workspace page can never disagree about a case's own facts. */
export function generateCaseSummaryReport(db: WorkspaceDatabase, workspace: WorkspaceConfig, opts: ReportGenerateOpts): ReportContent {
  if (opts.caseId === undefined) throw new Error("case_summary report requires opts.caseId");
  const composed = composeCaseDetail(db, opts.caseId);
  if (!composed) throw new Error(`Case ${opts.caseId} not found in workspace "${workspace.id}"`);

  const { theCase, supportingAssets, timeline, conflicts, missingEvidence, evidenceStrength, relatedCases } = composed;

  const summarySection = section(
    "executive-summary",
    "Executive Summary",
    `**${theCase.title}** (${theCase.caseType}, status: ${theCase.status}). ${theCase.purpose ?? "No purpose recorded."} ` +
      `${supportingAssets.length} supporting asset(s), ${timeline.length} linked timeline event(s).`,
    [{ description: `Case #${theCase.id}, created ${theCase.createdAt}, last updated ${theCase.updatedAt}.`, caseId: theCase.id }]
  );

  const evidenceSection = section(
    "evidence-overview",
    "Evidence Overview",
    evidenceStrength ? `Strength: ${evidenceStrength.score}/100 (${evidenceStrength.status}). ${evidenceStrength.notes}` : "No evidence assessment available.",
    [{ description: "Sourced from the case's strength evidence assessment.", caseId: theCase.id }]
  );

  const supportingSection = section(
    "supporting-assets",
    "Supporting Assets",
    supportingAssets.length === 0
      ? "No assets linked to this case yet."
      : supportingAssets.map((v) => `- ${v.asset.assetId} (${v.asset.filename}) — ${v.classification?.category ?? "unclassified"}`).join("\n"),
    supportingAssets.map((v) => citeAsset(db, v, `Linked to case "${theCase.title}"`)),
    supportingAssets.length === 0
  );

  const missingSection = section(
    "missing-evidence",
    "Missing Evidence",
    missingEvidence.length === 0
      ? "No missing-evidence items flagged for this case."
      : missingEvidence.map((m) => `- [${(m as any).priority}] ${(m as any).description}`).join("\n"),
    missingEvidence.map((m) => ({ caseId: theCase.id, description: (m as any).description as string, sourceType: "case_missing_evidence" })),
    missingEvidence.length === 0
  );

  const conflictsSection = section(
    "conflicts",
    "Conflicts",
    conflicts.length === 0 ? "No conflicting evidence detected among this case's supporting assets." : conflicts.map((v) => `- ${v.asset.assetId}`).join("\n"),
    conflicts.map((v) => citeAsset(db, v, "Flagged as conflicting within this case")),
    conflicts.length === 0
  );

  const relatedSection = section(
    "related-cases",
    "Related Cases",
    relatedCases.length === 0 ? "No related cases (no shared evidence with another case)." : relatedCases.map((c) => `- ${c.title} (#${c.id})`).join("\n"),
    relatedCases.map((c) => ({ caseId: c.id, description: `Related to case "${theCase.title}" via shared evidence.` })),
    relatedCases.length === 0
  );

  const sections = [summarySection, evidenceSection, supportingSection, missingSection, conflictsSection, relatedSection];

  return {
    reportType: "case_summary",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: theCase.id,
    caseTitle: theCase.title,
    generatedAt: new Date().toISOString(),
    title: `Case Summary Report — ${theCase.title}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
