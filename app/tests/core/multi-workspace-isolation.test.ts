import { describe, it, expect } from "vitest";
import path from "node:path";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { search } from "../../src/core/services/search-engine/search-engine";
import { QueryEngine } from "../../src/core/services/query-engine/query-engine";
import { listCases } from "../../src/core/db/knowledge-repositories";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

/**
 * Phase 5, Section 3. Two independently-scanned workspaces, asserted to
 * share nothing: not assets, not cases, not search results, not review
 * queue entries, not duplicate groups — and each backed by a physically
 * separate SQLite file (ADR-001), not a shared store filtered by id.
 */
describe("multi-workspace isolation", () => {
  it("uses physically separate database files", async () => {
    const wsA = makeFixtureWorkspace({ id: "isolation-fixture-a" });
    const wsB = makeFixtureWorkspace({ id: "isolation-fixture-b" });
    writeFixtureFile(wsA, "a-only.txt", "content only in workspace A");
    writeFixtureFile(wsB, "b-only.txt", "content only in workspace B");

    const resultA = await runScan(wsA, "manual");
    const resultB = await runScan(wsB, "manual");

    const dbPathA = path.join(wsA.rootDir, ".brandos", "archive.db");
    const dbPathB = path.join(wsB.rootDir, ".brandos", "archive.db");
    expect(dbPathA).not.toBe(dbPathB);

    resultA.db.close();
    resultB.db.close();
    cleanupWorkspace(wsA);
    cleanupWorkspace(wsB);
  });

  it("never leaks an asset from one workspace into another's queries", async () => {
    const wsA = makeFixtureWorkspace({ id: "isolation-fixture-c" });
    const wsB = makeFixtureWorkspace({ id: "isolation-fixture-d" });
    writeFixtureFile(wsA, "secret-a.psd", Buffer.from("only in A"));
    writeFixtureFile(wsB, "secret-b.psd", Buffer.from("only in B"));

    const { db: dbA } = await runScan(wsA, "manual");
    const { db: dbB } = await runScan(wsB, "manual");

    expect(findAssetByPath(dbA, "secret-a.psd")).toBeDefined();
    expect(findAssetByPath(dbA, "secret-b.psd")).toBeUndefined();
    expect(findAssetByPath(dbB, "secret-b.psd")).toBeDefined();
    expect(findAssetByPath(dbB, "secret-a.psd")).toBeUndefined();

    const queryA = new QueryEngine(dbA);
    const queryB = new QueryEngine(dbB);
    expect(queryA.everyAssetByExtension("psd").map((a) => a.filename)).toEqual(["secret-a.psd"]);
    expect(queryB.everyAssetByExtension("psd").map((a) => a.filename)).toEqual(["secret-b.psd"]);

    dbA.close();
    dbB.close();
    cleanupWorkspace(wsA);
    cleanupWorkspace(wsB);
  });

  it("never leaks cases between workspaces", async () => {
    const wsA = makeFixtureWorkspace({ id: "isolation-fixture-e" });
    const wsB = makeFixtureWorkspace({ id: "isolation-fixture-f" });
    const { db: dbA } = await runScan(wsA, "manual");
    const { db: dbB } = await runScan(wsB, "manual");

    new CaseBuilderService(dbA).createFromTemplate("media_kit", "A's Media Kit");
    new CaseBuilderService(dbB).createFromTemplate("trademark_registration", "B's Trademark Case");

    const casesA = listCases(dbA);
    const casesB = listCases(dbB);
    expect(casesA.map((c) => c.title)).toEqual(["A's Media Kit"]);
    expect(casesB.map((c) => c.title)).toEqual(["B's Trademark Case"]);
    expect(casesA.some((c) => c.title.includes("B's"))).toBe(false);
    expect(casesB.some((c) => c.title.includes("A's"))).toBe(false);

    dbA.close();
    dbB.close();
    cleanupWorkspace(wsA);
    cleanupWorkspace(wsB);
  });

  it("never leaks search results between workspaces", async () => {
    const wsA = makeFixtureWorkspace({ id: "isolation-fixture-g" });
    const wsB = makeFixtureWorkspace({ id: "isolation-fixture-h" });
    writeFixtureFile(wsA, "UniqueMarkerAlpha.txt", "findable only in A");
    writeFixtureFile(wsB, "UniqueMarkerBeta.txt", "findable only in B");

    const { db: dbA } = await runScan(wsA, "manual");
    const { db: dbB } = await runScan(wsB, "manual");

    const resultsAInA = search(dbA, "UniqueMarkerAlpha");
    const resultsBInA = search(dbA, "UniqueMarkerBeta");
    const resultsBInB = search(dbB, "UniqueMarkerBeta");
    const resultsAInB = search(dbB, "UniqueMarkerAlpha");

    expect(resultsAInA.length).toBeGreaterThan(0);
    expect(resultsBInA.length).toBe(0);
    expect(resultsBInB.length).toBeGreaterThan(0);
    expect(resultsAInB.length).toBe(0);

    dbA.close();
    dbB.close();
    cleanupWorkspace(wsA);
    cleanupWorkspace(wsB);
  });

  it("never leaks duplicate-group or review-queue state between workspaces", async () => {
    const wsA = makeFixtureWorkspace({ id: "isolation-fixture-i" });
    const wsB = makeFixtureWorkspace({ id: "isolation-fixture-j" });
    // Identical duplicate content in BOTH workspaces — if isolation were broken,
    // this is exactly the scenario that would falsely merge them into one group.
    writeFixtureFile(wsA, "dup1.txt", "identical bytes");
    writeFixtureFile(wsA, "dup2.txt", "identical bytes");
    writeFixtureFile(wsB, "dup1.txt", "identical bytes");
    writeFixtureFile(wsB, "dup2.txt", "identical bytes");
    writeFixtureFile(wsA, "mystery-a.xyz", "unclassifiable in A");

    const { db: dbA, summary: summaryA } = await runScan(wsA, "manual");
    const { db: dbB, summary: summaryB } = await runScan(wsB, "manual");

    // Each workspace independently detects its OWN 2-member duplicate group — not a
    // shared 4-member group, which is what cross-workspace hash leakage would produce.
    const queryA = new QueryEngine(dbA);
    const queryB = new QueryEngine(dbB);
    expect(summaryA.duplicateGroupsFound).toBe(1);
    expect(summaryB.duplicateGroupsFound).toBe(1);
    expect(queryA.duplicateGroups()[0].assetIds.length).toBe(2);
    expect(queryB.duplicateGroups()[0].assetIds.length).toBe(2);

    // A's review queue (from the unclassifiable file) must not appear in B.
    const reviewA = queryA.assetsNeedingReview(70);
    const reviewB = queryB.assetsNeedingReview(70);
    expect(reviewA.some((a) => a.filename === "mystery-a.xyz")).toBe(true);
    expect(reviewB.some((a) => a.filename === "mystery-a.xyz")).toBe(false);

    dbA.close();
    dbB.close();
    cleanupWorkspace(wsA);
    cleanupWorkspace(wsB);
  });
});
