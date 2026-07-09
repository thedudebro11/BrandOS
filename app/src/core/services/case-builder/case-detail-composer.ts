import type { WorkspaceDatabase } from "../../db/connection";
import { getCase, latestEvidenceAssessments, listCaseLinks, listRelatedCases } from "../../db/knowledge-repositories";
import { getAssetIntelligence, type AssetIntelligenceView } from "../asset-intelligence/asset-intelligence";
import { findConflictingAssets } from "../evidence-provenance-engine/evidence-provenance-engine";
import { CaseBuilderService } from "./case-builder-service";
import type { CaseRecord, EvidenceAssessment } from "../../types";

export interface CaseDetailComposition {
  theCase: CaseRecord;
  links: ReturnType<typeof listCaseLinks>;
  supportingAssets: AssetIntelligenceView[];
  timeline: Record<string, unknown>[];
  conflicts: AssetIntelligenceView[];
  missingEvidence: Record<string, unknown>[];
  evidenceStrength: EvidenceAssessment | undefined;
  relatedCases: ReturnType<typeof listRelatedCases>;
}

/**
 * The full case-detail composition — supporting assets, timeline, conflicts,
 * missing evidence, evidence strength, related cases — extracted from the
 * API's case-detail route (Phase 4.5) so the API and Phase 8's Case Summary
 * Report/Evidence Binder call the same function instead of each
 * re-implementing the same joins (ARCHITECTURE_PRINCIPLES.md "no duplicate
 * logic"). Recomputes evidence strength before reading it, same as the route
 * always has, so a report is never built from a stale assessment.
 */
export function composeCaseDetail(db: WorkspaceDatabase, caseId: number): CaseDetailComposition | undefined {
  const theCase = getCase(db, caseId);
  if (!theCase) return undefined;

  new CaseBuilderService(db).recomputeEvidenceStrength(caseId);

  const links = listCaseLinks(db, caseId);
  const assetLinks = links.filter((l) => l.linkedType === "asset");
  const timelineLinks = links.filter((l) => l.linkedType === "timeline_event");

  const supportingAssets = assetLinks
    .map((l) => {
      const asset = db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [l.linkedId]);
      return asset ? getAssetIntelligence(db, asset.asset_id) : undefined;
    })
    .filter((a): a is AssetIntelligenceView => !!a);

  const timeline = timelineLinks
    .map((l) => db.get("SELECT * FROM timeline_events WHERE id = ?", [l.linkedId]))
    .filter(Boolean) as Record<string, unknown>[];

  const conflicts = findConflictingAssets(db, supportingAssets);
  const missingEvidence = db.all("SELECT * FROM case_missing_evidence WHERE case_id = ?", [caseId]) as Record<string, unknown>[];
  const evidenceStrength = latestEvidenceAssessments(db, "case", caseId).find((a) => a.dimension === "strength");
  const relatedCases = listRelatedCases(db, caseId);

  return { theCase, links, supportingAssets, timeline, conflicts, missingEvidence, evidenceStrength, relatedCases };
}
