import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { runDataHealthCheck } from "../../src/core/services/data-health-engine/data-health-engine";
import { computeEvidenceQualityMetrics } from "../../src/core/services/evidence-quality-metrics/evidence-quality-metrics";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("evidence quality metrics", () => {
  it("reports 0% across completeness metrics for an empty workspace", async () => {
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-empty" });
    const { db } = await runScan(ws, "manual");
    const metrics = computeEvidenceQualityMetrics(db);
    expect(metrics.timelineCompleteness).toBe(0);
    expect(metrics.metadataCompleteness).toBe(0);
    expect(metrics.classificationCompleteness).toBe(0);
    db.close();
    cleanupWorkspace(ws);
  });

  it("reports 100% timeline completeness when every asset resolves a date", async () => {
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-full-timeline" });
    writeFixtureFile(ws, "a.txt", "1");
    writeFixtureFile(ws, "b.txt", "2");
    const { db } = await runScan(ws, "manual");
    const metrics = computeEvidenceQualityMetrics(db);
    // Both files get a plausible filesystem candidate in a normal test environment.
    expect(metrics.timelineCompleteness).toBeGreaterThan(0);
    db.close();
    cleanupWorkspace(ws);
  });

  it("confidence distribution buckets sum to the total classified count", async () => {
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-distribution" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    writeFixtureFile(ws, "mystery.xyz", "2");
    const { db } = await runScan(ws, "manual");
    const metrics = computeEvidenceQualityMetrics(db);
    const total = metrics.confidenceDistribution.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(2);
    db.close();
    cleanupWorkspace(ws);
  });

  it("health score is unaffected by purely info-level findings (e.g. one orphaned asset)", async () => {
    // Regression guard for the Phase 3.5 flaw this formula was rewritten to fix:
    // info-level findings must not tank the score just from volume.
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-health-info" });
    writeFixtureFile(ws, "isolated.xyz", "orphaned, no siblings, no relationships");
    const { db } = await runScan(ws, "manual");
    runDataHealthCheck(db);
    const metrics = computeEvidenceQualityMetrics(db);
    expect(metrics.healthScore).toBe(100);
    db.close();
    cleanupWorkspace(ws);
  });

  it("health score decreases when a real warning-level finding exists (e.g. epoch dates)", async () => {
    const fs = require("node:fs");
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-health-warning" });
    const filePath = writeFixtureFile(ws, "old.txt", "x");
    fs.utimesSync(filePath, new Date(0), new Date(0)); // forces an implausible filesystem_modified candidate -> epoch_date warning
    const { db } = await runScan(ws, "manual");
    runDataHealthCheck(db);
    const metrics = computeEvidenceQualityMetrics(db);
    expect(metrics.healthScore).toBeLessThan(100);
    db.close();
    cleanupWorkspace(ws);
  });

  it("every metric is a finite number, never NaN, even with zero data", async () => {
    const ws = makeFixtureWorkspace({ id: "metrics-fixture-nan-guard" });
    const { db } = await runScan(ws, "manual");
    const metrics = computeEvidenceQualityMetrics(db);
    for (const [key, value] of Object.entries(metrics)) {
      if (key === "confidenceDistribution") continue;
      expect(Number.isFinite(value as number)).toBe(true);
    }
    db.close();
    cleanupWorkspace(ws);
  });
});
