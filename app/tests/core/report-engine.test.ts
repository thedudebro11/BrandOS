import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { runMigrations } from "../../src/core/db/migrate";
import { listActiveAssets } from "../../src/core/db/repositories";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { listReportDefinitions, getReportDefinition } from "../../src/core/services/report-engine/report-registry";
import { generateReport, hashReportContent } from "../../src/core/services/report-engine/report-generator";
import { validateReport } from "../../src/core/services/report-engine/report-validation";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";
import { buildGoldenDataset } from "../golden-dataset/build";

async function setupWorkspaceWithCase(id: string) {
  const ws = makeFixtureWorkspace({ id });
  buildGoldenDataset(ws);
  const { db } = await runScan(ws, "manual");
  const wfs = new WorkspaceFs(ws);
  const cases = new CaseBuilderService(db);
  const theCase = cases.createCustom("Report Engine Test Case", "internal_review", "Fixture case for report tests");
  for (const asset of listActiveAssets(db)) cases.linkAsset(theCase.id, asset.id);
  return { ws, wfs, db, caseId: theCase.id };
}

describe("report engine — generation across all 9 report types", () => {
  it("every registered report type generates successfully against a real, non-empty workspace", async () => {
    const { ws, wfs, db, caseId } = await setupWorkspaceWithCase("report-fixture-all-types");

    for (const def of listReportDefinitions()) {
      const opts = def.scope === "case" ? { caseId } : {};
      const result = generateReport(db, wfs, ws.config, def, opts);
      expect(result.data.sections.length, `${def.type} should have sections`).toBeGreaterThan(0);
      expect(result.findings.filter((f) => f.severity === "critical")).toHaveLength(0);
    }

    db.close();
    cleanupWorkspace(ws);
  });

  it("Evidence Binder generates for both workspace scope and case scope", async () => {
    const { ws, wfs, db, caseId } = await setupWorkspaceWithCase("report-fixture-binder-scopes");
    const def = getReportDefinition("evidence_binder");

    const workspaceScoped = generateReport(db, wfs, ws.config, def, {});
    expect(workspaceScoped.data.caseId).toBeNull();

    const caseScoped = generateReport(db, wfs, ws.config, def, { caseId });
    expect(caseScoped.data.caseId).toBe(caseId);
    expect(caseScoped.data.sections.length).toBeGreaterThan(0);

    db.close();
    cleanupWorkspace(ws);
  });

  it("case_summary requires a caseId and throws a clear error without one", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-case-required");
    const def = getReportDefinition("case_summary");
    expect(() => generateReport(db, wfs, ws.config, def, {})).toThrow(/requires opts.caseId/);
    db.close();
    cleanupWorkspace(ws);
  });
});

describe("report engine — determinism", () => {
  it("regenerating the same report from unchanged data produces an identical content hash", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-determinism");
    const def = getReportDefinition("workspace_health");

    const first = generateReport(db, wfs, ws.config, def, {});
    const second = generateReport(db, wfs, ws.config, def, {});
    expect(second.contentHash).toBe(first.contentHash);

    // Independently: hashing the same ReportData twice (bypassing generation entirely) is stable regardless of key insertion order.
    const a = hashReportContent({ ...first.data, generatedAt: "X" });
    const b = hashReportContent({ ...first.data, generatedAt: "Y" });
    expect(a).toBe(b); // generatedAt is excluded from the hash by design

    db.close();
    cleanupWorkspace(ws);
  });

  it("a real data change produces a different content hash", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-determinism-change");
    const def = getReportDefinition("needs_review");
    const before = generateReport(db, wfs, ws.config, def, {});

    // Real change: resolve one open review-queue item so the report's actual content differs.
    // (sql.js's SQLite build has no UPDATE...LIMIT support, hence the subquery.)
    db.run("UPDATE review_queue SET status = 'resolved' WHERE id = (SELECT id FROM review_queue WHERE status = 'open' LIMIT 1)");
    const after = generateReport(db, wfs, ws.config, def, {});

    expect(after.contentHash).not.toBe(before.contentHash);

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("report engine — citation integrity", () => {
  it("every section without allowEmptyCitations carries at least one citation, for every report type", async () => {
    const { ws, wfs, db, caseId } = await setupWorkspaceWithCase("report-fixture-citations");

    for (const def of listReportDefinitions()) {
      const opts = def.scope === "case" ? { caseId } : {};
      const result = generateReport(db, wfs, ws.config, def, opts);
      for (const section of result.data.sections) {
        if (!section.allowEmptyCitations) {
          expect(section.citations.length, `${def.type} section "${section.id}" must have a citation`).toBeGreaterThan(0);
        }
      }
    }

    db.close();
    cleanupWorkspace(ws);
  });

  it("every citation with an assetId references a real, currently-active asset", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-citation-assets");
    const activeAssetIds = new Set(listActiveAssets(db).map((a) => a.assetId));

    const def = getReportDefinition("evidence_binder");
    const result = generateReport(db, wfs, ws.config, def, {});
    for (const c of result.data.citationIndex) {
      if (c.assetId) expect(activeAssetIds.has(c.assetId), `citation references unknown asset ${c.assetId}`).toBe(true);
    }

    db.close();
    cleanupWorkspace(ws);
  });

  it("validateReport() independently confirms zero critical findings on a real generated report", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-validate-standalone");
    const def = getReportDefinition("trademark_readiness");
    const result = generateReport(db, wfs, ws.config, def, {});
    const findings = validateReport(result.data);
    expect(findings.filter((f) => f.severity === "critical")).toHaveLength(0);
    db.close();
    cleanupWorkspace(ws);
  });
});

