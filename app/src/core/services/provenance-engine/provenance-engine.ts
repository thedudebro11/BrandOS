import type { WorkspaceDatabase } from "../../db/connection";
import type { ProvenanceStep } from "../../types";

interface RelRow {
  from_asset_id: number;
  to_asset_id: number;
  relationship_type: string;
  confidence: number;
}

/**
 * Walks the relationships graph both directions from an asset to build its
 * full provenance chain (e.g. PSD -> PNG -> Printful Product -> Shipment ->
 * Instagram Post -> Customer Photo, per the Phase 3 spec's example chain).
 * Only traverses relationships that actually exist — it cannot manufacture a
 * step for a relationship type no importer has detected yet
 * (ARCHITECTURE_PRINCIPLES.md #4, never invent facts). Cycle-safe via a
 * visited set, so a bad/circular relationship can't infinite-loop this.
 */
export function getProvenanceChain(db: WorkspaceDatabase, assetId: number): ProvenanceStep[] {
  const rels = db.all<RelRow>(
    "SELECT from_asset_id, to_asset_id, relationship_type, confidence FROM relationships"
  );
  const assetLabels = new Map(
    db.all<{ id: number; filename: string }>("SELECT id, filename FROM assets").map((a) => [a.id, a.filename])
  );

  const upstream: ProvenanceStep[] = [];
  const downstream: ProvenanceStep[] = [];
  const visitedUp = new Set<number>([assetId]);
  const visitedDown = new Set<number>([assetId]);

  let frontier = [assetId];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const r of rels) {
        if (r.to_asset_id === current && !visitedUp.has(r.from_asset_id)) {
          visitedUp.add(r.from_asset_id);
          upstream.push({
            assetId: r.from_asset_id,
            assetLabel: assetLabels.get(r.from_asset_id) ?? `Asset ${r.from_asset_id}`,
            relationshipType: r.relationship_type,
            confidence: r.confidence,
            direction: "upstream",
          });
          next.push(r.from_asset_id);
        }
      }
    }
    frontier = next;
  }

  frontier = [assetId];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const r of rels) {
        if (r.from_asset_id === current && !visitedDown.has(r.to_asset_id)) {
          visitedDown.add(r.to_asset_id);
          downstream.push({
            assetId: r.to_asset_id,
            assetLabel: assetLabels.get(r.to_asset_id) ?? `Asset ${r.to_asset_id}`,
            relationshipType: r.relationship_type,
            confidence: r.confidence,
            direction: "downstream",
          });
          next.push(r.to_asset_id);
        }
      }
    }
    frontier = next;
  }

  const self: ProvenanceStep = {
    assetId,
    assetLabel: assetLabels.get(assetId) ?? `Asset ${assetId}`,
    relationshipType: null,
    confidence: null,
    direction: "self",
  };

  return [...upstream.reverse(), self, ...downstream];
}
