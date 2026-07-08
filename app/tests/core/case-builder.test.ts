import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { latestEvidenceAssessments } from "../../src/core/db/knowledge-repositories";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("case builder service", () => {
  it("lists all 8 seeded case templates", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-templates" });
    const { db } = await runScan(ws, "manual");
    const service = new CaseBuilderService(db);
    const templates = service.listTemplates();
    expect(templates.map((t) => t.templateKey).sort()).toEqual(
      [
        "brand_acquisition",
        "copyright_registration",
        "historical_timeline",
        "investor_due_diligence",
        "media_kit",
        "priority_of_use",
        "trademark_opposition",
        "trademark_registration",
      ].sort()
    );
    db.close();
    cleanupWorkspace(ws);
  });

  it("creates a case from a template with a permanent case key", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-create" });
    const { db } = await runScan(ws, "manual");
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("trademark_registration");
    expect(c.caseKey).toMatch(/^CASE-\d{6}$/);
    expect(c.caseType).toBe("trademark_registration");
    db.close();
    cleanupWorkspace(ws);
  });

  it("links assets by reference — never duplicates the underlying asset", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-link" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");

    service.linkAsset(c.id, asset.id, "Primary logo for media kit");
    const links = service.listLinks(c.id);
    expect(links.length).toBe(1);
    expect(links[0].linkedId).toBe(asset.id);

    const casesForAsset = service.casesForAsset(asset.id);
    expect(casesForAsset.map((cs) => cs.id)).toContain(c.id);

    db.close();
    cleanupWorkspace(ws);
  });

  it("unlinking a case never touches the asset row", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-unlink" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd"));
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");
    service.linkAsset(c.id, asset.id);
    const [link] = service.listLinks(c.id);

    service.unlink(link.id);
    expect(service.listLinks(c.id)).toEqual([]);
    expect(findAssetByPath(db, "logo.psd")).toBeDefined(); // asset itself untouched

    db.close();
    cleanupWorkspace(ws);
  });

  it("computes case evidence strength from linked assets' classification confidence", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-strength" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd")); // Design Source, confidence 95
    const { db } = await runScan(ws, "manual");
    const asset = findAssetByPath(db, "logo.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");
    service.linkAsset(c.id, asset.id);
    service.recomputeEvidenceStrength(c.id);

    const strength = latestEvidenceAssessments(db, "case", c.id).find((a) => a.dimension === "strength")!;
    expect(strength.score).toBe(100); // 1 of 1 linked assets is high-confidence

    db.close();
    cleanupWorkspace(ws);
  });

  it("flagging missing evidence does not require a real report to exist", async () => {
    const ws = makeFixtureWorkspace({ id: "case-fixture-missing" });
    const { db } = await runScan(ws, "manual");
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("priority_of_use");
    expect(() => service.flagMissingEvidence(c.id, "No dated proof of first sale found yet.", "high")).not.toThrow();
    db.close();
    cleanupWorkspace(ws);
  });
});
