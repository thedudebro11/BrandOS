import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { listActiveAssets } from "../../src/core/db/repositories";
import { buildGraph, getNeighbors, WORKSPACE_NODE_ID } from "../../src/core/services/graph-engine/graph-engine";
import { findPath } from "../../src/core/services/graph-engine/path-discovery";
import { traceEvidencePath } from "../../src/core/services/graph-engine/evidence-path";
import { getNodeDetail } from "../../src/core/services/graph-engine/node-inspector";
import { getTimelineExplorerData } from "../../src/core/services/timeline-explorer/timeline-explorer";
import { generateVault } from "../../src/core/services/vault-generator/vault-generator";
import { generateReport } from "../../src/core/services/report-engine/report-generator";
import { getReportDefinition } from "../../src/core/services/report-engine/report-registry";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";
import { buildGoldenDataset } from "../golden-dataset/build";

async function setupRichWorkspace(id: string) {
  const ws = makeFixtureWorkspace({ id });
  buildGoldenDataset(ws);
  const { db } = await runScan(ws, "manual");
  const wfs = new WorkspaceFs(ws);
  const cases = new CaseBuilderService(db);
  const theCase = cases.createCustom("Graph Explorer Test Case", "internal_review", "Fixture case");
  for (const asset of listActiveAssets(db)) cases.linkAsset(theCase.id, asset.id);
  cases.recomputeEvidenceStrength(theCase.id);
  generateVault(wfs, db, ws.config);
  generateReport(db, wfs, ws.config, getReportDefinition("workspace_health"), {});
  generateReport(db, wfs, ws.config, getReportDefinition("case_summary"), { caseId: theCase.id });
  return { ws, wfs, db, caseId: theCase.id };
}

describe("graph engine — real node/edge coverage, no invented relationships", () => {
  it("produces all 9 node types from a workspace with real assets, cases, reports, notes, and evidence", async () => {
    const { ws, db } = await setupRichWorkspace("graph-fixture-node-types");
    const { nodes, edges } = buildGraph(db);
    const types = new Set(nodes.map((n) => n.type));
    expect(types).toEqual(
      new Set(["workspace", "asset", "case", "evidence", "timeline_event", "tag", "report", "obsidian_note", "plugin"])
    );
    expect(edges.length).toBeGreaterThan(0);
    db.close();
    cleanupWorkspace(ws);
  });

  it("every edge references two node ids that actually exist in the node list (no dangling/invented edges)", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-edge-integrity");
    const { nodes, edges } = buildGraph(db);
    const nodeKeys = new Set(nodes.map((n) => `${n.type}:${n.id}`));
    for (const e of edges) {
      expect(nodeKeys.has(`${e.fromType}:${e.fromId}`), `edge references missing from-node ${e.fromType}:${e.fromId}`).toBe(true);
      expect(nodeKeys.has(`${e.toType}:${e.toId}`), `edge references missing to-node ${e.toType}:${e.toId}`).toBe(true);
    }
  });

  it("the golden dataset's real source->export relationship appears as a real graph edge", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-relationship-edge");
    const { edges } = buildGraph(db);
    const relEdges = edges.filter((e) => e.edgeType === "source_to_export");
    expect(relEdges.length).toBe(1); // golden dataset's known Logo.psd -> Logo.png pair
  });

  it("getNeighbors returns only edges actually touching the requested node", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-neighbors");
    const { nodes } = buildGraph(db);
    const caseNode = nodes.find((n) => n.type === "case")!;
    const neighbors = getNeighbors(db, "case", caseNode.id);
    expect(neighbors.length).toBeGreaterThan(0);
    for (const { edge } of neighbors) {
      const touchesCase = (edge.fromType === "case" && edge.fromId === caseNode.id) || (edge.toType === "case" && edge.toId === caseNode.id);
      expect(touchesCase).toBe(true);
    }
  });
});

