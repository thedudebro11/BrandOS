import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { runIntegrityCheck } from "../../src/core/services/integrity-engine/integrity-engine";
import { verifyAssetHash } from "../../src/core/services/hashing-engine/hash-engine";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { recordHashCheck } from "../../src/core/db/repositories";
import fs from "node:fs";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("integrity engine", () => {
  it("reports zero critical issues for a clean workspace", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-clean" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const issues = runIntegrityCheck(db);
    expect(issues.filter((i) => i.severity === "critical")).toEqual([]);
    db.close();
    cleanupWorkspace(ws);
  });

  it("flags a missing asset when a previously-scanned file is deleted", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-missing" });
    const filePath = writeFixtureFile(ws, "temp.txt", "will vanish");
    const first = await runScan(ws, "manual");
    first.db.close();

    fs.unlinkSync(filePath);
    const second = await runScan(ws, "manual");
    const issues = runIntegrityCheck(second.db);
    expect(issues.some((i) => i.issueType === "missing_asset")).toBe(true);

    second.db.close();
    cleanupWorkspace(ws);
  });

  it("flags a hash mismatch recorded via verifyAssetHash", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-hash" });
    const filePath = writeFixtureFile(ws, "changeme.txt", "original content");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "changeme.txt")!;

    fs.writeFileSync(filePath, "tampered content — different bytes");
    const wfs = new WorkspaceFs(ws);
    const result = await verifyAssetHash(wfs, asset);
    recordHashCheck(db, asset.id, result.hash, result.matched);
    expect(result.matched).toBe(false);

    const issues = runIntegrityCheck(db);
    expect(issues.some((i) => i.issueType === "hash_mismatch" && i.scopeId === asset.id)).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("flags duplicate assets as info-level issues", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-dupe" });
    writeFixtureFile(ws, "a.txt", "identical");
    writeFixtureFile(ws, "b.txt", "identical");
    const { db } = await runScan(ws, "manual");
    const issues = runIntegrityCheck(db);
    expect(issues.some((i) => i.issueType === "duplicate_asset")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("flags a fully disconnected asset as orphaned", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-orphan" });
    writeFixtureFile(ws, "isolated.xyz", "matches no rules, no relationships, no tags");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "isolated.xyz")!;
    const issues = runIntegrityCheck(db);
    expect(issues.some((i) => i.issueType === "orphaned_asset" && i.scopeId === asset.id)).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("persists every finding to the integrity_checks table", async () => {
    const ws = makeFixtureWorkspace({ id: "integrity-fixture-persist" });
    writeFixtureFile(ws, "a.txt", "dup");
    writeFixtureFile(ws, "b.txt", "dup");
    const { db } = await runScan(ws, "manual");
    const issues = runIntegrityCheck(db);
    const rows = db.all("SELECT * FROM integrity_checks");
    expect(rows.length).toBe(issues.length);
    db.close();
    cleanupWorkspace(ws);
  });
});
