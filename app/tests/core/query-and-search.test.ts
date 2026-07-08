import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { QueryEngine } from "../../src/core/services/query-engine/query-engine";
import { search } from "../../src/core/services/search-engine/search-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("query engine", () => {
  it("finds every asset by extension", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-ext" });
    writeFixtureFile(ws, "a.psd", Buffer.from("1"));
    writeFixtureFile(ws, "b.psd", Buffer.from("2"));
    writeFixtureFile(ws, "c.txt", "3");
    const { db } = await runScan(ws, "manual");
    const q = new QueryEngine(db);
    expect(q.everyAssetByExtension("psd").length).toBe(2);
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds the first asset by classification category", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-first" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const q = new QueryEngine(db);
    const first = q.firstAssetByCategory("Design Source");
    expect(first?.filename).toBe("logo.psd");
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds assets connected to a given asset via relationships", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-connected" });
    writeFixtureFile(ws, "Design/Banner.psd", Buffer.from("1"));
    writeFixtureFile(ws, "Design/Banner.png", Buffer.from("2"));
    const { db } = await runScan(ws, "manual");
    const psd = findAssetByPath(db, "Design/Banner.psd")!;
    const q = new QueryEngine(db);
    const connected = q.assetsConnectedTo(psd.id);
    expect(connected.map((a) => a.filename)).toContain("Banner.png");
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds orphaned assets (no relationships, case links, or tags)", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-orphan" });
    writeFixtureFile(ws, "lonely.xyz", "no rules match this extension, no path keywords either");
    const { db } = await runScan(ws, "manual");
    const q = new QueryEngine(db);
    const orphans = q.orphanedAssets();
    expect(orphans.some((a) => a.filename === "lonely.xyz")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds duplicate groups", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-dupes" });
    writeFixtureFile(ws, "a.txt", "same content");
    writeFixtureFile(ws, "b.txt", "same content");
    const { db } = await runScan(ws, "manual");
    const q = new QueryEngine(db);
    const groups = q.duplicateGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].assetIds.length).toBe(2);
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds assets needing review (confidence below threshold)", async () => {
    const ws = makeFixtureWorkspace({ id: "query-fixture-review" });
    writeFixtureFile(ws, "mystery.xyz", "??");
    const { db } = await runScan(ws, "manual");
    const q = new QueryEngine(db);
    expect(q.assetsNeedingReview(70).some((a) => a.filename === "mystery.xyz")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });
});

describe("search engine", () => {
  it("finds an asset by filename substring", async () => {
    const ws = makeFixtureWorkspace({ id: "search-fixture-filename" });
    writeFixtureFile(ws, "Fatletic Offical Logo.png", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const results = search(db, "Offical Logo");
    expect(results.some((r) => r.entityType === "asset" && r.label === "Fatletic Offical Logo.png")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds an asset by tag name", async () => {
    const ws = makeFixtureWorkspace({ id: "search-fixture-tag" });
    // "Fatletic Offical Logos/mark.psd" triggers the Logo+Brand tag rule (see
    // tag-rules.ts), but only "Logo" appears in the path itself — "Brand" is
    // purely a derived tag, so searching for it can only match via the tag,
    // not a filename/path substring. This isolates the tag-match code path.
    writeFixtureFile(ws, "Fatletic Offical Logos/mark.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const results = search(db, "Brand");
    expect(results.some((r) => r.entityType === "asset" && r.matchedField.includes("tag"))).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("finds a case by title", async () => {
    const { CaseBuilderService } = await import("../../src/core/services/case-builder/case-builder-service");
    const ws = makeFixtureWorkspace({ id: "search-fixture-case" });
    const { db } = await runScan(ws, "manual");
    new CaseBuilderService(db).createFromTemplate("media_kit");
    const results = search(db, "Media Kit");
    expect(results.some((r) => r.entityType === "case")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });
});
