import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { traceResolvedDateProvenance } from "../../src/core/services/evidence-provenance-engine/evidence-provenance-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("evidence provenance engine", () => {
  it("traces a resolved date all the way to the workspace, through a hash-verified asset", async () => {
    const ws = makeFixtureWorkspace({ id: "provenance2-fixture-1" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd content"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;

    const chain = traceResolvedDateProvenance(db, asset.id);
    const layers = chain.map((c) => c.layer);

    expect(layers).toContain("Resolved Date");
    expect(layers).toContain("Candidate Date");
    expect(layers).toContain("Original Asset");
    expect(layers).toContain("SHA-256 Hash");
    expect(layers).toContain("Workspace");
    expect(chain.every((c) => c.reproducible)).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("returns a clear, honest chain when an asset has no resolved date at all", async () => {
    const ws = makeFixtureWorkspace({ id: "provenance2-fixture-2" });
    writeFixtureFile(ws, "unresolvable.txt", "x");
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "unresolvable.txt")!;

    // Force every real candidate implausible directly (fs.utimesSync can't
    // touch birthtime, so this is the reliable way to simulate the scenario —
    // see the same note in timeline-intelligence.test.ts).
    db.run("UPDATE candidate_dates SET is_plausible = 0, implausibility_reason = 'forced implausible for test' WHERE asset_id = ?", [
      asset.id,
    ]);
    const { resolveAssetDate } = await import("../../src/core/services/timeline-intelligence/timeline-resolution-engine");
    resolveAssetDate(db, asset.id);

    const chain = traceResolvedDateProvenance(db, asset.id);
    expect(chain.length).toBe(1);
    expect(chain[0].reproducible).toBe(false);
    expect(chain[0].description).toContain("no plausible candidate");

    db.close();
    cleanupWorkspace(ws);
  });
});
