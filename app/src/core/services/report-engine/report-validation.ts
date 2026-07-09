import type { ReportData } from "./report-types";

export type ReportValidationFindingType =
  | "missing_citation"
  | "empty_section"
  | "missing_version"
  | "missing_generated_at"
  | "empty_report"
  | "citation_asset_not_indexed";

export interface ReportValidationFinding {
  findingType: ReportValidationFindingType;
  severity: "info" | "warning" | "critical";
  sectionId: string | null;
  description: string;
}

/**
 * Real, structural checks against a generated report — not a re-scoring of
 * its content (that would duplicate whatever engine already scored it).
 * Enforces the Phase 8 hard rule mechanically: every section that isn't
 * explicitly marked `allowEmptyCitations` must carry at least one citation,
 * so "every claim must cite Asset IDs, timeline events, provenance,
 * confidence, and supporting sources" is a checked fact about the output,
 * not just an instruction to the code that produced it.
 */
export function validateReport(data: ReportData): ReportValidationFinding[] {
  const findings: ReportValidationFinding[] = [];

  if (!data.version) {
    findings.push({ findingType: "missing_version", severity: "critical", sectionId: null, description: "Report has no version set." });
  }
  if (!data.generatedAt) {
    findings.push({
      findingType: "missing_generated_at",
      severity: "critical",
      sectionId: null,
      description: "Report has no generatedAt timestamp.",
    });
  }
  if (data.sections.length === 0) {
    findings.push({ findingType: "empty_report", severity: "critical", sectionId: null, description: "Report has zero sections." });
  }

  const citedAssetIds = new Set(data.citationIndex.map((c) => c.assetId).filter((id): id is string => !!id));

  for (const section of data.sections) {
    if (section.body.trim().length === 0) {
      findings.push({
        findingType: "empty_section",
        severity: "warning",
        sectionId: section.id,
        description: `Section "${section.title}" has no body text.`,
      });
    }
    if (section.citations.length === 0 && !section.allowEmptyCitations) {
      findings.push({
        findingType: "missing_citation",
        severity: "critical",
        sectionId: section.id,
        description: `Section "${section.title}" makes claims with zero citations and is not marked allowEmptyCitations.`,
      });
    }
    for (const citation of section.citations) {
      if (citation.assetId && !citedAssetIds.has(citation.assetId)) {
        // Defensive: buildCitationIndex() dedupes from these same sections, so this should never fire — a real mismatch would mean a section's citation was added after the index was built.
        findings.push({
          findingType: "citation_asset_not_indexed",
          severity: "warning",
          sectionId: section.id,
          description: `Citation for asset ${citation.assetId} in section "${section.title}" is not present in the report's citation index.`,
        });
      }
    }
  }

  return findings;
}
