import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { assessWorkspaceEvidence } from "../../evidence-engine/evidence-engine";
import { latestEvidenceAssessments, listEvidenceGaps } from "../../../db/knowledge-repositories";
import { computeEvidenceQualityMetrics, bandLabel } from "../../evidence-quality-metrics/evidence-quality-metrics";
import { runIntegrityCheck } from "../../integrity-engine/integrity-engine";
import { REPORT_SCHEMA_VERSION, REPORT_LEGAL_DISCLAIMER, type ReportContent } from "../report-types";
import { buildCitationIndex, citeGap, citeIntegrityIssue, section } from "../report-helpers";

const SPECIMEN_CATEGORIES = ["Product Photo", "Marketing Evidence"];

/**
 * Every score below is read from an assessment an existing engine already
 * computed (Phase 3's Evidence Engine, Phase 4's evidence-quality-metrics) —
 * "Trademark Readiness" is a composite VIEW over those, computed as a plain
 * average, not a new independent scoring formula. This mirrors how Phase 4's
 * dashboard health score composes existing metrics rather than inventing one.
 */
export function generateTrademarkReadinessReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  assessWorkspaceEvidence(db);
  const assessments = latestEvidenceAssessments(db, "workspace", null);
  const completeness = assessments.find((a) => a.dimension === "completeness");
  const continuousUse = assessments.find((a) => a.dimension === "continuous_use");
  const priorityOfUse = assessments.find((a) => a.dimension === "priority_of_use");
  const metrics = computeEvidenceQualityMetrics(db);

  const componentScores = [completeness?.score, continuousUse?.score, priorityOfUse?.score].filter(
    (s): s is number => s !== undefined
  );
  const readinessScore = componentScores.length > 0 ? Math.round(componentScores.reduce((a, b) => a + b, 0) / componentScores.length) : 0;

  const specimenPresent = SPECIMEN_CATEGORIES.filter(
    (cat) => db.get("SELECT 1 as x FROM classifications c JOIN resolved_dates rd ON rd.asset_id = c.asset_id WHERE c.category = ?", [cat]) !== undefined
  );
  const specimenMissing = SPECIMEN_CATEGORIES.filter((c) => !specimenPresent.includes(c));

  const gaps = listEvidenceGaps(db, "workspace", null);
  const integrityIssues = runIntegrityCheck(db).filter((i) => i.severity !== "info");

  const readinessSection = section(
    "readiness-score",
    "Trademark Readiness Score",
    `${readinessScore}/100 (${bandLabel(readinessScore)}) — average of completeness (${completeness?.score ?? "n/a"}), ` +
      `continuous use (${continuousUse?.score ?? "n/a"}), and priority of use (${priorityOfUse?.score ?? "n/a"}) assessment scores.`,
    [{ description: "Composite average of the workspace's stored completeness/continuous_use/priority_of_use assessments." }]
  );

  const specimenSection = section(
    "specimen-readiness",
    "Specimen Readiness",
    `Dated evidence present for: ${specimenPresent.join(", ") || "(none)"}. Missing dated evidence for: ${specimenMissing.join(", ") || "(none)"}.`,
    [{ description: `Checked ${SPECIMEN_CATEGORIES.join(", ")} against classifications joined with resolved_dates.` }]
  );

  const strengthSection = section(
    "strength-scores",
    "Priority of Use & Continuous Use Strength",
    `Priority of use: ${priorityOfUse?.score ?? "n/a"}/100 (${priorityOfUse?.status ?? "n/a"}). ${priorityOfUse?.notes ?? ""}\n` +
      `Continuous use: ${continuousUse?.score ?? "n/a"}/100 (${continuousUse?.status ?? "n/a"}). ${continuousUse?.notes ?? ""}`,
    [{ description: "Sourced directly from the workspace's stored evidence assessments." }]
  );

  const qualitySection = section(
    "evidence-documentation-quality",
    "Evidence & Documentation Quality",
    `Overall evidence health: ${metrics.healthScore}/100. Documentation completeness (classification): ${completeness?.score ?? "n/a"}/100. ` +
      `Metadata completeness: ${metrics.metadataCompleteness}%. Relationship completeness: ${metrics.relationshipCompleteness}%.`,
    [{ description: "Sourced from computeEvidenceQualityMetrics() and the completeness assessment." }]
  );

  const risksSection = section(
    "unresolved-risks",
    "Unresolved Risks",
    gaps.length === 0 && integrityIssues.length === 0
      ? "No unresolved evidence gaps or integrity issues found."
      : [...gaps.map((g) => `- [gap, ${g.priority}] ${g.description}`), ...integrityIssues.map((i) => `- [integrity, ${i.severity}] ${i.description}`)].join(
          "\n"
        ),
    [...gaps.map((g) => citeGap(db, g)), ...integrityIssues.map((i) => citeIntegrityIssue(db, i))],
    gaps.length === 0 && integrityIssues.length === 0
  );

  const actions = gaps.filter((g) => g.priority === "high").map((g) => `Address: ${g.description}`);
  const actionsSection = section(
    "recommended-actions",
    "Recommended Next Actions",
    actions.length === 0
      ? "No high-priority gaps requiring immediate action. Continue routine evidence collection."
      : actions.map((a) => `- ${a}`).join("\n"),
    [],
    true
  );

  const sections = [readinessSection, specimenSection, strengthSection, qualitySection, risksSection, actionsSection];

  return {
    reportType: "trademark_readiness",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Trademark Readiness Report — ${workspace.name}`,
    legalDisclaimer: REPORT_LEGAL_DISCLAIMER,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
