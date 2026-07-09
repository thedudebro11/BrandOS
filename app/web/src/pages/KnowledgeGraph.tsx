import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, type GraphData, type GraphNode, type GraphNodeType, type NodeDetail, type PathKind } from "../api";
import { GraphCanvas } from "../components/GraphCanvas";
import { NodeInspectorPanel } from "../components/NodeInspectorPanel";

const HUB_TYPES = new Set(["workspace", "case", "report", "plugin", "evidence"]);
const ALL_TYPES = ["workspace", "asset", "case", "evidence", "timeline_event", "tag", "report", "obsidian_note", "plugin"] as const;
const TYPE_COLORS: Record<string, string> = {
  workspace: "#e8a33d",
  asset: "#5b7fb5",
  case: "#4fa97e",
  evidence: "#a37fd1",
  timeline_event: "#8b8fa3",
  tag: "#5c6079",
  report: "#d9634b",
  obsidian_note: "#7a6a4f",
  plugin: "#4a90a4",
};

function nodeKey(n: { type: string; id: number }) {
  return `${n.type}:${n.id}`;
}

/**
 * Phase 9 Section 1 — the interactive Knowledge Graph. Fetches the full
 * graph once (buildGraph() output is a single, already-cheap query-time
 * view — see graph-engine.ts), then renders only a small default subset
 * and grows it on demand as the user expands nodes ("lazy loading" /
 * "incremental expansion," Section 7): the fetch is not what's expensive at
 * this data scale, laying out and rendering every node at once is, so that's
 * exactly what stays deferred until asked for.
 */
