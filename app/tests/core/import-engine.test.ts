import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath, listActiveAssets } from "../../src/core/db/repositories";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("import engine (integration)", () => {
  it("scans a fixture workspace, creates permanent asset IDs, and writes only under .brandos/", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-1" });
    writeFixtureFile(ws, "notes.txt", "hello world");
    writeFixtureFile(ws, "logo.psd", Buffer.from("fake-psd-content"));
    writeFixtureFile(ws, "logo.png", Buffer.from("fake-png-content"));

    const { summary, db } = await runScan(ws, "manual");

    expect(summary.assetsCreated).toBe(3);
    expect(summary.status).toBe("completed");

    const asset = findAssetByPath(db, "notes.txt");
    expect(asset?.assetId).toMatch(/^AST-\d{8}$/);
    expect(asset?.sha256).toBeTruthy();

    // Evidence tree must be untouched — only notes.txt/logo.psd/logo.png plus .brandos/ should exist.
    const rootEntries = fs.readdirSync(ws.rootDir).sort();
    expect(rootEntries).toEqual(["logo.png", "logo.psd", ".brandos".replace(".brandos", ".brandos"), "notes.txt", "workspace.json"].sort());
    expect(fs.existsSync(path.join(ws.rootDir, ".brandos", "archive.db"))).toBe(true);
    expect(fs.existsSync(path.join(ws.rootDir, ".brandos", "manifests", "FILE_MANIFEST.json"))).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("detects a source-to-export relationship for matching-stem psd+png", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-2" });
    writeFixtureFile(ws, "Design/Banner.psd", Buffer.from("psd bytes"));
    writeFixtureFile(ws, "Design/Banner.png", Buffer.from("png bytes"));

    const { db } = await runScan(ws, "manual");
    const rels = db.all<{ relationship_type: string; confidence: number }>("SELECT * FROM relationships");
    expect(rels.length).toBe(1);
    expect(rels[0].relationship_type).toBe("source_to_export");
    expect(rels[0].confidence).toBe(90);

    db.close();
    cleanupWorkspace(ws);
  });

  it("is incremental: re-scanning unchanged files does not create duplicate assets or bump counts", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-3" });
    writeFixtureFile(ws, "a.txt", "unchanged content");

    const first = await runScan(ws, "manual");
    expect(first.summary.assetsCreated).toBe(1);
    first.db.close();

    const second = await runScan(ws, "manual");
    expect(second.summary.assetsCreated).toBe(0);
    expect(second.summary.assetsUpdated).toBe(0);
    expect(listActiveAssets(second.db).length).toBe(1);
    second.db.close();

    cleanupWorkspace(ws);
  });

  it("re-hashes and marks updated when a file's content changes", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-4" });
    const filePath = writeFixtureFile(ws, "changing.txt", "version 1");

    const first = await runScan(ws, "manual");
    const firstAsset = findAssetByPath(first.db, "changing.txt")!;
    first.db.close();

    // Force a distinct mtime so the scanner's unchanged-check (size+mtime) sees a real change.
    await new Promise((r) => setTimeout(r, 20));
    fs.writeFileSync(filePath, "version 2 — longer content");

    const second = await runScan(ws, "manual");
    const secondAsset = findAssetByPath(second.db, "changing.txt")!;

    expect(second.summary.assetsUpdated).toBe(1);
    expect(secondAsset.assetId).toBe(firstAsset.assetId); // permanent ID never changes
    expect(secondAsset.sha256).not.toBe(firstAsset.sha256);
    second.db.close();

    cleanupWorkspace(ws);
  });

  it("marks a deleted file's asset as missing without deleting the row", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-5" });
    const filePath = writeFixtureFile(ws, "temporary.txt", "will be removed");

    const first = await runScan(ws, "manual");
    expect(first.summary.assetsCreated).toBe(1);
    first.db.close();

    fs.unlinkSync(filePath);
    const second = await runScan(ws, "manual");
    expect(second.summary.assetsMissing).toBe(1);
    const asset = findAssetByPath(second.db, "temporary.txt");
    expect(asset?.status).toBe("missing");
    expect(asset?.assetId).toBeTruthy(); // row preserved, ID intact
    second.db.close();

    cleanupWorkspace(ws);
  });

  it("detects exact duplicates by content hash", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-6" });
    writeFixtureFile(ws, "Mission Statement.txt", "identical content");
    writeFixtureFile(ws, "Text Docs/Mission Statement.txt", "identical content");

    const { summary, db } = await runScan(ws, "manual");
    expect(summary.duplicateGroupsFound).toBeGreaterThanOrEqual(1);
    const members = db.all("SELECT * FROM duplicate_group_members");
    expect(members.length).toBe(2);

    db.close();
    cleanupWorkspace(ws);
  });

  it("records timeline events for every new asset", async () => {
    const ws = makeFixtureWorkspace({ id: "import-fixture-7" });
    writeFixtureFile(ws, "event.txt", "content");

    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "event.txt")!;
    const events = db.all("SELECT * FROM timeline_events WHERE asset_id = ?", [asset.id]);
    expect(events.length).toBeGreaterThanOrEqual(2); // at least file_created + imported

    db.close();
    cleanupWorkspace(ws);
  });
});
