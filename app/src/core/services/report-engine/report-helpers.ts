import type { WorkspaceDatabase } from "../../db/connection";
import type { AssetIntelligenceView } from "../asset-intelligence/asset-intelligence";
import type { EvidenceGap, IntegrityIssue } from "../../types";
import type { Citation, ReportSection } from "./report-types";

/**
 * Checks the real obsidian_notes table (Phase 6) for this asset's generated
 * note — "reports should be able to reference Obsidian notes when
 * available" (Phase 8 spec) means exactly this: a real lookup, null when
 * the vault hasn't been generated for this workspace/asset, never assumed.
 */
export function obsidianNotePathFor(db: WorkspaceDatabase, assetId: string): string | undefined {
  const row = db.get<{ vault_path: string }>(
    "SELECT vault_path FROM obsidian_notes WHERE entity_type = 'asset' AND entity_id = ?",
    [assetId]
  );
  return row?.vault_path;
}

/** Builds a Citation from a real asset, with resolved-date confidence/reasoning and an Obsidian cross-reference when available — never invented fields. */
export function citeAsset(db: WorkspaceDatabase, view: AssetIntelligenceView, description: string): Citation {
  return {
    assetId: view.asset.assetId,
    description,
    confidence: view.resolvedDate?.confidence,
    sourceType: view.resolvedDate?.sourceType,
    obsidianNotePath: obsidianNotePathFor(db, view.asset.assetId),
  };
}

export function citeTimelineEvent(eventId: number, description: string, confidence?: number): Citation {
  return { timelineEventId: eventId, description, confidence };
}

export function citeCase(caseId: number, description: string): Citation {
  return { caseId, description };
}

/** scopeId on a gap/issue is a numeric asset id only when scopeType is asset-shaped — most Phase 3 evidence gaps are workspace-level (scopeId null), which legitimately produces a citation with no assetId (still a valid citation: a description-only, report-level source). Resolved defensively, never assumed. */
function citeScoped(db: WorkspaceDatabase, scopeType: string | null, scopeId: number | null, description: string, sourceType: string): Citation {
  const asset = scopeType === "asset" && scopeId !== null ? db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [scopeId]) : undefined;
  return {
    assetId: asset?.asset_id,
    description,
    sourceType,
    obsidianNotePath: asset ? obsidianNotePathFor(db, asset.asset_id) : undefined,
  };
}

export function citeGap(db: WorkspaceDatabase, gap: EvidenceGap): Citation {
  return citeScoped(db, gap.scopeType, gap.scopeId, gap.description, gap.gapType);
}

export function citeIntegrityIssue(db: WorkspaceDatabase, issue: IntegrityIssue): Citation {
  return citeScoped(db, issue.scopeType, issue.scopeId, issue.description, issue.issueType);
}

function citationKey(c: Citation): string {
  return [c.assetId ?? "", c.timelineEventId ?? "", c.caseId ?? "", c.description].join("|");
}

/** Deduplicates the flattened citation list across every section — the report's appendix, not a re-derivation. */
export function buildCitationIndex(sections: ReportSection[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const section of sections) {
    for (const citation of section.citations) {
      const key = citationKey(citation);
      if (!seen.has(key)) seen.set(key, citation);
    }
  }
  return Array.from(seen.values());
}

export function section(
  id: string,
  title: string,
  body: string,
  citations: Citation[],
  allowEmptyCitations = false
): ReportSection {
  return { id, title, body, citations, allowEmptyCitations };
}
