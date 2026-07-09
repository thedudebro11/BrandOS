import type { AssetIntelligenceView } from "../asset-intelligence/asset-intelligence";
import type { CaseRecord, EvidenceAssessment } from "../../types";

/**
 * Every function here does one thing: turn already-computed engine data into
 * Markdown. None of them query the database, compute a score, or infer
 * anything — that would violate Phase 6 Section 8 ("never invent facts").
 * "Summary" fields below are templated sentences assembled from real fields,
 * never free-form generated prose.
 */

function frontmatter(fields: Record<string, string | number | null>): string {
  const lines = ["---", ...Object.entries(fields).map(([k, v]) => `${k}: ${v === null ? '""' : JSON.stringify(String(v))}`), "---"];
  return lines.join("\n");
}

function wikilink(id: string, label?: string): string {
  return label ? `[[${id}|${label}]]` : `[[${id}]]`;
}

// ---- asset notes ----

export function assetNoteFrontmatter(view: AssetIntelligenceView): string {
  return frontmatter({
    brandos_entity_type: "asset",
    brandos_asset_id: view.asset.assetId,
    brandos_generated_at: new Date().toISOString(),
  });
}

export function assetNoteBody(view: AssetIntelligenceView): string {
  const { asset, classification, tags, relationships, timelineEvents, linkedCases, notes } = view;
  const lines: string[] = [];

  lines.push(`# ${asset.filename}`);
  lines.push("");
  lines.push(`**Asset ID:** \`${asset.assetId}\``);
  lines.push("");

  // Summary: a templated sentence from real fields, not generated prose.
  const summaryParts: string[] = [];
  if (classification) summaryParts.push(`classified as **${classification.category}** (confidence ${classification.confidence}/100)`);
  else summaryParts.push("not yet classified");
  if (tags.length > 0) summaryParts.push(`tagged ${tags.map((t) => t.tagName).join(", ")}`);
  lines.push(`**Summary:** ${asset.filename} is ${summaryParts.join("; ")}.`);
  lines.push("");

  lines.push("## Metadata");
  lines.push(`- Original path: \`${asset.originalPath}\``);
  lines.push(`- SHA-256: \`${asset.sha256 ?? "(not yet hashed)"}\``);
  if (view.metadata.length > 0) {
    for (const m of view.metadata) lines.push(`- ${m.key}: ${m.value} _(${m.source})_`);
  }
  lines.push("");

  lines.push("## Classification & Confidence");
  if (classification) {
    lines.push(`- Category: **${classification.category}**`);
    lines.push(`- Confidence: ${classification.confidence}/100`);
    lines.push(`- Reason: ${classification.reason}`);
    if (classification.needsReview) lines.push(`- ⚠️ Needs human review (confidence below 70)`);
  } else {
    lines.push("_Not yet classified._");
  }
  lines.push("");

  lines.push("## Tags");
  lines.push(tags.length > 0 ? tags.map((t) => `#${t.tagName.replace(/\s+/g, "_")}`).join(" ") : "_No tags._");
  lines.push("");

  lines.push("## Timeline");
  if (view.resolvedDate) {
    lines.push(
      `**Resolved date:** ${view.resolvedDate.resolvedDate.slice(0, 10)} (confidence ${view.resolvedDate.confidence}/100, source: ${view.resolvedDate.sourceType})`
    );
    lines.push("");
    lines.push(`_${view.resolvedDate.reasoning}_`);
  } else {
    lines.push("**Resolved date:** _No plausible date could be resolved from any evidence source._");
  }
  lines.push("");
  lines.push("<details><summary>Raw candidate events (unfiltered — see Resolved date above for the engine's actual answer)</summary>");
  lines.push("");
  if (timelineEvents.length > 0) {
    for (const t of timelineEvents) lines.push(`- ${t.eventDate.slice(0, 10)} — ${t.title} _(confidence ${t.confidence})_`);
  } else {
    lines.push("_No timeline events recorded._");
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("## Relationships");
  if (relationships.length > 0) {
    for (const r of relationships) {
      lines.push(`- ${r.direction === "outgoing" ? "→" : "←"} ${wikilink(`AST-${String(r.otherAssetId).padStart(8, "0")}`)} (${r.type}, confidence ${r.confidence})`);
    }
  } else {
    lines.push("_No known relationships to other assets._");
  }
  lines.push("");

  lines.push("## Supporting Cases");
  lines.push(linkedCases.length > 0 ? linkedCases.map((c) => `- ${wikilink(`CASE-${String(c.id).padStart(6, "0")}`, c.title)}`).join("\n") : "_Not linked to any case._");
  lines.push("");

  lines.push("## Notes");
  lines.push(notes.length > 0 ? notes.map((n) => `- _${n.createdAt}_ (${n.author}): ${n.note}`).join("\n") : "_No notes recorded in BrandOS._");
  lines.push("");

  lines.push("## Original File");
  lines.push(`\`${asset.originalPath}\` (read-only — BrandOS never moves, renames, or modifies original evidence)`);

  return lines.join("\n");
}

// ---- case notes ----

export interface CaseNoteData {
  theCase: CaseRecord;
  evidenceOverview: EvidenceAssessment | undefined;
  supportingAssetIds: string[];
  missingEvidence: { description: string; priority: string }[];
  relatedCaseIds: number[];
}

export function caseNoteFrontmatter(data: CaseNoteData): string {
  return frontmatter({
    brandos_entity_type: "case",
    brandos_case_key: data.theCase.caseKey ?? "",
    brandos_generated_at: new Date().toISOString(),
  });
}

export function caseNoteBody(data: CaseNoteData): string {
  const { theCase, evidenceOverview, supportingAssetIds, missingEvidence, relatedCaseIds } = data;
  const lines: string[] = [];

  lines.push(`# ${theCase.title}`);
  lines.push("");
  lines.push(`**Case Key:** \`${theCase.caseKey}\` · **Type:** ${theCase.caseType} · **Status:** ${theCase.status}`);
  lines.push("");
  lines.push(`**Summary:** ${theCase.purpose ?? "No purpose recorded yet."}`);
  lines.push("");

  lines.push("## Evidence Overview & Confidence");
  if (evidenceOverview) {
    lines.push(`- Score: **${evidenceOverview.score}/100** (${evidenceOverview.status})`);
    lines.push(`- ${evidenceOverview.notes}`);
  } else {
    lines.push("_No evidence linked yet — nothing to assess._");
  }
  lines.push("");

  lines.push(`## Supporting Assets (${supportingAssetIds.length})`);
  lines.push(supportingAssetIds.length > 0 ? supportingAssetIds.map((id) => `- ${wikilink(id)}`).join("\n") : "_No assets linked yet._");
  lines.push("");

  lines.push("## Missing Evidence");
  lines.push(
    missingEvidence.length > 0
      ? missingEvidence.map((m) => `- [${m.priority}] ${m.description}`).join("\n")
      : "_No missing-evidence items flagged._"
  );
  lines.push("");

  lines.push("## Related Cases");
  lines.push(
    relatedCaseIds.length > 0
      ? relatedCaseIds.map((id) => `- ${wikilink(`CASE-${String(id).padStart(6, "0")}`)}`).join("\n")
      : "_No related cases (no shared evidence with another case yet)._"
  );

  return lines.join("\n");
}

// ---- workspace note ----

export interface WorkspaceNoteData {
  name: string;
  status: string;
  healthScore: number;
  casesCount: number;
  assetsCount: number;
  needsReviewCount: number;
  duplicateGroupsCount: number;
}

export function workspaceNoteFrontmatter(): string {
  return frontmatter({ brandos_entity_type: "workspace", brandos_generated_at: new Date().toISOString() });
}

export function workspaceNoteBody(data: WorkspaceNoteData): string {
  return [
    `# ${data.name}`,
    "",
    `**Status:** ${data.status} · **Health:** ${data.healthScore}/100`,
    "",
    "## At a Glance",
    `- Assets: ${data.assetsCount}`,
    `- Cases: ${data.casesCount}`,
    `- Needs review: ${data.needsReviewCount}`,
    `- Duplicate groups: ${data.duplicateGroupsCount}`,
    "",
    "## Navigate",
    `- ${wikilink("Indexes/All Assets", "All Assets")}`,
    `- ${wikilink("Indexes/All Cases", "All Cases")}`,
    `- ${wikilink("Indexes/Needs Review", "Needs Review")}`,
    `- ${wikilink("Indexes/Duplicates", "Duplicates")}`,
    `- ${wikilink("Indexes/Priority of Use", "Priority of Use")}`,
  ].join("\n");
}

// ---- generic index note ----

export function indexNoteFrontmatter(slug: string): string {
  return frontmatter({ brandos_entity_type: "index", brandos_index: slug, brandos_generated_at: new Date().toISOString() });
}

export function indexNoteBody(title: string, description: string, items: { id: string; label: string; detail?: string }[]): string {
  const lines = [`# ${title}`, "", description, "", `_${items.length} item(s)_`, ""];
  if (items.length === 0) {
    lines.push("_Nothing here yet._");
  } else {
    for (const item of items) lines.push(`- ${wikilink(item.id, item.label)}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  return lines.join("\n");
}
