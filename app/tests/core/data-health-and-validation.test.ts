import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { runDataHealthCheck } from "../../src/core/services/data-health-engine/data-health-engine";
import { validateKnowledge } from "../../src/core/services/knowledge-validation-engine/knowledge-validation-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("data health engine", () => {
  it("delegates duplicate/orphaned detection to the Phase 3 integrity engine (no duplicate logic)", async () => {
    const ws = makeFixtureWorkspace({ id: "health-fixture-delegate" });
    writeFixtureFile(ws, "a.txt", "same");
    writeFixtureFile(ws, "b.txt", "same");
    const { db } = await runScan(ws, "manual");
    const findings = runDataHealthCheck(db);
    expect(findings.some((f) => f.findingType === "duplicate_asset")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("flags epoch-dated candidates as a workspace-level warning", async () => {
    const ws = makeFixtureWorkspace({ id: "health-fixture-epoch" });
    const filePath = writeFixtureFile(ws, "old.txt", "x");
    fs.utimesSync(filePath, new Date(0), new Date(0));
    const { db } = await runScan(ws, "manual");
    const findings = runDataHealthCheck(db);
    expect(findings.some((f) => f.findingType === "epoch_date")).toBe(true);
    expect(findings.some((f) => f.findingType === "invalid_timestamp")).toBe(true);
    db.close();
    cleanupWorkspace(ws);
  });

  it("persists every finding to data_health_findings", async () => {
    const ws = makeFixtureWorkspace({ id: "health-fixture-persist" });
    writeFixtureFile(ws, "a.txt", "same");
    writeFixtureFile(ws, "b.txt", "same");
    const { db } = await runScan(ws, "manual");
    const findings = runDataHealthCheck(db);
    const rows = db.all("SELECT * FROM data_health_findings");
    expect(rows.length).toBe(findings.length);
    db.close();
    cleanupWorkspace(ws);
  });
});

describe("knowledge validation engine", () => {
  it("passes every check on a clean, freshly-scanned workspace", async () => {
    const ws = makeFixtureWorkspace({ id: "validate-fixture-clean" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const results = validateKnowledge(db);
    const failed = results.filter((r) => !r.passed);
    expect(failed).toEqual([]);
    db.close();
    cleanupWorkspace(ws);
  });

  it("every_asset_has_id check reflects real counts", async () => {
    const ws = makeFixtureWorkspace({ id: "validate-fixture-ids" });
    writeFixtureFile(ws, "a.txt", "1");
    writeFixtureFile(ws, "b.txt", "2");
    const { db } = await runScan(ws, "manual");
    const results = validateKnowledge(db);
    const idCheck = results.find((r) => r.checkName === "every_asset_has_id")!;
    expect(idCheck.passed).toBe(true);
    expect(idCheck.details).toContain("2 of 2");
    db.close();
    cleanupWorkspace(ws);
  });

  it("persists results to knowledge_validation_runs", async () => {
    const ws = makeFixtureWorkspace({ id: "validate-fixture-persist" });
    // Phase 7: runScan() itself now runs a Validation pipeline stage (one
    // validateKnowledge() call), so the explicit call below is the second —
    // rows.length is 2x results.length, not 1x.
    const { db } = await runScan(ws, "manual");
    const results = validateKnowledge(db);
    const rows = db.all("SELECT * FROM knowledge_validation_runs");
    expect(rows.length).toBe(results.length * 2);
    db.close();
    cleanupWorkspace(ws);
  });
});
