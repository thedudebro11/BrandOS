import { useEffect, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import type { GraphEdge, GraphNode } from "../api";

/**
 * A thin, controlled wrapper around Cytoscape (Phase 9) — this component
 * renders whatever nodes/edges it's given and reports interactions back up;
 * it never fetches data or decides what should be visible. Expansion,
 * filtering, and search all live in the page that owns this component
 * (KnowledgeGraph.tsx) — per Phase 9's hard rule that the visual layer only
 * exposes existing engine data, this file doesn't even know what a "case"
 * or "asset" means beyond a color lookup.
 */

const NODE_COLORS: Record<string, string> = {
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

const NODE_SHAPES: Record<string, string> = {
  workspace: "star",
  case: "round-rectangle",
  report: "diamond",
  evidence: "hexagon",
  plugin: "triangle",
};

export interface GraphCanvasHandle {
  fit: () => void;
  layout: () => void;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedKey,
  highlightedEdgeKeys,
  onNodeClick,
  onBackgroundClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey?: string;
  highlightedEdgeKeys?: Set<string>;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) => NODE_COLORS[ele.data("type")] ?? "#8b8fa3",
            shape: (ele: cytoscape.NodeSingular) => (NODE_SHAPES[ele.data("type")] as any) ?? "ellipse",
            label: "data(label)",
            "font-family": "IBM Plex Sans, sans-serif",
            "font-size": 9,
            color: "#e8e9ee",
            "text-outline-width": 1.5,
            "text-outline-color": "#121319",
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: 18,
            height: 18,
            "border-width": 0,
          },
        },
        {
          selector: "node.selected",
          style: { "border-width": 3, "border-color": "#e8a33d" },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#2a2d3a",
            "target-arrow-color": "#2a2d3a",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.6,
            opacity: 0.6,
          },
        },
        {
          selector: "edge.highlighted",
          style: { "line-color": "#e8a33d", "target-arrow-color": "#e8a33d", width: 2.5, opacity: 1 },
        },
      ],
      layout: { name: "cose", animate: false, fit: true, padding: 40 } as any,
      wheelSensitivity: 0.25,
      minZoom: 0.1,
      maxZoom: 4,
    });
    cyRef.current = cy;

    cy.on("tap", "node", (evt) => {
      const d = evt.target.data();
      onNodeClick({ type: d.type, id: Number(d.rawId), label: d.label, subtitle: d.subtitle });
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) onBackgroundClick?.();
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diff-update elements when nodes/edges change, rather than tearing down
  // the whole instance — this is what makes "incremental expansion" cheap:
  // expanding one node only adds its new neighbors, not a full re-render.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const elements: ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: `${n.type}:${n.id}`, rawId: n.id, type: n.type, label: n.label, subtitle: n.subtitle },
      })),
      ...edges.map((e, i) => ({
        data: {
          id: `e${i}:${e.fromType}:${e.fromId}-${e.toType}:${e.toId}`,
          source: `${e.fromType}:${e.fromId}`,
          target: `${e.toType}:${e.toId}`,
          edgeType: e.edgeType,
        },
      })),
    ];

    const existingIds = new Set(cy.elements().map((el) => el.id()));
    const nextIds = new Set(elements.map((el) => el.data.id as string));

    cy.batch(() => {
      for (const el of cy.elements()) {
        if (!nextIds.has(el.id())) el.remove();
      }
      for (const el of elements) {
        if (!existingIds.has(el.data.id as string)) cy.add(el);
      }
    });

    if (elements.length > 0) {
      cy.layout({ name: "cose", animate: false, fit: true, padding: 40 } as any).run();
    }
  }, [nodes, edges]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("selected");
    if (selectedKey) cy.getElementById(selectedKey).addClass("selected");
  }, [selectedKey]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges().removeClass("highlighted");
    if (highlightedEdgeKeys) {
      cy.edges().forEach((el) => {
        const source = el.data("source");
        const target = el.data("target");
        if (highlightedEdgeKeys.has(`${source}->${target}`) || highlightedEdgeKeys.has(`${target}->${source}`)) {
          el.addClass("highlighted");
        }
      });
    }
  }, [highlightedEdgeKeys]);

  return <div ref={containerRef} className="graph-canvas" />;
}
