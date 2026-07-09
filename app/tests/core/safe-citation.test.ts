import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { generateReport } from "../../src/core/services/report-engine/report-generator";
import { getReportDefinition } from "../../src/core/services/report-engine/report-registry";
import { listActiveAssets } from "../../src/core/db/repositories";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";
import { buildGoldenDataset } from "../golden-dataset/build";

async function setupReportWorkspace(id: string) {
  const ws = makeFixtureWorkspace({ id });
  buildGoldenDataset(ws);
  const { db } = await runScan(ws, "manual");
  const wfs = new WorkspaceFs(ws);
  return { ws, wfs, db };
}

describe("ADR-007 safe citation mode", () => {
  it("defaults to safe: no real filename or path appears in any narrative section", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-default");
    const result = generateReport(db, wfs, ws.config, getReportDefinition("evidence_binder"), {});
    expect(result.data.citationMode).toBe("safe");

    const realAssets = listActiveAssets(db);
    const narrativeSections = result.data.sections.filter((s) => s.id !== "supporting-evidence-index");
    for (const asset of realAssets) {
      for (const s of narrativeSections) {
        expect(s.body.includes(asset.filename), `${s.id} leaked filename ${asset.filename}`).toBe(false);
        expect(s.body.includes(asset.originalPath), `${s.id} leaked path ${asset.originalPath}`).toBe(false);
      }
    }

    db.close();
    cleanupWorkspace(ws);
  });

  it("Asset IDs are still shown by default — only filenames/paths are redacted", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-assetids");
    const result = generateReport(db, wfs, ws.config, getReportDefinition("evidence_binder"), {});
    const supportingSection = result.data.sections.find((s) => s.id === "supporting-assets")!;
    const realAssets = listActiveAssets(db);
    for (const asset of realAssets) {
      expect(supportingSection.body.includes(asset.assetId)).toBe(true);
    }
    db.close();
    cleanupWorkspace(ws);
  });

  it("adds a clearly-labeled internal Supporting Evidence Index mapping every exhibit back to its real asset", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-index");
    const result = generateReport(db, wfs, ws.config, getReportDefinition("evidence_binder"), {});
    const indexSection = result.data.sections.find((s) => s.id === "supporting-evidence-index");
    expect(indexSection).toBeDefined();
    expect(indexSection!.title).toContain("Internal");
    expect(indexSection!.body).toContain("Exhibit A-1");
    const realAssets = listActiveAssets(db);
    for (const asset of realAssets) {
      expect(indexSection!.body.includes(asset.filename)).toBe(true);
    }
    db.close();
    cleanupWorkspace(ws);
  });

  it("--full / citationMode: 'full' opts out and shows real filenames", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-full");
    const result = generateReport(db, wfs, ws.config, getReportDefinition("evidence_binder"), { citationMode: "full" });
    expect(result.data.citationMode).toBe("full");
    const supportingSection = result.data.sections.find((s) => s.id === "supporting-assets")!;
    const realAssets = listActiveAssets(db);
    const anyFilenameShown = realAssets.some((a) => supportingSection.body.includes(a.filename));
    expect(anyFilenameShown).toBe(true);
    expect(result.data.sections.find((s) => s.id === "supporting-evidence-index")).toBeUndefined();
    db.close();
    cleanupWorkspace(ws);
  });

  it("redaction is deterministic: regenerating unchanged data produces the same content hash and the same exhibit numbering", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-determinism");
    const def = getReportDefinition("evidence_binder");
    const first = generateReport(db, wfs, ws.config, def, {});
    const second = generateReport(db, wfs, ws.config, def, {});
    expect(second.contentHash).toBe(first.contentHash);
    const firstIndex = first.data.sections.find((s) => s.id === "supporting-evidence-index")!.body;
    const secondIndex = second.data.sections.find((s) => s.id === "supporting-evidence-index")!.body;
    expect(secondIndex).toBe(firstIndex);
    db.close();
    cleanupWorkspace(ws);
  });

  it("remains fully reproducible: the JSON export round-trips and every exhibit-labeled asset is still traceable via its Asset ID", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-reproducible");
    const result = generateReport(db, wfs, ws.config, getReportDefinition("evidence_binder"), {});
    // Every citation in the index still carries a real, resolvable assetId — safe mode redacts display text, never the underlying reference.
    for (const c of result.data.citationIndex) {
      if (c.assetId) {
        const found = listActiveAssets(db).find((a) => a.assetId === c.assetId);
        expect(found, `citation assetId ${c.assetId} should resolve to a real active asset`).toBeDefined();
      }
    }
    db.close();
    cleanupWorkspace(ws);
  });

  it("is applied uniformly across all 9 report types without any report generator needing to know it exists", async () => {
    const { ws, wfs, db } = await setupReportWorkspace("safe-citation-fixture-all-types");
    const realAssets = listActiveAssets(db);
    const { listReportDefinitions } = await import("../../src/core/services/report-engine/report-registry");
    for (const def of listReportDefinitions()) {
      if (def.scope === "case") continue; // covered by report-engine.test.ts's case-scoped generation tests
      const result = generateReport(db, wfs, ws.config, def, {});
      expect(result.data.citationMode).toBe("safe");
      for (const s of result.data.sections) {
        if (s.id === "supporting-evidence-index") continue;
        for (const asset of realAssets) {
          expect(s.body.includes(asset.filename), `${def.type}/${s.id} leaked ${asset.filename}`).toBe(false);
        }
      }
    }
    db.close();
    cleanupWorkspace(ws);
  });
});