describe("report engine — missing evidence handling", () => {
  it("every workspace-scoped report generates honestly on a completely empty workspace, without crashing or fabricating content", async () => {
    const ws = makeFixtureWorkspace({ id: "report-fixture-empty" });
    const { db } = await runScan(ws, "manual"); // zero files
    const wfs = new WorkspaceFs(ws);
    runMigrations(db);

    for (const def of listReportDefinitions()) {
      if (def.scope === "case") continue; // case-scoped reports legitimately require a case; covered separately
      const result = generateReport(db, wfs, ws.config, def, {});
      expect(result.data.sections.length).toBeGreaterThan(0);
      expect(result.findings.filter((f) => f.severity === "critical")).toHaveLength(0);
    }

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("report engine — confidence explanations", () => {
  it("citations for dated evidence carry a real confidence score and reasoning-backed description, not a placeholder", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-confidence");
    const def = getReportDefinition("priority_of_use_dossier");
    const result = generateReport(db, wfs, ws.config, def, {});

    const withConfidence = result.data.citationIndex.filter((c) => c.assetId && c.confidence !== undefined);
    expect(withConfidence.length).toBeGreaterThan(0);
    for (const c of withConfidence) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(100);
      expect(c.description.length).toBeGreaterThan(0);
    }

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("report engine — multi-workspace & isolation", () => {
  it("two independently-scanned workspaces produce reports scoped to their own workspace identity and their own `reports` table", async () => {
    const a = await setupWorkspaceWithCase("report-fixture-isolation-a");
    const b = await setupWorkspaceWithCase("report-fixture-isolation-b");

    // Both use the same deterministic golden dataset, so asset ID strings are
    // expected to collide (AST-00000001 in both) — asset IDs are only unique
    // WITHIN a workspace (ADR-001), never globally, so that is not the
    // isolation property to test. The real property: each report is correctly
    // attributed to its own workspace, and generating in A never creates a
    // `reports` row in B's database.
    const defA = getReportDefinition("evidence_binder");
    const resultA = generateReport(a.db, a.wfs, a.ws.config, defA, {});
    expect(resultA.data.workspaceId).toBe(a.ws.config.id);
    expect(resultA.data.workspaceId).not.toBe(b.ws.config.id);

    const bReportCountBefore = b.db.get<{ c: number }>("SELECT COUNT(*) as c FROM reports")?.c ?? 0;
    expect(bReportCountBefore).toBe(0); // B has generated nothing yet in this test

    a.db.close();
    b.db.close();
    cleanupWorkspace(a.ws);
    cleanupWorkspace(b.ws);
  });

  it("a report generated for workspace A is never written into workspace B's exports directory", async () => {
    const a = await setupWorkspaceWithCase("report-fixture-nowrite-a");
    const b = await setupWorkspaceWithCase("report-fixture-nowrite-b");

    generateReport(a.db, a.wfs, a.ws.config, getReportDefinition("workspace_health"), {});

    expect(fs.existsSync(path.join(a.wfs.exportsDir, "workspace_health"))).toBe(true);
    expect(fs.existsSync(path.join(b.wfs.exportsDir, "workspace_health"))).toBe(false);

    a.db.close();
    b.db.close();
    cleanupWorkspace(a.ws);
    cleanupWorkspace(b.ws);
  });
});

describe("report engine — export validation", () => {
  it("all 4 output files are written, are non-empty, and the JSON output round-trips to the same data", async () => {
    const { ws, wfs, db } = await setupWorkspaceWithCase("report-fixture-export");
    const def = getReportDefinition("workspace_health");
    const result = generateReport(db, wfs, ws.config, def, {});

    const mdPath = path.join(wfs.exportsDir, result.paths.markdown);
    const htmlPath = path.join(wfs.exportsDir, result.paths.html);
    const pdfHtmlPath = path.join(wfs.exportsDir, result.paths.pdfHtml);
    const jsonPath = path.join(wfs.exportsDir, result.paths.json);

    for (const p of [mdPath, htmlPath, pdfHtmlPath, jsonPath]) {
      expect(fs.existsSync(p), `${p} should exist`).toBe(true);
      expect(fs.readFileSync(p, "utf-8").length).toBeGreaterThan(0);
    }

    expect(fs.readFileSync(mdPath, "utf-8")).toContain(result.data.title);
    expect(fs.readFileSync(htmlPath, "utf-8")).toContain("<!doctype html>");
    expect(fs.readFileSync(pdfHtmlPath, "utf-8")).toContain("@page");

    const roundTripped = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    expect(roundTripped.reportType).toBe(result.data.reportType);
    expect(roundTripped.citationIndex.length).toBe(result.data.citationIndex.length);

    db.close();
    cleanupWorkspace(ws);
  });

  it("never writes outside the workspace's exports directory", () => {
    const ws = makeFixtureWorkspace({ id: "report-fixture-export-guard" });
    const wfs = new WorkspaceFs(ws);
    expect(() => wfs.writeExport("../../escape.md", "x")).toThrow(/Refusing to write outside the exports dir/);
    cleanupWorkspace(ws);
  });
});
