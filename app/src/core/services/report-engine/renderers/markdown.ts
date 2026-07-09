import type { Citation, ReportData } from "../report-types";

function citationLine(c: Citation): string {
  const parts: string[] = [];
  if (c.assetId) parts.push(`Asset \`${c.assetId}\``);
  if (c.timelineEventId) parts.push(`Timeline Event #${c.timelineEventId}`);
  if (c.caseId) parts.push(`Case #${c.caseId}`);
  const ref = parts.length > 0 ? parts.join(", ") : "(report-level)";
  const conf = c.confidence !== undefined ? ` — confidence ${c.confidence}/100` : "";
  const src = c.sourceType ? ` (source: ${c.sourceType})` : "";
  const note = c.obsidianNotePath ? ` — see Obsidian note \`${c.obsidianNotePath}\`` : "";
  return `- ${ref}${conf}${src}: ${c.description}${note}`;
}

/** Pure ReportData -> Markdown. No DB access — everything it needs is already in ReportData (same discipline as Phase 6's note-templates.ts). */
export function renderMarkdown(data: ReportData): string {
  const lines: string[] = [];
  lines.push(`# ${data.title}`);
  lines.push("");
  lines.push(`**Workspace:** ${data.workspaceName} (\`${data.workspaceId}\`)`);
  if (data.caseId !== null) lines.push(`**Case:** ${data.caseTitle} (#${data.caseId})`);
  lines.push(`**Generated:** ${data.generatedAt}`);
  lines.push(`**Report version:** ${data.version}`);
  lines.push("");

  if (data.legalDisclaimer) {
    lines.push("> " + data.legalDisclaimer);
    lines.push("");
  }

  for (const s of data.sections) {
    lines.push(`## ${s.title}`);
    lines.push("");
    lines.push(s.body);
    lines.push("");
    if (s.citations.length > 0) {
      lines.push("**Citations:**");
      for (const c of s.citations) lines.push(citationLine(c));
      lines.push("");
    }
  }

  lines.push("## Appendix — Full Citation Index");
  lines.push("");
  lines.push(`_${data.citationIndex.length} citation(s) across this report._`);
  lines.push("");
  for (const c of data.citationIndex) lines.push(citationLine(c));

  return lines.join("\n");
}
