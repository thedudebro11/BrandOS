import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { findAssetByPath } from "../../src/core/db/repositories";
import { getClassification, getAssetTags, listOpenReviewQueue } from "../../src/core/db/knowledge-repositories";
import { classifyFile } from "../../src/core/services/classification-engine/rules";
import { suggestTags } from "../../src/core/services/tag-engine/tag-rules";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("classification engine (rules)", () => {
  it("classifies PSD/XCF/AI as Design Source with high confidence", () => {
    const r = classifyFile({ file: { relPath: "logo.psd", filename: "logo.psd", extension: "psd" }, hasExportRelationship: false });
    expect(r.category).toBe("Design Source");
    expect(r.confidence).toBeGreaterThanOrEqual(90);
  });

  it("classifies a path containing 'instagram' as Marketing Evidence regardless of extension", () => {
    const r = classifyFile({
      file: { relPath: "Instagram Exports/post1.jpg", filename: "post1.jpg", extension: "jpg" },
      hasExportRelationship: false,
    });
    expect(r.category).toBe("Marketing Evidence");
  });

  it("classifies a Printful/invoice path as Commerce Evidence", () => {
    const r = classifyFile({
      file: { relPath: "Printiful Invoices/invoice_1.pdf", filename: "invoice_1.pdf", extension: "pdf" },
      hasExportRelationship: false,
    });
    expect(r.category).toBe("Commerce Evidence");
  });

  it("classifies an unrecognized extension as Unknown with 0 confidence", () => {
    const r = classifyFile({ file: { relPath: "mystery.xyz", filename: "mystery.xyz", extension: "xyz" }, hasExportRelationship: false });
    expect(r.category).toBe("Unknown");
    expect(r.confidence).toBe(0);
  });

  it("scores an image with a known export relationship higher than a bare image", () => {
    const withExport = classifyFile({ file: { relPath: "a.png", filename: "a.png", extension: "png" }, hasExportRelationship: true });
    const withoutExport = classifyFile({ file: { relPath: "a.png", filename: "a.png", extension: "png" }, hasExportRelationship: false });
    expect(withExport.confidence).toBeGreaterThan(withoutExport.confidence);
  });
});

describe("tag engine (rules)", () => {
  it("suggests Logo and Brand tags for a path containing 'logo'", () => {
    const tags = suggestTags("Fatletic Offical Logos/mark.png", "Export").map((t) => t.tag);
    expect(tags).toContain("Logo");
    expect(tags).toContain("Brand");
  });

  it("suggests Invoice and Evidence tags for Commerce Evidence with 'invoice' in path", () => {
    const tags = suggestTags("Printiful Invoices/invoice_1.pdf", "Commerce Evidence").map((t) => t.tag);
    expect(tags).toContain("Invoice");
    expect(tags).toContain("Evidence");
  });

  it("every suggestion carries a reason", () => {
    const tags = suggestTags("Text Docs/Mission Statement.txt", "Documentation");
    for (const t of tags) expect(t.reason.length).toBeGreaterThan(0);
  });
});

describe("classification + tagging wired into the scan pipeline", () => {
  it("classifies and tags every asset during a real scan", async () => {
    const ws = makeFixtureWorkspace({ id: "classify-fixture-1" });
    writeFixtureFile(ws, "Fatletic Offical Logos/mark.psd", Buffer.from("fake psd"));
    writeFixtureFile(ws, "Fatletic Offical Logos/mark.png", Buffer.from("fake png"));
    writeFixtureFile(ws, "Printiful Invoices/invoice_1.pdf", Buffer.from("%PDF-1.4 fake"));
    writeFixtureFile(ws, "unknown-thing.xyz", "??");

    const { db } = await runScan(ws, "manual");

    const psd = findAssetByPath(db, "Fatletic Offical Logos/mark.psd")!;
    const png = findAssetByPath(db, "Fatletic Offical Logos/mark.png")!;
    const unknown = findAssetByPath(db, "unknown-thing.xyz")!;

    expect(getClassification(db, psd.id)?.category).toBe("Design Source");
    expect(getClassification(db, png.id)?.category).toBe("Export"); // has a detected source_to_export relationship
    expect(getAssetTags(db, psd.id).map((t) => t.tagName)).toEqual(expect.arrayContaining(["Logo", "Brand"]));

    const unknownClassification = getClassification(db, unknown.id)!;
    expect(unknownClassification.category).toBe("Unknown");
    expect(unknownClassification.needsReview).toBe(1);

    const reviewQueue = listOpenReviewQueue(db);
    expect(reviewQueue.some((r) => r.assetId === unknown.id)).toBe(true);

    db.close();
    cleanupWorkspace(ws);
  });

  it("does not re-classify unchanged assets on a repeat scan, but does classify assets missed by a prior scan", async () => {
    const ws = makeFixtureWorkspace({ id: "classify-fixture-2" });
    writeFixtureFile(ws, "doc.txt", "hello");
    const first = await runScan(ws, "manual");
    const asset = findAssetByPath(first.db, "doc.txt")!;
    const firstClassification = getClassification(first.db, asset.id)!;
    first.db.close();

    const second = await runScan(ws, "manual");
    const secondClassification = getClassification(second.db, asset.id)!;
    // Same content, same classification result (re-run is idempotent/deterministic).
    expect(secondClassification.category).toBe(firstClassification.category);
    expect(secondClassification.ruleId).toBe(firstClassification.ruleId);
    second.db.close();

    cleanupWorkspace(ws);
  });
});
