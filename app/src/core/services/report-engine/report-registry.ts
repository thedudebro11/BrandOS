import type { ReportDefinition, ReportType } from "./report-types";
import { generateTrademarkReadinessReport } from "./reports/trademark-readiness-report";
import { generatePriorityOfUseDossier } from "./reports/priority-of-use-dossier";
import { generateEvidenceBinder } from "./reports/evidence-binder";
import { generateBrandHistoryReport } from "./reports/brand-history-report";
import { generateCaseSummaryReport } from "./reports/case-summary-report";
import { generateMissingEvidenceReport } from "./reports/missing-evidence-report";
import { generateNeedsReviewReport } from "./reports/needs-review-report";
import { generateDuplicateAssetsReport } from "./reports/duplicate-assets-report";
import { generateWorkspaceHealthReport } from "./reports/workspace-health-report";

/**
 * Every report type BrandOS can generate, and nothing else — the report
 * generator (report-generator.ts) never branches on report type directly;
 * it only ever calls `definition.generate()`. Adding a tenth report type
 * means adding one entry here and one file under reports/, never touching
 * the generator, renderers, or validation engine.
 */
export const REPORT_REGISTRY: Record<ReportType, ReportDefinition> = {
  trademark_readiness: {
    type: "trademark_readiness",
    title: "Trademark Readiness Report",
    description: "Readiness score, specimen readiness, priority/continuous use strength, evidence quality, unresolved risks, recommended actions. Not legal advice.",
    scope: "workspace",
    generate: generateTrademarkReadinessReport,
  },
  priority_of_use_dossier: {
    type: "priority_of_use_dossier",
    title: "Priority of Use Dossier",
    description: "Earliest known brand/logo/product/commercial/marketplace evidence, continuous use analysis, missing evidence, conflicts.",
    scope: "workspace",
    generate: generatePriorityOfUseDossier,
  },
  evidence_binder: {
    type: "evidence_binder",
    title: "Evidence Binder",
    description: "Executive summary, timeline, strongest/weakest evidence, missing evidence, conflicts, chain of custody, hash references. Workspace-wide or case-scoped.",
    scope: "either",
    generate: generateEvidenceBinder,
  },
  brand_history: {
    type: "brand_history",
    title: "Brand History Report",
    description: "A chronological narrative of dated evidence across the workspace.",
    scope: "workspace",
    generate: generateBrandHistoryReport,
  },
  case_summary: {
    type: "case_summary",
    title: "Case Summary Report",
    description: "A single case's status, evidence strength, supporting assets, conflicts, and related cases.",
    scope: "case",
    generate: generateCaseSummaryReport,
  },
  missing_evidence: {
    type: "missing_evidence",
    title: "Missing Evidence Report",
    description: "Every open evidence gap for the workspace, by priority.",
    scope: "workspace",
    generate: generateMissingEvidenceReport,
  },
  needs_review: {
    type: "needs_review",
    title: "Needs Review Report",
    description: "The open Human Review Queue.",
    scope: "workspace",
    generate: generateNeedsReviewReport,
  },
  duplicate_assets: {
    type: "duplicate_assets",
    title: "Duplicate Assets Report",
    description: "Every exact SHA-256 duplicate group in the workspace.",
    scope: "workspace",
    generate: generateDuplicateAssetsReport,
  },
  workspace_health: {
    type: "workspace_health",
    title: "Workspace Health Report",
    description: "Evidence quality metrics, data health findings, integrity issues, and knowledge validation results.",
    scope: "workspace",
    generate: generateWorkspaceHealthReport,
  },
};

export function listReportDefinitions(): ReportDefinition[] {
  return Object.values(REPORT_REGISTRY);
}

export function getReportDefinition(type: ReportType): ReportDefinition {
  const def = REPORT_REGISTRY[type];
  if (!def) throw new Error(`Unknown report type "${type}". Known types: ${Object.keys(REPORT_REGISTRY).join(", ")}`);
  return def;
}
