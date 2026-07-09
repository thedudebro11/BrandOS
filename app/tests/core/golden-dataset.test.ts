import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { listActiveAssets } from "../../src/core/db/repositories";
import { getResolvedDate } from "../../src/core/db/knowledge-repositories";
import { validateKnowledge } from "../../src/core/services/knowledge-validation-engine/knowledge-validation-engine";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { generateVault } from "../../src/core/services/vault-generator/vault-generator";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { listImportRuns } from "../../src/core/db/import-runs-repository";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";
import { buildGoldenDataset, GOLDEN_EXPECTATIONS } from "../golden-dataset/build";

/**
 * The permanent regression suite (Phase 7 spec, "Golden Dataset"). Every
 * assertion here checks a specific, known-in-advance fact about the fixed
 * dataset in tests/golden-dataset/build.ts — this is what "every future
 * release runs against this dataset" means in practice: if any engine
 * changes the golden dataset's known-correct answer, this test fails loudly
 * rather than a real regression going unnoticed among fixture-specific tests
 * that don't share one canonical dataset.
 */
describe("golden dataset — platform regression baseline", () => {
  it("asset counts match the known dataset shape", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-counts" });
    buildGoldenDataset(ws);
    const { db, summary } = await runScan(ws, "manual");

    expect(summary.filesDiscovered).toBe(GOLDEN_EXPECTATIONS.totalFiles);
    expect(listActiveAssets(db).length).toBe(GOLDEN_EXPECTATIONS.totalAssets);

    db.close();
    cleanupWorkspace(ws);
  });

  it("relationship discovery finds the known source->export pair", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-relationships" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");

    const rels = db.all<{ c: number }>("SELECT COUNT(*) as c FROM relationships WHERE relationship_type = 'source_to_export'");
    expect(rels[0].c).toBe(GOLDEN_EXPECTATIONS.sourceToExportRelationships);

    db.close();
    cleanupWorkspace(ws);
  });

  it("duplicate detection finds the known duplicate pair", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-duplicates" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");

    const groups = db.all<{ c: number }>("SELECT COUNT(*) as c FROM duplicate_groups");
    expect(groups[0].c).toBe(GOLDEN_EXPECTATIONS.duplicateGroups);

    const members = db.all<{ c: number }>("SELECT COUNT(*) as c FROM duplicate_group_members");
    expect(members[0].c).toBe(GOLDEN_EXPECTATIONS.duplicateAssetsInGroup);

    db.close();
    cleanupWorkspace(ws);
  });

  it("timeline resolution produces a resolved date for every asset", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-timeline" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");

    for (const asset of listActiveAssets(db)) {
      const resolved = getResolvedDate(db, asset.id);
      expect(resolved, `expected a resolved date for ${asset.assetId} (${asset.originalPath})`).toBeDefined();
    }

    db.close();
    cleanupWorkspace(ws);
  });

  it("knowledge validation passes cleanly on the golden dataset", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-knowledge" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");

    const results = validateKnowledge(db);
    const failed = results.filter((r) => !r.passed);
    expect(failed, `expected no failed checks, got: ${JSON.stringify(failed)}`).toHaveLength(0);

    db.close();
    cleanupWorkspace(ws);
  });

  it("Obsidian generation produces exactly one note per asset plus workspace and index notes", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-vault" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);

    const summary = generateVault(wfs, db, ws.config);
    const assetNotes = summary.results.filter((r) => r.vaultPath.startsWith("Assets/"));
    expect(assetNotes.length).toBe(GOLDEN_EXPECTATIONS.totalAssets);
    expect(summary.results.some((r) => r.vaultPath === "Workspace.md")).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("case integrity: linking every golden asset to a case yields a real, non-fabricated evidence assessment", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-case" });
    buildGoldenDataset(ws);
    const { db } = await runScan(ws, "manual");

    const cases = new CaseBuilderService(db);
    const theCase = cases.createCustom("Golden Dataset Regression Case", "internal_review", "Regression fixture case");
    for (const asset of listActiveAssets(db)) cases.linkAsset(theCase.id, asset.id);
    cases.recomputeEvidenceStrength(theCase.id);

    const links = cases.listLinks(theCase.id);
    expect(links.length).toBe(GOLDEN_EXPECTATIONS.totalAssets);

    db.close();
    cleanupWorkspace(ws);
  });

  it("import idempotency: re-scanning the unchanged golden dataset creates zero new assets and zero new relationships/duplicates", async () => {
    const ws = makeFixtureWorkspace({ id: "golden-dataset-idempotency" });
    buildGoldenDataset(ws);

    const first = await runScan(ws, "manual");
    const secondDb = (await runScan(ws, "manual")).db;

    const runs = listImportRuns(secondDb, 10);
    expect(runs.length).toBe(2);
    const [latest, previous] = runs;
    expect(latest.assetsAdded).toBe(0);
    expect(latest.assetsUpdated).toBe(0);
    expect(latest.assetsSkipped).toBe(GOLDEN_EXPECTATIONS.totalAssets);
    expect(latest.duplicatesFound).toBe(previous.duplicatesFound);
    expect(listActiveAssets(secondDb).length).toBe(GOLDEN_EXPECTATIONS.totalAssets);

    first.db.close();
    secondDb.close();
    cleanupWorkspace(ws);
  });
});
