import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { getAssetIntelligence } from "../../src/core/services/asset-intelligence/asset-intelligence";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { addAssetNote } from "../../src/core/db/knowledge-repositories";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("asset intelligence aggregator", () => {
  it("composes classification, tags, relationships, timeline, provenance, cases, and notes for one asset", async () => {
    const ws = makeFixtureWorkspace({ id: "intel-fixture-1" });
    writeFixtureFile(ws, "Design/Banner.psd", Buffer.from("1"));
    writeFixtureFile(ws, "Design/Banner.png", Buffer.from("2"));
    const { db } = await runScan(ws, "manual");

    const psd = findAssetByPath(db, "Design/Banner.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");
    service.linkAsset(c.id, psd.id, "cover asset");
    addAssetNote(db, psd.id, "Confirmed original source file.", "user");

    const view = getAssetIntelligence(db, psd.assetId)!;

    expect(view.asset.assetId).toBe(psd.assetId);
    expect(view.classification?.category).toBe("Design Source");
    expect(view.relationships.some((r) => r.direction === "outgoing" && r.type === "source_to_export")).toBe(true);
    expect(view.timelineEvents.length).toBeGreaterThan(0);
    expect(view.provenance.some((p) => p.direction === "self")).toBe(true);
    expect(view.linkedCases.map((lc) => lc.id)).toContain(c.id);
    expect(view.notes[0].note).toBe("Confirmed original source file.");

    db.close();
    cleanupWorkspace(ws);
  });

  it("returns undefined for an unknown Asset ID rather than throwing", async () => {
    const ws = makeFixtureWorkspace({ id: "intel-fixture-2" });
    const { db } = await runScan(ws, "manual");
    expect(getAssetIntelligence(db, "AST-99999999")).toBeUndefined();
    db.close();
    cleanupWorkspace(ws);
  });
});
