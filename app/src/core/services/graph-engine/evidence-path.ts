import type { WorkspaceDatabase } from "../../db/connection";
import type { GraphEdge, GraphNode, GraphNodeType } from "../../types";
import { buildGraph } from "./graph-engine";

export interface EvidenceTraceStep {
  node: GraphNode;
  viaEdge: GraphEdge | null;
  depth: number;
}

/**
 * Phase 9 Section 3 — traces everything one asset's evidence trail reaches
 * (its relationships, the cases it's linked to, the evidence assessments
 * and reports built on top of those cases), not just a single point-to-point
 * path. Same "evidence" edge filter as path-discovery.ts's evidencePath
 * kind (structural, not workspace-specific), applied as a full breadth-first
 * reachability trace instead of a single shortest path — every step is
 * still exactly one hop from a real, already-existing edge, so "everything
 * remains traceable" (Section 3's closing requirement) holds by construction.
 */
export function traceEvidencePath(db: WorkspaceDatabase, from: { type: GraphNodeType; id: number }): EvidenceTraceStep[] {
  const { nodes, edges } = buildGraph(db);
  const nodeById = new Map(nodes.map((n) => [`${n.type}:${n.id}`, n]));
  const fromKey = `${from.type}:${from.id}`;
  if (!nodeById.has(fromKey)) return [];

  const relevantEdges = edges.filter((e) => e.edgeType !== "tagged" && e.edgeType !== "has_plugin");
  const adjacency = new Map<string, { neighborKey: string; edge: GraphEdge }[]>();
  const addEdge = (a: string, b: string, edge: GraphEdge) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ neighborKey: b, edge });
  };
  for (const e of relevantEdges) {
    const a = `${e.fromType}:${e.fromId}`;
    const b = `${e.toType}:${e.toId}`;
    addEdge(a, b, e);
    addEdge(b, a, e);
  }

  const visited = new Map<string, EvidenceTraceStep>();
  visited.set(fromKey, { node: nodeById.get(fromKey)!, viaEdge: null, depth: 0 });
  const queue = [fromKey];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const depth = visited.get(current)!.depth;
    for (const { neighborKey, edge } of adjacency.get(current) ?? []) {
      if (visited.has(neighborKey)) continue;
      const node = nodeById.get(neighborKey);
      if (!node) continue;
      visited.set(neighborKey, { node, viaEdge: edge, depth: depth + 1 });
      queue.push(neighborKey);
    }
  }

  return Array.from(visited.values()).sort((a, b) => a.depth - b.depth);
}
