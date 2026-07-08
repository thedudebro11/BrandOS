import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { buildGraph, getNeighbors } from "../../src/core/services/graph-engine/graph-engine";
import { getProvenanceChain } from "../../src/core/services/provenance-engine/provenance-engine";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("graph engine", () => {
  it("includes asset, case, tag, and timeline_event nodes", async () => {
    const ws = makeFixtureWorkspace({ id: "graph-fixture-nodes" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;
    new CaseBuilderService(db).createFromTemplate("media_kit");

    const { nodes } = buildGraph(db);
    const types = new Set(nodes.map((n) => n.type));
    expect(types.has("asset")).toBe(true);
    expect(types.has("case")).toBe(true);
    expect(types.has("tag")).toBe(true); // logo.psd's path doesn't contain "logo" as folder but classification tags may still apply; if not, at minimum tags table could be empty — check structurally instead
    expect(types.has("timeline_event")).toBe(true);
    void asset;

    db.close();
    cleanupWorkspace(ws);
  });

  it("produces a case_link edge between a case and a linked asset", async () => {
    const ws = makeFixtureWorkspace({ id: "graph-fixture-edges" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");
    service.linkAsset(c.id, asset.id);

    const { edges } = buildGraph(db);
    expect(
      edges.some((e) => e.edgeType === "case_link" && e.fromType === "case" && e.fromId === c.id && e.toId === asset.id)
    ).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("getNeighbors finds an asset's connected tag nodes", async () => {
    const ws = makeFixtureWorkspace({ id: "graph-fixture-neighbors" });
    writeFixtureFile(ws, "Fatletic Offical Logos/mark.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "Fatletic Offical Logos/mark.psd")!;
    const neighbors = getNeighbors(db, "asset", asset.id);
    expect(neighbors.some((n) => n.node.type === "tag" && n.node.label === "Logo")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });
});

describe("provenance engine", () => {
  it("builds an upstream->self->downstream chain for a source/export pair", async () => {
    const ws = makeFixtureWorkspace({ id: "provenance-fixture-chain" });
    writeFixtureFile(ws, "Design/Banner.psd", Buffer.from("1"));
    writeFixtureFile(ws, "Design/Banner.png", Buffer.from("2"));
    const { db } = await runScan(ws, "manual");
    const psd = findAssetByPath(db, "Design/Banner.psd")!;
    const png = findAssetByPath(db, "Design/Banner.png")!;

    const chainFromPng = getProvenanceChain(db, png.id);
    expect(chainFromPng.some((s) => s.assetId === psd.id && s.direction === "upstream")).toBe(true);
    expect(chainFromPng.some((s) => s.assetId === png.id && s.direction === "self")).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("returns just the self step for an asset with no relationships", async () => {
    const ws = makeFixtureWorkspace({ id: "provenance-fixture-lonely" });
    writeFixtureFile(ws, "lonely.txt", "no relationships");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "lonely.txt")!;
    const chain = getProvenanceChain(db, asset.id);
    expect(chain.length).toBe(1);
    expect(chain[0].direction).toBe("self");
    db.close();
    cleanupWorkspace(ws);
  });
});