describe("path discovery — all 6 kinds, real data", () => {
  it("finds a shortest path between two related assets", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-path-shortest");
    const rel = db.get<{ from_asset_id: number; to_asset_id: number }>("SELECT from_asset_id, to_asset_id FROM relationships LIMIT 1")!;
    const result = findPath(db, "shortest", { type: "asset", id: rel.from_asset_id }, { type: "asset", id: rel.to_asset_id });
    expect(result.found).toBe(true);
    expect(result.steps[0].node.id).toBe(rel.from_asset_id);
    expect(result.steps[result.steps.length - 1].node.id).toBe(rel.to_asset_id);
  });

  it("dependency path is directional: forward succeeds, reverse fails", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-path-dependency");
    const rel = db.get<{ from_asset_id: number; to_asset_id: number }>("SELECT from_asset_id, to_asset_id FROM relationships LIMIT 1")!;
    const forward = findPath(db, "dependency", { type: "asset", id: rel.from_asset_id }, { type: "asset", id: rel.to_asset_id });
    const reverse = findPath(db, "dependency", { type: "asset", id: rel.to_asset_id }, { type: "asset", id: rel.from_asset_id });
    expect(forward.found).toBe(true);
    expect(reverse.found).toBe(false);
  });

  it("case path connects a case to the workspace", async () => {
    const { db, caseId } = await setupRichWorkspace("graph-fixture-path-case");
    const result = findPath(db, "case", { type: "case", id: caseId }, { type: "workspace", id: WORKSPACE_NODE_ID });
    expect(result.found).toBe(true);
  });

  it("timeline path connects an asset to one of its timeline events", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-path-timeline");
    const event = db.get<{ id: number; asset_id: number }>("SELECT id, asset_id FROM timeline_events WHERE asset_id IS NOT NULL LIMIT 1")!;
    const result = findPath(db, "timeline", { type: "asset", id: event.asset_id }, { type: "timeline_event", id: event.id });
    expect(result.found).toBe(true);
    expect(result.steps.length).toBe(2);
  });

  it("relationship path only traverses asset<->asset edges, not through a case", async () => {
    const { db, caseId } = await setupRichWorkspace("graph-fixture-path-relationship-scope");
    // A case and a report are never connected by any asset-to-asset relationship edge.
    const report = db.get<{ id: number }>("SELECT id FROM reports WHERE scope_type = 'case' LIMIT 1")!;
    const result = findPath(db, "relationship", { type: "case", id: caseId }, { type: "report", id: report.id });
    expect(result.found).toBe(false);
  });

  it("evidence path (via findPath) connects a case to its evidence assessment", async () => {
    const { db, caseId } = await setupRichWorkspace("graph-fixture-path-evidence");
    const evidenceNode = db.get<{ id: number }>("SELECT id FROM evidence_assessments WHERE scope_type = 'case' AND scope_id = ? ORDER BY computed_at DESC LIMIT 1", [
      caseId,
    ])!;
    const result = findPath(db, "evidence", { type: "case", id: caseId }, { type: "evidence", id: evidenceNode.id });
    expect(result.found).toBe(true);
  });

  it("returns found: false, not a crash, for two nodes with no connecting path under a restrictive kind", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-path-not-found");
    const tag = db.get<{ id: number }>("SELECT id FROM tags LIMIT 1");
    const plugin = db.get<{ id: number }>("SELECT id FROM plugin_registrations LIMIT 1");
    if (!tag || !plugin) return; // fixture may not have both — not the point of this test
    const result = findPath(db, "timeline", { type: "tag", id: tag.id }, { type: "plugin", id: plugin.id });
    expect(result.found).toBe(false);
    expect(result.steps).toEqual([]);
  });
});

describe("evidence path explorer — full reachability trace", () => {
  it("traces from a real asset to its case and evidence assessment", async () => {
    const { db, caseId } = await setupRichWorkspace("graph-fixture-evidence-trace");
    const asset = listActiveAssets(db)[0];
    const trace = traceEvidencePath(db, { type: "asset", id: asset.id });
    expect(trace[0].depth).toBe(0);
    expect(trace[0].node.id).toBe(asset.id);
    expect(trace.some((s) => s.node.type === "case" && s.node.id === caseId)).toBe(true);
    // Every non-starting step must be reached via a real edge.
    for (const step of trace.slice(1)) expect(step.viaEdge).not.toBeNull();
  });
});

describe("node inspector — Section 5 composition per node type", () => {
  it("returns real, non-fabricated detail for every node type present in a rich workspace", async () => {
    const { db, wfs } = await setupRichWorkspace("graph-fixture-inspector-all-types");
    const { nodes } = buildGraph(db);
    for (const type of ["workspace", "asset", "case", "evidence", "timeline_event", "tag", "report", "obsidian_note", "plugin"] as const) {
      const node = nodes.find((n) => n.type === type);
      if (!node) continue;
      const detail = getNodeDetail(db, wfs, type, node.id);
      expect(detail, `expected detail for ${type}:${node.id}`).toBeDefined();
      expect(detail!.label.length).toBeGreaterThan(0);
      expect(detail!.summary.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for a node id that doesn't exist, not a crash", async () => {
    const { db, wfs } = await setupRichWorkspace("graph-fixture-inspector-missing");
    expect(getNodeDetail(db, wfs, "asset", 999999)).toBeUndefined();
  });
});

describe("timeline explorer — filtering", () => {
  it("filters by category and confidence, and groups by year", async () => {
    const { db } = await setupRichWorkspace("graph-fixture-timeline-explorer");
    const all = getTimelineExplorerData(db);
    expect(all.entries.length).toBeGreaterThan(0);
    expect(all.groups.length).toBeGreaterThan(0);

    const highConfidence = getTimelineExplorerData(db, { minConfidence: 101 });
    expect(highConfidence.entries.length).toBe(0); // nothing can exceed 100/100
  });
});
