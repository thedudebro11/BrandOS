import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { runImport } from "../../src/core/services/import-pipeline/import-orchestrator";
import { findAssetByPath, listActiveAssets } from "../../src/core/db/repositories";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { listImportRuns } from "../../src/core/db/import-runs-repository";
import { buildZipMemberPath } from "../../src/plugins/importer-zip-archive/index";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

function buildTestZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile("logo.txt", Buffer.from("GOLDEN-ZIP-LOGO-CONTENT"));
  zip.addFile("docs/notes.txt", Buffer.from("GOLDEN-ZIP-NOTES-CONTENT"));
  return zip.toBuffer();
}

describe("ZIP Archive Importer — real extraction, provenance, and idempotency", () => {
  it("discovers every entry, assigns zip-provenance original_path, and never touches the source zip", async () => {
    const ws = makeFixtureWorkspace({ id: "zip-fixture-basic" });
    const zipBytes = buildTestZip();
    const zipAbsPath = writeFixtureFile(ws, path.join("Archive", "export.zip"), zipBytes);
    const originalZipBytes = fs.readFileSync(zipAbsPath);

    const { db, summary } = await runImport(ws, "importer-zip-archive", { kind: "zip", zipRelPath: "Archive/export.zip" }, "manual");

    expect(summary.assetsCreated).toBe(2);
    expect(listActiveAssets(db).length).toBe(2);

    const logoAsset = findAssetByPath(db, buildZipMemberPath("Archive/export.zip", "logo.txt"));
    const notesAsset = findAssetByPath(db, buildZipMemberPath("Archive/export.zip", "docs/notes.txt"));
    expect(logoAsset).toBeDefined();
    expect(notesAsset).toBeDefined();
    expect(logoAsset!.sha256).toBeTruthy();

    // The real zip on disk must be byte-identical after import — read-only evidence.
    expect(fs.readFileSync(zipAbsPath).equals(originalZipBytes)).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("cleans up its extraction scratch directory after the pipeline finishes", async () => {
    const ws = makeFixtureWorkspace({ id: "zip-fixture-cleanup" });
    writeFixtureFile(ws, path.join("Archive", "export.zip"), buildTestZip());
    const { db } = await runImport(ws, "importer-zip-archive", { kind: "zip", zipRelPath: "Archive/export.zip" }, "manual");

    const wfs = new WorkspaceFs(ws);
    const stagingRoot = path.join(wfs.brandosDir, ".import-staging");
    const leftover = fs.existsSync(stagingRoot) ? fs.readdirSync(stagingRoot) : [];
    expect(leftover).toEqual([]);

    db.close();
    cleanupWorkspace(ws);
  });

  it("re-importing the same unchanged zip is idempotent: zero new assets, same asset IDs reused", async () => {
    const ws = makeFixtureWorkspace({ id: "zip-fixture-idempotent" });
    writeFixtureFile(ws, path.join("Archive", "export.zip"), buildTestZip());

    const first = await runImport(ws, "importer-zip-archive", { kind: "zip", zipRelPath: "Archive/export.zip" }, "manual");
    const firstAssetIds = listActiveAssets(first.db).map((a) => a.assetId).sort();

    const second = await runImport(ws, "importer-zip-archive", { kind: "zip", zipRelPath: "Archive/export.zip" }, "manual");
    expect(second.summary.assetsCreated).toBe(0);
    expect(second.summary.assetsUpdated).toBe(0);

    const secondAssetIds = listActiveAssets(second.db).map((a) => a.assetId).sort();
    expect(secondAssetIds).toEqual(firstAssetIds);

    const runs = listImportRuns(second.db, 10);
    expect(runs.length).toBe(2);
    expect(runs.every((r) => r.pluginId === "importer-zip-archive")).toBe(true);
    expect(runs[0].assetsSkipped).toBe(2);

    first.db.close();
    second.db.close();
    cleanupWorkspace(ws);
  });

  it("rejects a source.kind mismatch and a missing zip file with clear errors, not a crash", async () => {
    const ws = makeFixtureWorkspace({ id: "zip-fixture-errors" });

    await expect(runImport(ws, "importer-zip-archive", { kind: "workspace_root" }, "manual")).rejects.toThrow(/only supports source.kind "zip"/);

    await expect(
      runImport(ws, "importer-zip-archive", { kind: "zip", zipRelPath: "does/not/exist.zip" }, "manual")
    ).rejects.toThrow(/No file at/);

    cleanupWorkspace(ws);
  });
});
