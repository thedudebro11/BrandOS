import type { WorkspaceDatabase } from "../../db/connection";
import type { ReportData, ReportContent } from "./report-types";

interface AssetFileFacts {
  assetId: string;
  filename: string;
  originalPath: string;
  sha256: string | null;
}

/**
 * ADR-007 Safe Citation Mode (Phase 9 special requirement). A single,
 * generator-agnostic implementation point: every one of the 9 report
 * generators keeps writing filenames/paths into its own prose exactly as
 * before (report-content generators have no idea this exists), and this
 * function — called once, right after generation, before validation or
 * hashing — mechanically strips them back out when safe mode is active.
 * This is deliberately NOT built into report-helpers.ts's citation builders
 * or into any individual generator: doing it once here means a 10th report
 * type gets ADR-007 compliance for free, with no way to forget it.
 *
 * Mechanism: scans every active asset in the workspace (not just those in
 * this report's own citationIndex) against the report's actual rendered
 * text, because a filename can legitimately appear in a section's body via
 * a path this report generator didn't itself add as a Citation — e.g.
 * Evidence Binder's Chain of Custody section embeds
 * traceResolvedDateProvenance()'s "Cross-Referenced Source Asset" line,
 * which names a *different* asset than the one being traced and was never
 * independently cited. Restricting the redaction dictionary to
 * citationIndex alone was tried first and found, by real generated output
 * against Fatletic, to miss exactly this case — fixed by scanning the whole
 * workspace's file facts against the actual text instead of trusting the
 * citation list to be complete. Every literal occurrence of a real filename
 * or path is replaced with an Exhibit label; Asset IDs (AST-########) are
 * never touched — ADR-007 asks that they be the default reference, not that
 * they be hidden too.
 *
 * Known limitation, stated rather than hidden: this is an exact-substring
 * replacement, not a semantic redaction — a filename that also happens to
 * appear as a coincidental substring of unrelated text would be redacted
 * too. Not a concern found in any of the 9 report types' real output against
 * Fatletic's real filenames, but a real edge case for very short or generic
 * filenames worth knowing about rather than assuming away.
 */
export function applySafeCitationMode(content: ReportContent, db: WorkspaceDatabase, mode: "safe" | "full"): ReportData {
  if (mode === "full") {
    return { ...content, citationMode: "full" };
  }

  const allAssets = db.all<{ asset_id: string; filename: string; original_path: string; sha256: string | null }>(
    "SELECT asset_id, filename, original_path, sha256 FROM assets"
  );

  // Determine which assets' filenames/paths actually appear anywhere in this
  // report's real text, and in what order — so exhibit numbering matches
  // the order a reader actually encounters each one, and the Supporting
  // Evidence Index never lists an asset this report never mentioned.
  const fullText = content.sections.map((s) => s.body + " " + s.citations.map((c) => c.description).join(" ")).join("\n");
  const withFirstIndex: (AssetFileFacts & { firstIndex: number })[] = [];
  for (const a of allAssets) {
    const pathIdx = a.original_path ? fullText.indexOf(a.original_path) : -1;
    const nameIdx = a.filename ? fullText.indexOf(a.filename) : -1;
    const candidates = [pathIdx, nameIdx].filter((i) => i >= 0);
    if (candidates.length === 0) continue;
    withFirstIndex.push({ assetId: a.asset_id, filename: a.filename, originalPath: a.original_path, sha256: a.sha256, firstIndex: Math.min(...candidates) });
  }
  const facts = withFirstIndex.sort((a, b) => a.firstIndex - b.firstIndex);

  const exhibitByAssetId = new Map<string, string>();
  facts.forEach((f, i) => exhibitByAssetId.set(f.assetId, `Exhibit A-${i + 1}`));

  function redact(text: string): string {
    let result = text;
    for (const fact of facts) {
      const exhibit = exhibitByAssetId.get(fact.assetId)!;
      const label = `[${exhibit}]`;
      if (fact.originalPath) result = result.split(fact.originalPath).join(label);
      if (fact.filename && fact.filename !== fact.originalPath) result = result.split(fact.filename).join(label);
    }
    return result;
  }

  const sections = content.sections.map((s) => ({
    ...s,
    body: redact(s.body),
    citations: s.citations.map((c) => ({ ...c, description: redact(c.description) })),
  }));

  const indexBody =
    facts.length === 0
      ? "No assets were cited in this report."
      : facts
          .map((f) => `- **${exhibitByAssetId.get(f.assetId)}** — Asset ID \`${f.assetId}\`, filename \`${f.filename}\`, path \`${f.originalPath}\`, SHA-256 \`${f.sha256 ?? "(not yet hashed)"}\``)
          .join("\n");

  const evidenceIndexSection = {
    id: "supporting-evidence-index",
    title: "Supporting Evidence Index (Internal — Do Not Distribute)",
    body:
      "Safe Citation Mode is active: filenames and paths are replaced with Exhibit labels throughout this report. " +
      "This section preserves full internal traceability and must not be shared outside the organization together with the rest of this document.\n\n" +
      indexBody,
    citations: facts.map((f) => ({ assetId: f.assetId, description: `Internal traceability record for ${exhibitByAssetId.get(f.assetId)}.` })),
    allowEmptyCitations: facts.length === 0,
  };

  const citationIndex = sections.flatMap((s) => s.citations);
  const seen = new Set<string>();
  const dedupedCitationIndex = citationIndex.concat(evidenceIndexSection.citations).filter((c) => {
    const key = [c.assetId ?? "", c.timelineEventId ?? "", c.caseId ?? "", c.description].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...content,
    sections: [...sections, evidenceIndexSection],
    citationIndex: dedupedCitationIndex,
    citationMode: "safe",
  };
}
