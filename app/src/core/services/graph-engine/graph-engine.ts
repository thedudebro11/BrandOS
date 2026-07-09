import type { WorkspaceDatabase } from "../../db/connection";
import type { GraphEdge, GraphNode, GraphNodeType } from "../../types";

/** The single workspace row's node id — every workspace DB has exactly one workspace, so a fixed sentinel is safe and unique within this graph. */
export const WORKSPACE_NODE_ID = 0;

/**
 * The graph is a query-time view over normalized tables (relationships,
 * case_links, asset_tags, timeline_events, evidence_assessments, reports,
 * obsidian_notes, plugin_registrations), not a second store — per
 * ARCHITECTURE_PRINCIPLES.md #8, "no duplicated information." Node/edge shape
 * is generic (type + id + label) so the visualization layer (Phase 9) can
 * render it without knowing about SQL at all.
 *
 * Phase 9 extends this from 4 node types (asset/case/tag/timeline_event) to
 * all 9 the spec names. Every edge here traces to a real stored row — no
 * edge is inferred or invented (Phase 9 Section 9's hard rule). A report's
 * own citation index (which assets it cites) is NOT modeled as a graph edge
 * here — it would require reading a report's generated file off disk from
 * within an otherwise pure-database engine, a real architectural cost for a
 * "nice to have" edge when workspace/case -> report edges already make every
 * report reachable and traceable.
 */
export function buildGraph(db: WorkspaceDatabase): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const workspace = db.get<{ id: string; name: string; status: string }>("SELECT id, name, status FROM workspace LIMIT 1");
  if (workspace) {
    nodes.push({ type: "workspace", id: WORKSPACE_NODE_ID, label: workspace.name, subtitle: workspace.status });
  }

  const assets = db.all<{ id: number; filename: string; category: string | null }>(
    `SELECT a.id, a.filename, c.category
     FROM assets a LEFT JOIN classifications c ON c.asset_id = a.id
     WHERE a.status = 'active'`
  );
  for (const a of assets) nodes.push({ type: "asset", id: a.id, label: a.filename, subtitle: a.category ?? undefined });

  const cases = db.all<{ id: number; title: string; status: string }>("SELECT id, title, status FROM cases");
  for (const c of cases) {
    nodes.push({ type: "case", id: c.id, label: c.title, subtitle: c.status });
    if (workspace) edges.push({ fromType: "workspace", fromId: WORKSPACE_NODE_ID, toType: "case", toId: c.id, edgeType: "has_case", confidence: null });
  }

  const tags = db.all<{ id: number; name: string }>("SELECT id, name FROM tags");
  for (const t of tags) nodes.push({ type: "tag", id: t.id, label: t.name });

  const events = db.all<{ id: number; title: string; event_date: string }>("SELECT id, title, event_date FROM timeline_events");
  for (const e of events) nodes.push({ type: "timeline_event", id: e.id, label: e.title, subtitle: e.event_date?.slice(0, 10) });

  const reports = db.all<{ id: number; report_type: string; scope_type: string; scope_id: number | null; generated_at: string }>(
    "SELECT id, report_type, scope_type, scope_id, generated_at FROM reports"
  );
  for (const r of reports) {
    nodes.push({ type: "report", id: r.id, label: r.report_type, subtitle: r.generated_at?.slice(0, 10) });
    if (r.scope_type === "workspace" && workspace) {
      edges.push({ fromType: "workspace", fromId: WORKSPACE_NODE_ID, toType: "report", toId: r.id, edgeType: "has_report", confidence: null });
    } else if (r.scope_type === "case" && r.scope_id !== null) {
      edges.push({ fromType: "case", fromId: r.scope_id, toType: "report", toId: r.id, edgeType: "has_report", confidence: null });
    }
  }

  const notes = db.all<{ id: number; entity_type: string; entity_id: string; vault_path: string }>(
    "SELECT id, entity_type, entity_id, vault_path FROM obsidian_notes"
  );
  const assetByAssetId = new Map(db.all<{ id: number; asset_id: string }>("SELECT id, asset_id FROM assets").map((a) => [a.asset_id, a.id]));
  for (const n of notes) {
    nodes.push({ type: "obsidian_note", id: n.id, label: n.vault_path });
    if (n.entity_type === "asset") {
      const assetId = assetByAssetId.get(n.entity_id);
      if (assetId !== undefined) edges.push({ fromType: "obsidian_note", fromId: n.id, toType: "asset", toId: assetId, edgeType: "documents", confidence: null });
    } else if (n.entity_type === "case") {
      const caseId = Number(n.entity_id);
      if (!Number.isNaN(caseId)) edges.push({ fromType: "obsidian_note", fromId: n.id, toType: "case", toId: caseId, edgeType: "documents", confidence: null });
    } else if (n.entity_type === "workspace" && workspace) {
      edges.push({ fromType: "obsidian_note", fromId: n.id, toType: "workspace", toId: WORKSPACE_NODE_ID, edgeType: "documents", confidence: null });
    }
  }

  const plugins = db.all<{ id: number; plugin_id: string; plugin_type: string; state: string }>(
    "SELECT id, plugin_id, plugin_type, state FROM plugin_registrations"
  );
  for (const p of plugins) {
    nodes.push({ type: "plugin", id: p.id, label: p.plugin_id, subtitle: p.state });
    if (workspace) edges.push({ fromType: "workspace", fromId: WORKSPACE_NODE_ID, toType: "plugin", toId: p.id, edgeType: "has_plugin", confidence: null });
  }

  // Evidence nodes: the LATEST assessment per (scope_type, scope_id, dimension)
  // only — evidence_assessments is an append-only history (by design, so a
  // score's trend is never lost), and the graph should show current state,
  // not every historical recomputation as a separate node.
  const allAssessments = db.all<{ id: number; scope_type: string; scope_id: number | null; dimension: string; score: number; status: string; computed_at: string }>(
    "SELECT id, scope_type, scope_id, dimension, score, status, computed_at FROM evidence_assessments ORDER BY computed_at DESC"
  );
  const seenAssessmentKeys = new Set<string>();
  for (const ea of allAssessments) {
    const key = `${ea.scope_type}:${ea.scope_id}:${ea.dimension}`;
    if (seenAssessmentKeys.has(key)) continue;
    seenAssessmentKeys.add(key);
    nodes.push({ type: "evidence", id: ea.id, label: `${ea.dimension} (${ea.score}/100)`, subtitle: ea.status });
    if (ea.scope_type === "workspace" && workspace) {
      edges.push({ fromType: "workspace", fromId: WORKSPACE_NODE_ID, toType: "evidence", toId: ea.id, edgeType: "assessed_as", confidence: ea.score });
    } else if (ea.scope_type === "case" && ea.scope_id !== null) {
      edges.push({ fromType: "case", fromId: ea.scope_id, toType: "evidence", toId: ea.id, edgeType: "assessed_as", confidence: ea.score });
    }
  }

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
    if (cl.linked_type === "report") continue; // already covered above via reports.scope_type='case' — avoid a duplicate edge for the same fact
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
