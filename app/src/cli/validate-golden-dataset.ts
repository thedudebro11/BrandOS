import { runScan } from "../core/services/import-engine/import-engine";
import { listActiveAssets } from "../core/db/repositories";
import { getResolvedDate } from "../core/db/knowledge-repositories";
import { validateKnowledge } from "../core/services/knowledge-validation-engine/knowledge-validation-engine";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { generateVault } from "../core/services/vault-generator/vault-generator";
import { makeFixtureWorkspace, cleanupWorkspace } from "../../tests/helpers";
import { buildGoldenDataset, GOLDEN_EXPECTATIONS } from "../../tests/golden-dataset/build";

/**
 * Standalone runner for the Golden Dataset (Phase 7 spec: "every future
 * release of BrandOS should run against this dataset"). The same checks as
 * tests/core/golden-dataset.test.ts, run outside vitest so this can be
 * invoked as a release gate (`npm run validate-golden-dataset`) without
 * requiring the full test runner — exits non-zero on any mismatch.
 */
async function main() {
  const failures: string[] = [];
  const check = (label: string, actual: unknown, expected: unknown) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${pass ? "PASS" : "FAIL"}  ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    if (!pass) failures.push(label);
  };

  const ws = makeFixtureWorkspace({ id: "golden-dataset-cli-run" });
  buildGoldenDataset(ws);

  const { db, summary } = await runScan(ws, "manual");
  check("files discovered", summary.filesDiscovered, GOLDEN_EXPECTATIONS.totalFiles);
  check("active assets", listActiveAssets(db).length, GOLDEN_EXPECTATIONS.totalAssets);

  const rels = db.get<{ c: number }>("SELECT COUNT(*) as c FROM relationships WHERE relationship_type = 'source_to_export'");
  check("source_to_export relationships", rels?.c, GOLDEN_EXPECTATIONS.sourceToExportRelationships);

  const groups = db.get<{ c: number }>("SELECT COUNT(*) as c FROM duplicate_groups");
  check("duplicate groups", groups?.c, GOLDEN_EXPECTATIONS.duplicateGroups);

  const allResolved = listActiveAssets(db).every((a) => getResolvedDate(db, a.id) !== undefined);
  check("every asset has a resolved date", allResolved, true);

  const validation = validateKnowledge(db);
  check("knowledge validation all-pass", validation.every((r) => r.passed), true);

  const wfs = new WorkspaceFs(ws);
  const vault = generateVault(wfs, db, ws.config);
  const assetNotes = vault.results.filter((r) => r.vaultPath.startsWith("Assets/")).length;
  check("vault asset notes", assetNotes, GOLDEN_EXPECTATIONS.totalAssets);

  db.close();
  cleanupWorkspace(ws);

  console.log(`\n${failures.length === 0 ? "GOLDEN DATASET: ALL CHECKS PASSED" : `GOLDEN DATASET: ${failures.length} CHECK(S) FAILED`}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Golden dataset validation crashed:", err.message);
  process.exit(1);
});
