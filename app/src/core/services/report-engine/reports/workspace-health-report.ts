import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { computeEvidenceQualityMetrics, bandLabel } from "../../evidence-quality-metrics/evidence-quality-metrics";
import { runDataHealthCheck } from "../../data-health-engine/data-health-engine";
import { runIntegrityCheck } from "../../integrity-engine/integrity-engine";
import { validateKnowledge } from "../../knowledge-validation-engine/knowledge-validation-engine";
import { listActiveAssets } from "../../../db/repositories";
import { REPORT_SCHEMA_VERSION, type Citation, type ReportContent } from "../report-types";
import { buildCitationIndex, obsidianNotePathFor, section } from "../report-helpers";

/** scopeId on a finding/issue is a numeric asset id when scopeType is asset-shaped; resolved defensively — a non-asset scope just yields a citation with no assetId, never a crash. */
function citeScopedFinding(db: WorkspaceDatabase, scopeId: number | null, description: string, sourceType: string): Citation {
  const asset = scopeId !== null ? db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [scopeId]) : undefined;
  return {
    assetId: asset?.asset_id,
    description,
    sourceType,
    obsidianNotePath: asset ? obsidianNotePathFor(db, asset.asset_id) : undefined,
  };
}

/**
 * A document form of Mission Control's Overview — deliberately calling the
 * exact same engine functions the dashboard route does (Phase 4's
 * computeEvidenceQualityMetrics, Phase 3's runIntegrityCheck, Phase 4's
 * runDataHealthCheck, Phase 3.5's validateKnowledge), not a re-scored
 * summary. No factual claim in this report is unique to this report.
 */
export function generateWorkspaceHealthReport(db: WorkspaceDatabase, workspace: WorkspaceConfig): ReportContent {
  const metrics = computeEvidenceQualityMetrics(db);
  const healthFindings = runDataHealthCheck(db);
  const integrityIssues = runIntegrityCheck(db);
  const validationResults = validateKnowledge(db);
  const assetCount = listActiveAssets(db).length;

  const overviewBody =
    `Workspace "${workspace.name}" (${workspace.id}) has ${assetCount} active asset(s). ` +
    `Overall evidence health score: ${metrics.healthScore}/100 (${bandLabel(metrics.healthScore)}). ` +
    `Timeline completeness ${metrics.timelineCompleteness}%, metadata completeness ${metrics.metadataCompleteness}%, ` +
    `relationship completeness ${metrics.relationshipCompleteness}%, classification completeness ${metrics.classificationCompleteness}%. ` +
    `${metrics.needsReviewPercent}% of assets are in the human review queue. Duplicate coverage: ${metrics.duplicateCoverage}%.`;

  const findingsBody =
    healthFindings.length === 0
      ? "No data health findings — no duplicate, orphaned, or epoch-dated assets detected."
      : healthFindings.map((f) => `- [${f.severity}] ${f.findingType}: ${f.description}`).join("\n");

  const integrityBody =
    integrityIssues.length === 0
      ? "No integrity issues found — no broken references, hash mismatches, or circular relationships detected."
      : integrityIssues.map((i) => `- [${i.severity}] ${i.issueType}: ${i.description}`).join("\n");

  const failedValidations = validationResults.filter((r) => !r.passed);
  const validationBody =
    validationResults.length === 0
      ? "No validation checks have been run."
      : failedValidations.length === 0
      ? `All ${validationResults.length} knowledge validation check(s) passed.`
      : failedValidations.map((r) => `- FAILED ${r.checkName}: ${r.details}`).join("\n");

  const sections = [
    section(
      "overview",
      "Workspace Overview",
      overviewBody,
      [{ description: `Computed from ${assetCount} active assets via computeEvidenceQualityMetrics().`, confidence: undefined }]
    ),
    section(
      "data-health",
      "Data Health Findings",
      findingsBody,
      healthFindings.map((f) => citeScopedFinding(db, f.scopeId, f.description, f.findingType)),
      healthFindings.length === 0
    ),
    section(
      "integrity",
      "Integrity Issues",
      integrityBody,
      integrityIssues.map((i) => citeScopedFinding(db, i.scopeId, i.description, i.issueType)),
      integrityIssues.length === 0
    ),
    section("validation", "Knowledge Validation Results", validationBody, [], true),
  ];

  return {
    reportType: "workspace_health",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: null,
    caseTitle: null,
    generatedAt: new Date().toISOString(),
    title: `Workspace Health Report — ${workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
