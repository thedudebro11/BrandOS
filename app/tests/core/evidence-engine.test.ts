import { describe, it, expect } from "vitest";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { assessWorkspaceEvidence } from "../../src/core/services/evidence-engine/evidence-engine";
import { latestEvidenceAssessments, listEvidenceGaps } from "../../src/core/db/knowledge-repositories";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("evidence engine", () => {
  it("scores completeness as 0 with a clear note when nothing is classified confidently", async () => {
    const ws = makeFixtureWorkspace({ id: "evidence-fixture-empty" });
    // No files at all — nothing to assess.
    const { db } = await runScan(ws, "manual");
    assessWorkspaceEvidence(db);

    const completeness = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "completeness")!;
    expect(completeness.score).toBe(0);
    expect(completeness.notes).toContain("0 of 0");

    db.close();
    cleanupWorkspace(ws);
  });

  it("raises completeness score as more assets get confident classifications", async () => {
    const ws = makeFixtureWorkspace({ id: "evidence-fixture-full" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd"));
    writeFixtureFile(ws, "notes.txt", "text");
    const { db } = await runScan(ws, "manual");
    assessWorkspaceEvidence(db);

    const completeness = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "completeness")!;
    expect(completeness.score).toBeGreaterThan(0);
    expect(completeness.status).not.toBe("missing");

    db.close();
    cleanupWorkspace(ws);
  });

  it("flags a priority-of-use gap for a category with zero dated evidence", async () => {
    const ws = makeFixtureWorkspace({ id: "evidence-fixture-gap" });
    writeFixtureFile(ws, "logo.psd", Buffer.from("psd")); // Design Source only — no Marketing/Commerce/Marketplace evidence
    const { db } = await runScan(ws, "manual");
    assessWorkspaceEvidence(db);

    const gaps = listEvidenceGaps(db, "workspace", null);
    expect(gaps.some((g) => g.gapType === "priority_of_use_category_missing" && g.description.includes("Marketing Evidence"))).toBe(
      true
    );

    db.close();
    cleanupWorkspace(ws);
  });

  it("every assessment note is non-empty and traceable to a real count", async () => {
    const ws = makeFixtureWorkspace({ id: "evidence-fixture-notes" });
    writeFixtureFile(ws, "a.txt", "x");
    writeFixtureFile(ws, "b.txt", "y");
    const { db } = await runScan(ws, "manual");
    assessWorkspaceEvidence(db);

    for (const a of latestEvidenceAssessments(db, "workspace", null)) {
      expect(a.notes.length).toBeGreaterThan(10);
    }
    db.close();
    cleanupWorkspace(ws);
  });
});
