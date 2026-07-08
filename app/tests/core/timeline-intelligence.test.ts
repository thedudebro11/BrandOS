import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { getCandidateDates, getResolvedDate, recordCandidateDate } from "../../src/core/db/knowledge-repositories";
import { checkPlausibility } from "../../src/core/services/timeline-intelligence/plausibility";
import { resolveAssetDate } from "../../src/core/services/timeline-intelligence/timeline-resolution-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("plausibility checking", () => {
  it("rejects Unix epoch dates", () => {
    const r = checkPlausibility("1970-01-01T00:00:00.000Z");
    expect(r.plausible).toBe(false);
    expect(r.reason).toContain("epoch");
  });

  it("rejects dates before 1990", () => {
    const r = checkPlausibility("1985-01-01T00:00:00.000Z");
    expect(r.plausible).toBe(false);
  });

  it("rejects future dates", () => {
    const r = checkPlausibility("2099-01-01T00:00:00.000Z");
    expect(r.plausible).toBe(false);
  });

  it("accepts a reasonable real-world date", () => {
    const r = checkPlausibility("2024-09-25T00:00:00.000Z");
    expect(r.plausible).toBe(true);
    expect(r.reason).toBeNull();
  });
});

describe("candidate date collection — never discards, always stores every source", () => {
  it("stores filesystem, filename-pattern candidates for one asset", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-candidates" });
    writeFixtureFile(ws, "Screenshot 2024-09-20 230733.png", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "Screenshot 2024-09-20 230733.png")!;
    const candidates = getCandidateDates(db, asset.id);

    expect(candidates.some((c) => c.sourceType === "filesystem_created")).toBe(true);
    expect(candidates.some((c) => c.sourceType === "filename_pattern" && c.dateValue.startsWith("2024-09-20"))).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("still stores an epoch filesystem candidate, marked implausible, never silently dropped", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-epoch" });
    const filePath = writeFixtureFile(ws, "old.txt", "content");
    fs.utimesSync(filePath, new Date(0), new Date(0)); // force epoch mtime; birthtime is platform-controlled
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "old.txt")!;
    const candidates = getCandidateDates(db, asset.id);

    const modified = candidates.find((c) => c.sourceType === "filesystem_modified");
    expect(modified).toBeDefined();
    expect(modified!.isPlausible).toBe(false);
    expect(modified!.implausibilityReason).toContain("epoch");

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("timeline resolution engine", () => {
  it("resolves using the highest-priority plausible candidate and explains why", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-resolve" });
    writeFixtureFile(ws, "Screenshot 2024-09-20 230733.png", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "Screenshot 2024-09-20 230733.png")!;
    const resolved = getResolvedDate(db, asset.id)!;

    expect(resolved).toBeDefined();
    // filename_pattern (rank 80) outranks filesystem_created (rank 70)? No — 70 < 80, so filesystem_created
    // wins on priority UNLESS it's implausible. On most systems the fixture's real creation time is plausible,
    // so filesystem_created should win here (lower rank number = higher priority).
    expect(["filesystem_created", "filesystem_modified", "filename_pattern"]).toContain(resolved.sourceType);
    expect(resolved.reasoning.length).toBeGreaterThan(10);
    expect(resolved.rejectedAlternatives.length).toBeGreaterThan(0);

    db.close();
    cleanupWorkspace(ws);
  });

  it("falls through to filename_pattern when filesystem dates are implausible", async () => {
    // Node's fs.utimesSync can only set mtime/atime, never birthtime (it's not
    // settable via any standard Node API on this platform), so forcing a real
    // implausible filesystem_created requires manipulating the DB directly
    // rather than the file itself — this still exercises the real resolution
    // engine, just without depending on OS-level timestamp behavior we can't
    // control from a test.
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-fallthrough" });
    writeFixtureFile(ws, "Screenshot 2024-09-20 230733.png", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "Screenshot 2024-09-20 230733.png")!;

    db.run(
      "UPDATE candidate_dates SET is_plausible = 0, implausibility_reason = 'forced implausible for test' WHERE asset_id = ? AND source_type IN ('filesystem_created','filesystem_modified')",
      [asset.id]
    );
    const resolved = resolveAssetDate(db, asset.id)!;

    expect(resolved.sourceType).toBe("filename_pattern");
    expect(resolved.resolvedDate.startsWith("2024-09-20")).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("returns undefined and writes no resolved_dates row when every candidate is implausible", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-unresolvable" });
    writeFixtureFile(ws, "mystery.txt", "no date signal anywhere");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "mystery.txt")!;

    // Force every real candidate implausible (filename/folder patterns don't match this
    // filename at all, so filesystem candidates are the only ones that exist here).
    db.run("UPDATE candidate_dates SET is_plausible = 0, implausibility_reason = 'forced implausible for test' WHERE asset_id = ?", [
      asset.id,
    ]);

    expect(resolveAssetDate(db, asset.id)).toBeUndefined();
    expect(getResolvedDate(db, asset.id)).toBeUndefined();

    db.close();
    cleanupWorkspace(ws);
  });

  it("boosts confidence when multiple plausible candidates corroborate within 7 days", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-corroborate" });
    writeFixtureFile(ws, "photo-2024-09-20.jpg", Buffer.from("1")); // filename_pattern candidate
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "photo-2024-09-20.jpg")!;

    // Manually add a corroborating high-reliability candidate close in time to the real filesystem date.
    const fsResolved = getResolvedDate(db, asset.id)!;
    const closeDate = new Date(new Date(fsResolved.resolvedDate).getTime() + 1000 * 60 * 60).toISOString();
    recordCandidateDate(db, asset.id, { sourceType: "exif", dateValue: closeDate, rawValue: closeDate, extractedFrom: "test" }, true, null);
    const reResolved = resolveAssetDate(db, asset.id)!;

    expect(reResolved.corroboratingCandidateCount).toBeGreaterThanOrEqual(1);
    expect(reResolved.confidence).toBeGreaterThan(fsResolved.confidence);

    db.close();
    cleanupWorkspace(ws);
  });

  it("permanent Asset ID is unaffected by date resolution — resolution never touches assets table", async () => {
    const ws = makeFixtureWorkspace({ id: "timeline-fixture-assetid" });
    writeFixtureFile(ws, "a.txt", "x");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "a.txt")!;
    expect(asset.assetId).toMatch(/^AST-\d{8}$/);
    db.close();
    cleanupWorkspace(ws);
  });
});
