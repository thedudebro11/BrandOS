import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { generateVault, generateAssetNote } from "../../src/core/services/vault-generator/vault-generator";
import { splitNoteContent } from "../../src/core/services/vault-generator/edit-preservation";
import { runKnowledgeReview } from "../../src/core/services/vault-generator/knowledge-review";
import { CaseBuilderService } from "../../src/core/services/case-builder/case-builder-service";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("vault generator — note creation", () => {
  it("generates real notes from real engine data, none fabricated", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-1" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd content"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);

    const summary = generateVault(wfs, db, ws.config);
    expect(summary.created).toBeGreaterThan(0);

    const asset = findAssetByPath(db, "logo.psd")!;
    const raw = wfs.readVaultFile(`Assets/${asset.assetId}.md`)!;
    expect(raw).toContain(asset.assetId);
    expect(raw).toContain("Design Source"); // real classification, not invented
    expect(raw).toContain("<!-- brandos:generated:start -->");
    expect(raw).toContain("<!-- brandos:generated:end -->");

    db.close();
    cleanupWorkspace(ws);
  });

  it("never writes outside the vault directory", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-2" });
    writeFixtureFile(ws, "a.txt", "x");
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    generateVault(wfs, db, ws.config);

    // The evidence tree must be untouched — only the original file, .brandos/, and the vault dir should exist.
    const rootEntries = fs.readdirSync(ws.rootDir);
    expect(rootEntries.sort()).toEqual([".brandos", "06_Obsidian", "a.txt", "workspace.json"].sort());

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("vault generator — incremental regeneration (Section 6)", () => {
  it("skips a note whose generated content is unchanged", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-3" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    const asset = findAssetByPath(db, "logo.psd")!;

    const first = generateAssetNote(wfs, db, asset.assetId)!;
    expect(first.outcome).toBe("created");

    const second = generateAssetNote(wfs, db, asset.assetId)!;
    expect(second.outcome).toBe("skipped_unchanged");

    db.close();
    cleanupWorkspace(ws);
  });

  it("regenerates when underlying data actually changes", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-4" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    const asset = findAssetByPath(db, "logo.psd")!;
    generateAssetNote(wfs, db, asset.assetId);

    // Add a manual note to the asset (real DB change) — the note body should now differ.
    const { addAssetNote } = await import("../../src/core/db/knowledge-repositories");
    addAssetNote(db, asset.id, "Confirmed as original source file.", "user");

    const second = generateAssetNote(wfs, db, asset.assetId)!;
    expect(second.outcome).toBe("updated");
    const raw = wfs.readVaultFile(`Assets/${asset.assetId}.md`)!;
    expect(raw).toContain("Confirmed as original source file.");

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("vault generator — user edit preservation (Section 5, ADR-008)", () => {
  it("never overwrites content the user added below the generated block", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-5" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    const asset = findAssetByPath(db, "logo.psd")!;
    generateAssetNote(wfs, db, asset.assetId);

    const vaultFilePath = path.join(wfs.obsidianVaultDir, `Assets/${asset.assetId}.md`);
    const original = fs.readFileSync(vaultFilePath, "utf-8");
    const withUserNotes = original + "\n## My Own Research\nFound the original sketch dated 2023.\n";
    fs.writeFileSync(vaultFilePath, withUserNotes);

    // Regenerate — nothing about the underlying data changed, but we still run it to prove preservation.
    generateAssetNote(wfs, db, asset.assetId);
    const afterRegen = fs.readFileSync(vaultFilePath, "utf-8");
    expect(afterRegen).toContain("Found the original sketch dated 2023.");

    db.close();
    cleanupWorkspace(ws);
  });

  it("detects a hand-edit to the generated block itself and refuses to overwrite it", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-6" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    const asset = findAssetByPath(db, "logo.psd")!;
    generateAssetNote(wfs, db, asset.assetId);

    const vaultFilePath = path.join(wfs.obsidianVaultDir, `Assets/${asset.assetId}.md`);
    const original = fs.readFileSync(vaultFilePath, "utf-8");
    const tampered = original.replace("# logo.psd", "# logo.psd (hand-corrected title)");
    fs.writeFileSync(vaultFilePath, tampered);

    const result = generateAssetNote(wfs, db, asset.assetId)!;
    expect(result.outcome).toBe("skipped_manual_edit");
    const stillThere = fs.readFileSync(vaultFilePath, "utf-8");
    expect(stillThere).toContain("(hand-corrected title)");

    db.close();
    cleanupWorkspace(ws);
  });

  it("splitNoteContent correctly separates the three zones", () => {
    const raw = `---\nfoo: bar\n---\n\n<!-- brandos:generated:start -->\nGenerated stuff\n<!-- brandos:generated:end -->\n\n## User section\nHello`;
    const split = splitNoteContent(raw);
    expect(split.generated).toBe("Generated stuff");
    expect(split.after).toContain("## User section");
    expect(split.after).toContain("Hello");
  });
});

describe("living knowledge review (Section 9)", () => {
  it("finds zero critical findings on a freshly-generated, internally-consistent vault", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-7" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    generateVault(wfs, db, ws.config);

    const findings = runKnowledgeReview(wfs, db);
    expect(findings.filter((f) => f.severity === "critical")).toEqual([]);

    db.close();
    cleanupWorkspace(ws);
  });

  it("flags a missing note when an asset has never been through vault generation", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-8" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    // Deliberately do NOT call generateVault — the asset exists in the DB but has no note.

    const findings = runKnowledgeReview(wfs, db);
    expect(findings.some((f) => f.findingType === "missing_note")).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("real case notes link to real supporting assets with no broken links", async () => {
    const ws = makeFixtureWorkspace({ id: "vault-fixture-9" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("1"));
    const { db } = await runScan(ws, "manual");
    const wfs = new WorkspaceFs(ws);
    const asset = findAssetByPath(db, "logo.psd")!;
    const service = new CaseBuilderService(db);
    const c = service.createFromTemplate("media_kit");
    service.linkAsset(c.id, asset.id);

    generateVault(wfs, db, ws.config);
    const findings = runKnowledgeReview(wfs, db);
    expect(findings.filter((f) => f.findingType === "broken_link")).toEqual([]);

    db.close();
    cleanupWorkspace(ws);
  });
});
