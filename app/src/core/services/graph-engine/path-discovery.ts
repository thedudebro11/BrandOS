import type { WorkspaceDatabase } from "../../db/connection";
import type { GraphEdge, GraphNode, GraphNodeType } from "../../types";
import { buildGraph } from "./graph-engine";

export type PathKind = "shortest" | "evidence" | "relationship" | "timeline" | "case" | "dependency";

export interface PathStep {
  node: GraphNode;
  /** The edge that led to this step from the previous one; null for the starting node. */
  viaEdge: GraphEdge | null;
}

export interface PathResult {
  kind: PathKind;
  found: boolean;
  steps: PathStep[];
}

function nodeKey(type: GraphNodeType, id: number): string {
  return `${type}:${id}`;
}

/**
 * Every path kind below is the SAME breadth-first search over the SAME
 * graph data `buildGraph()` already produces — only which edges a given
 * kind is allowed to follow differs (Phase 9 Section 6: "these should use
 * the existing graph data," not a new traversal per kind). Filters are
 * structural (node types / edge type), never a per-workspace or per-brand
 * literal, so they hold for any workspace unchanged.
 */
const EDGE_FILTERS: Record<PathKind, (e: GraphEdge) => boolean> = {
  shortest: () => true,
  // A relationship path only ever moves asset -> asset (any relationship_type recorded by the Relationship Engine, not just source_to_export).
  relationship: (e) => e.fromType === "asset" && e.toType === "asset",
  // A timeline path only ever moves along timeline_of edges (asset <-> timeline_event).
  timeline: (e) => e.edgeType === "timeline_of",
  // A case path moves along anything that structurally connects a case to what it contains or produces.
  case: (e) => e.edgeType === "case_link" || e.edgeType === "has_case" || e.edgeType === "has_report",
  // An evidence path is deliberately the broadest kind — it's meant to trace
  // "how did we get from this asset to this evidentiary conclusion," which
  // legitimately crosses relationship, case, and evidence-assessment edges.
  // It excludes only the purely organizational edges (tags, plugin
  // registration) that carry no evidentiary weight.
  evidence: (e) => e.edgeType !== "tagged" && e.edgeType !== "has_plugin",
  // A dependency path is directional: asset -> asset only in the recorded
  // from -> to direction (source produced this export, not the reverse).
  dependency: (e) => e.fromType === "asset" && e.toType === "asset",
};

/** Whether a dependency-path traversal may use this edge in this direction from `currentKey`. */
function dependencyDirectionAllowed(e: GraphEdge, currentKey: string): boolean {
  return nodeKey(e.fromType, e.fromId) === currentKey;
}

/**
 * Breadth-first search — unweighted, since no edge here carries a
 * traversal "cost," only a confidence score, which is not the same thing
 * and should never be conflated with distance.
 */
export function findPath(db: WorkspaceDatabase, kind: PathKind, from: { type: GraphNodeType; id: number }, to: { type: GraphNodeType; id: number }): PathResult {
  const { nodes, edges } = buildGraph(db);
  const nodeById = new Map(nodes.map((n) => [nodeKey(n.type, n.id), n]));
  const fromKey = nodeKey(from.type, from.id);
  const toKey = nodeKey(to.type, to.id);

  if (!nodeById.has(fromKey) || !nodeById.has(toKey)) {
    return { kind, found: false, steps: [] };
  }

  const filter = EDGE_FILTERS[kind];
  const adjacency = new Map<string, { neighborKey: string; edge: GraphEdge }[]>();
  const addEdge = (a: string, b: string, edge: GraphEdge) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ neighborKey: b, edge });
  };
  for (const e of edges) {
    if (!filter(e)) continue;
    const a = nodeKey(e.fromType, e.fromId);
    const b = nodeKey(e.toType, e.toId);
    if (kind === "dependency") {
      // Directional: only a -> b, never the reverse.
      addEdge(a, b, e);
    } else {
      addEdge(a, b, e);
      addEdge(b, a, e);
    }
  }

  if (fromKey === toKey) {
    return { kind, found: true, steps: [{ node: nodeById.get(fromKey)!, viaEdge: null }] };
  }

  const visited = new Set<string>([fromKey]);
  const cameFrom = new Map<string, { prevKey: string; edge: GraphEdge }>();
  const queue: string[] = [fromKey];
  let head = 0;
  let reached = false;

  while (head < queue.length) {
    const current = queue[head++];
    if (current === toKey) {
      reached = true;
      break;
    }
    for (const { neighborKey, edge } of adjacency.get(current) ?? []) {
      if (kind === "dependency" && !dependencyDirectionAllowed(edge, current)) continue;
      if (visited.has(neighborKey)) continue;
      visited.add(neighborKey);
      cameFrom.set(neighborKey, { prevKey: current, edge });
      queue.push(neighborKey);
    }
  }

  if (!reached && !visited.has(toKey)) {
    return { kind, found: false, steps: [] };
  }

  // Reconstruct: walk backward from `to` via cameFrom, then reverse.
  const stepsReversed: PathStep[] = [];
  let cursor = toKey;
  while (cursor !== fromKey) {
    const entry = cameFrom.get(cursor);
    if (!entry) return { kind, found: false, steps: [] }; // defensive — should be unreachable given the visited check above
    stepsReversed.push({ node: nodeById.get(cursor)!, viaEdge: entry.edge });
    cursor = entry.prevKey;
  }
  stepsReversed.push({ node: nodeById.get(fromKey)!, viaEdge: null });

  return { kind, found: true, steps: stepsReversed.reverse() };
}
