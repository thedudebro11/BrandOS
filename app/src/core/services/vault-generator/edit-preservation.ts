import crypto from "node:crypto";

export const GENERATED_START = "<!-- brandos:generated:start -->";
export const GENERATED_END = "<!-- brandos:generated:end -->";

export interface SplitNote {
  /** Content before the generated block — normally just frontmatter. Always regenerated. */
  before: string;
  /** Content between the markers, or null if the file predates this format / markers are missing or malformed. */
  generated: string | null;
  /** Everything after the closing marker — the user's own content. Never touched by the generator. */
  after: string;
}

/**
 * Splits an existing note file into its three zones. Only the middle zone
 * (`generated`) is ever compared/replaced by the vault generator; `after` is
 * preserved byte-for-byte across every regeneration (ARCHITECTURE_DECISIONS.md
 * ADR-008, Phase 6 Section 5).
 */
export function splitNoteContent(raw: string): SplitNote {
  const startIdx = raw.indexOf(GENERATED_START);
  const endIdx = raw.indexOf(GENERATED_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { before: raw, generated: null, after: "" };
  }
  return {
    before: raw.slice(0, startIdx),
    generated: raw.slice(startIdx + GENERATED_START.length, endIdx).trim(),
    after: raw.slice(endIdx + GENERATED_END.length),
  };
}

export function buildNoteFile(frontmatter: string, generatedBody: string, preservedAfter: string): string {
  const after = preservedAfter.trim().length > 0 ? preservedAfter : "\n\n<!-- Add your own notes below this line — they will never be overwritten by BrandOS. -->\n";
  return `${frontmatter.trimEnd()}\n\n${GENERATED_START}\n${generatedBody.trim()}\n${GENERATED_END}\n${after}`;
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}
