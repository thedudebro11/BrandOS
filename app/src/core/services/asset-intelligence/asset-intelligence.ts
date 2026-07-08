import type { WorkspaceDatabase } from "../../db/connection";
import { findAssetByAssetId } from "../../db/repositories";
import { getAssetTags, getClassification, listAssetNotes } from "../../db/knowledge-repositories";
import { getProvenanceChain } from "../provenance-engine/provenance-engine";
import { CaseBuilderService } from "../case-builder/case-builder-service";
import type { AssetRecord, AssetTagRecord, ClassificationRecord, MetadataRecord, ProvenanceStep } from "../../types";

export interface AssetIntelligenceView {
  asset: AssetRecord;
  metadata: MetadataRecord[];
  classification: ClassificationRecord | undefined;
  tags: AssetTagRecord[];
  relationships: { direction: "outgoing" | "incoming"; otherAssetId: number; type: string; confidence: number }[];
  timelineEvents: { id: number; eventType: string; eventDate: string; title: string; confidence: number }[];
  provenance: ProvenanceStep[];
  linkedCases: { id: number; title: string; caseType: string }[];
  notes: { note: string; author: string; createdAt: string }[];
}

/**
 * "Extend every asset with..." (Phase 3 spec) is implemented as a read-time
 * composition over normalized tables, not new columns on `assets` or a
 * second copy of any fact — every field below is fetched by Asset ID from
 * the table that actually owns it (ARCHITECTURE_PRINCIPLES.md #2, #8). This
 * is the one function the future dashboard, report, and Obsidian layers are
 * meant to call instead of each re-querying the schema themselves.
 */
export function getAssetIntelligence(db: WorkspaceDatabase, assetId: string): AssetIntelligenceView | undefined {
  const asset = findAssetByAssetId(db, assetId);
  if (!asset) return undefined;

  const metadata = db
    .all<{ key: string; value: string; source: "extracted" | "inferred"; confidence: number }>(
      "SELECT key, value, source, confidence FROM metadata WHERE asset_id = ?",
      [asset.id]
    )
    .map((r) => ({ key: r.key, value: r.value, source: r.source, confidence: r.confidence }));

  const relationships = [
    ...db
      .all<{ to_asset_id: number; relationship_type: string; confidence: number }>(
        "SELECT to_asset_id, relationship_type, confidence FROM relationships WHERE from_asset_id = ?",
        [asset.id]
      )
      .map((r) => ({
        direction: "outgoing" as const,
        otherAssetId: r.to_asset_id,
        type: r.relationship_type,
        confidence: r.confidence,
      })),
    ...db
      .all<{ from_asset_id: number; relationship_type: string; confidence: number }>(
        "SELECT from_asset_id, relationship_type, confidence FROM relationships WHERE to_asset_id = ?",
        [asset.id]
      )
      .map((r) => ({
        direction: "incoming" as const,
        otherAssetId: r.from_asset_id,
        type: r.relationship_type,
        confidence: r.confidence,
      })),
  ];

  const timelineEvents = db.all<{ id: number; event_type: string; event_date: string; title: string; confidence: number }>(
    "SELECT id, event_type, event_date, title, confidence FROM timeline_events WHERE asset_id = ? ORDER BY event_date",
    [asset.id]
  ).map((r) => ({ id: r.id, eventType: r.event_type, eventDate: r.event_date, title: r.title, confidence: r.confidence }));

  const caseBuilder = new CaseBuilderService(db);
  const linkedCases = caseBuilder.casesForAsset(asset.id).map((c) => ({ id: c.id, title: c.title, caseType: c.caseType }));

  return {
    asset,
    metadata,
    classification: getClassification(db, asset.id),
    tags: getAssetTags(db, asset.id),
    relationships,
    timelineEvents,
    provenance: getProvenanceChain(db, asset.id),
    linkedCases,
    notes: listAssetNotes(db, asset.id),
  };
}
