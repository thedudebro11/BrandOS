import type { WorkspaceDatabase } from "../../db/connection";
import type { GraphEdge, GraphNode, GraphNodeType } from "../../types";

/**
 * The graph is a query-time view over normalized tables (relationships,
 * case_links, asset_tags, timeline_events), not a second store — per
 * ARCHITECTURE_PRINCIPLES.md #8, "no duplicated information." Node/edge shape
 * is generic (type + id + label) so a future visualization layer can render
 * it without knowing about SQL at all.
 */
export function buildGraph(db: WorkspaceDatabase): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const assets = db.all<{ id: number; filename: string }>("SELECT id, filename FROM assets WHERE status = 'active'");
  for (const a of assets) nodes.push({ type: "asset", id: a.id, label: a.filename });

  const cases = db.all<{ id: number; title: string }>("SELECT id, title FROM cases");
  for (const c of cases) nodes.push({ type: "case", id: c.id, label: c.title });

  const tags = db.all<{ id: number; name: string }>("SELECT id, name FROM tags");
  for (const t of tags) nodes.push({ type: "tag", id: t.id, label: t.name });

  const events = db.all<{ id: number; title: string }>("SELECT id, title FROM timeline_events");
  for (const e of events) nodes.push({ type: "timeline_event", id: e.id, label: e.title });

  const rels = db.all<{ from_asset_id: number; to_asset_id: number; relationship_type: string; confidence: number }>(
    "SELECT from_asset_id, to_asset_id, relationship_type, confidence FROM relationships"
  );
  for (const r of rels) {
    edges.push({
      fromType: "asset",
      fromId: r.from_asset_id,
      toType: "asset",
      toId: r.to_asset_id,
      edgeType: r.relationship_type,
      confidence: r.confidence,
    });
  }

  const caseLinks = db.all<{ case_id: number; linked_type: string; linked_id: number }>(
    "SELECT case_id, linked_type, linked_id FROM case_links"
  );
  for (const cl of caseLinks) {
    if (cl.linked_type !== "asset" && cl.linked_type !== "timeline_event") continue;
    edges.push({
      fromType: "case",
      fromId: cl.case_id,
      toType: cl.linked_type as GraphNodeType,
      toId: cl.linked_id,
      edgeType: "case_link",
      confidence: null,
    });
  }

  const assetTags = db.all<{ asset_id: number; tag_id: number; confidence: number }>(
    "SELECT asset_id, tag_id, confidence FROM asset_tags"
  );
  for (const at of assetTags) {
    edges.push({
      fromType: "asset",
      fromId: at.asset_id,
      toType: "tag",
      toId: at.tag_id,
      edgeType: "tagged",
      confidence: at.confidence,
    });
  }

  const timelineAssetLinks = db.all<{ id: number; asset_id: number | null }>(
    "SELECT id, asset_id FROM timeline_events WHERE asset_id IS NOT NULL"
  );
  for (const t of timelineAssetLinks) {
    if (t.asset_id === null) continue;
    edges.push({
      fromType: "timeline_event",
      fromId: t.id,
      toType: "asset",
      toId: t.asset_id,
      edgeType: "timeline_of",
      confidence: null,
    });
  }

  return { nodes, edges };
}

export function getNeighbors(
  db: WorkspaceDatabase,
  nodeType: GraphNodeType,
  nodeId: number
): { node: GraphNode; edge: GraphEdge }[] {
  const { nodes, edges } = buildGraph(db);
  const nodeById = new Map(nodes.map((n) => [`${n.type}:${n.id}`, n]));
  const results: { node: GraphNode; edge: GraphEdge }[] = [];

  for (const e of edges) {
    if (e.fromType === nodeType && e.fromId === nodeId) {
      const n = nodeById.get(`${e.toType}:${e.toId}`);
      if (n) results.push({ node: n, edge: e });
    } else if (e.toType === nodeType && e.toId === nodeId) {
      const n = nodeById.get(`${e.fromType}:${e.fromId}`);
      if (n) results.push({ node: n, edge: e });
    }
  }
  return results;
}