export function KnowledgeGraph() {
  const { workspaceId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const focusType = searchParams.get("focusType") as GraphNodeType | null;
  const focusId = searchParams.get("focusId");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(ALL_TYPES));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [pathMode, setPathMode] = useState(false);
  const [pathFrom, setPathFrom] = useState<GraphNode | null>(null);
  const [pathKind, setPathKind] = useState<PathKind>("shortest");
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string> | undefined>(undefined);
  const [pathStatus, setPathStatus] = useState<string | null>(null);

  useEffect(() => {
    api.graph(workspaceId).then((g) => {
      setGraph(g);
      const initial = new Set(g.nodes.filter((n) => HUB_TYPES.has(n.type)).map(nodeKey));
      // Deep-link support (Timeline Explorer's "View in Knowledge Graph" links here): bring the focused node and its immediate neighbors into view on load.
      if (focusType && focusId) {
        const focusedKey = `${focusType}:${focusId}`;
        initial.add(focusedKey);
        for (const e of g.edges) {
          if (`${e.fromType}:${e.fromId}` === focusedKey) initial.add(`${e.toType}:${e.toId}`);
          if (`${e.toType}:${e.toId}` === focusedKey) initial.add(`${e.fromType}:${e.fromId}`);
        }
        const focusedNode = g.nodes.find((n) => nodeKey(n) === focusedKey);
        if (focusedNode) {
          setSelected(focusedNode);
          api.graphNode(workspaceId, focusedNode.type, focusedNode.id).then(setDetail);
        }
      }
      setVisible(initial);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const nodeByKey = useMemo(() => {
    const map = new Map<string, GraphNode>();
    if (graph) for (const n of graph.nodes) map.set(nodeKey(n), n);
    return map;
  }, [graph]);

  const adjacency = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!graph) return map;
    for (const e of graph.edges) {
      const a = `${e.fromType}:${e.fromId}`;
      const b = `${e.toType}:${e.toId}`;
      if (!map.has(a)) map.set(a, []);
      if (!map.has(b)) map.set(b, []);
      map.get(a)!.push(b);
      map.get(b)!.push(a);
    }
    return map;
  }, [graph]);

  const searchLower = search.trim().toLowerCase();
  const displayedNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => visible.has(nodeKey(n)) && typeFilter.has(n.type));
  }, [graph, visible, typeFilter]);
  const displayedKeys = useMemo(() => new Set(displayedNodes.map(nodeKey)), [displayedNodes]);
  const displayedEdges = useMemo(() => {
    if (!graph) return [];
    return graph.edges.filter((e) => displayedKeys.has(`${e.fromType}:${e.fromId}`) && displayedKeys.has(`${e.toType}:${e.toId}`));
  }, [graph, displayedKeys]);

  const searchMatches = searchLower ? displayedNodes.filter((n) => n.label.toLowerCase().includes(searchLower)) : [];

  function expandOrCollapse(node: GraphNode) {
    const key = nodeKey(node);
    const neighbors = adjacency.get(key) ?? [];
    setVisible((prev) => {
      const next = new Set(prev);
      const allNeighborsVisible = neighbors.every((n) => prev.has(n));
      if (allNeighborsVisible && neighbors.length > 0) {
        // Collapse: remove neighbors that would become orphaned (not needed by any other visible node).
        for (const nb of neighbors) {
          const nbNeighbors = adjacency.get(nb) ?? [];
          const stillNeeded = nbNeighbors.some((x) => x !== key && next.has(x));
          if (!stillNeeded && !HUB_TYPES.has(nb.split(":")[0])) next.delete(nb);
        }
      } else {
        for (const nb of neighbors) next.add(nb);
      }
      return next;
    });
  }

  async function handleNodeClick(node: GraphNode) {
    if (pathMode) {
      if (!pathFrom) {
        setPathFrom(node);
        setPathStatus(`From: ${node.label}. Click a second node to find the path.`);
        return;
      }
      setPathStatus("Searching…");
      const result = await api.graphPath(workspaceId, { type: pathFrom.type, id: pathFrom.id }, { type: node.type, id: node.id }, pathKind);
      if (!result.found) {
        setPathStatus(`No ${pathKind} path found between "${pathFrom.label}" and "${node.label}".`);
        setHighlightedEdges(undefined);
      } else {
        const edgeKeys = new Set<string>();
        const newlyVisible = new Set(visible);
        for (const step of result.steps) newlyVisible.add(nodeKey(step.node));
        for (let i = 1; i < result.steps.length; i++) {
          edgeKeys.add(`${nodeKey(result.steps[i - 1].node)}->${nodeKey(result.steps[i].node)}`);
        }
        setVisible(newlyVisible);
        setHighlightedEdges(edgeKeys);
        setPathStatus(`Path found: ${result.steps.length} step(s).`);
      }
      setPathFrom(null);
      return;
    }
    setSelected(node);
    setHighlightedEdges(undefined);
    const d = await api.graphNode(workspaceId, node.type, node.id);
    setDetail(d);
    expandOrCollapse(node);
  }

  function toggleType(type: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (!graph) return <div className="muted">Loading graph…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Knowledge Graph</h1>
      </div>

      <div className="graph-toolbar">
        <input type="text" placeholder="Search visible nodes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {searchLower && <span className="muted mono" style={{ fontSize: 11 }}>{searchMatches.length} match(es)</span>}
        {ALL_TYPES.map((t) => (
          <span key={t} className={`filter-chip${typeFilter.has(t) ? " active" : ""}`} onClick={() => toggleType(t)}>
            <span className="swatch" style={{ background: TYPE_COLORS[t] }} />
            {t}
          </span>
        ))}
        <span
          className={`filter-chip${pathMode ? " active" : ""}`}
          onClick={() => {
            setPathMode((p) => !p);
            setPathFrom(null);
            setPathStatus(pathMode ? null : "Path mode: click a starting node.");
            setHighlightedEdges(undefined);
          }}
        >
          {pathMode ? "Exit path mode" : "Find a path"}
        </span>
        {pathMode && (
          <select value={pathKind} onChange={(e) => setPathKind(e.target.value as PathKind)} className="pill" style={{ cursor: "pointer" }}>
            <option value="shortest">shortest</option>
            <option value="evidence">evidence</option>
            <option value="relationship">relationship</option>
            <option value="timeline">timeline</option>
            <option value="case">case</option>
            <option value="dependency">dependency</option>
          </select>
        )}
      </div>
      {pathStatus && (
        <p className="muted" style={{ fontSize: 11, marginTop: -6, marginBottom: 10 }}>
          {pathStatus}
        </p>
      )}

      <div className="graph-page-layout">
        <GraphCanvas
          nodes={displayedNodes}
          edges={displayedEdges}
          selectedKey={selected ? nodeKey(selected) : undefined}
          highlightedEdgeKeys={highlightedEdges}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
        <NodeInspectorPanel
          workspaceId={workspaceId}
          detail={detail}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        Showing {displayedNodes.length} of {graph.nodes.length} nodes. Click a node to inspect and expand its neighbors; click it again to collapse.
      </p>
    </div>
  );
}
