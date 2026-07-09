import type { Citation, ReportData } from "../report-types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Markdown-flavored body text -> minimal HTML: paragraphs and single line breaks only, no full Markdown parser (report bodies never use more than that). */
function bodyToHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function citationRow(c: Citation): string {
  const ref = [c.assetId && `Asset ${esc(c.assetId)}`, c.timelineEventId && `Timeline Event #${c.timelineEventId}`, c.caseId && `Case #${c.caseId}`]
    .filter(Boolean)
    .join(", ") || "(report-level)";
  const note = c.obsidianNotePath ? `<br><span class="muted">Obsidian: ${esc(c.obsidianNotePath)}</span>` : "";
  return `<tr><td>${ref}</td><td>${c.confidence ?? "—"}</td><td>${c.sourceType ? esc(c.sourceType) : "—"}</td><td>${esc(c.description)}${note}</td></tr>`;
}

/** The shared inner content both HTML variants render — only the <style> differs between screen and PDF-ready output. */
function bodyContent(data: ReportData): string {
  const parts: string[] = [];
  parts.push(`<h1>${esc(data.title)}</h1>`);
  parts.push(`<p class="meta"><strong>Workspace:</strong> ${esc(data.workspaceName)} (<code>${esc(data.workspaceId)}</code>)`);
  if (data.caseId !== null) parts.push(` &middot; <strong>Case:</strong> ${esc(data.caseTitle ?? "")} (#${data.caseId})`);
  parts.push(` &middot; <strong>Generated:</strong> ${esc(data.generatedAt)} &middot; <strong>Version:</strong> ${esc(data.version)}</p>`);

  if (data.legalDisclaimer) {
    parts.push(`<div class="disclaimer">${esc(data.legalDisclaimer)}</div>`);
  }

  for (const s of data.sections) {
    parts.push(`<section class="report-section"><h2>${esc(s.title)}</h2>`);
    parts.push(bodyToHtml(s.body));
    if (s.citations.length > 0) {
      parts.push(
        `<table class="citations"><thead><tr><th>Reference</th><th>Confidence</th><th>Source</th><th>Description</th></tr></thead><tbody>${s.citations
          .map(citationRow)
          .join("")}</tbody></table>`
      );
    }
    parts.push(`</section>`);
  }

  parts.push(`<section class="report-section appendix"><h2>Appendix — Full Citation Index</h2>`);
  parts.push(`<p>${data.citationIndex.length} citation(s) across this report.</p>`);
  parts.push(
    `<table class="citations"><thead><tr><th>Reference</th><th>Confidence</th><th>Source</th><th>Description</th></tr></thead><tbody>${data.citationIndex
      .map(citationRow)
      .join("")}</tbody></table></section>`
  );

  return parts.join("\n");
}

const SCREEN_STYLE = `
  body { font-family: -apple-system, Segoe UI, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.8rem; } h2 { font-size: 1.3rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
  .meta { color: #555; font-size: 0.9rem; }
  .disclaimer { background: #fff8e1; border: 1px solid #e0c46c; padding: 0.75rem 1rem; border-radius: 4px; font-size: 0.9rem; margin: 1rem 0; }
  table.citations { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 0.5rem; }
  table.citations th, table.citations td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
  table.citations th { background: #f5f5f5; }
  .muted { color: #888; font-size: 0.8rem; }
  code { background: #f0f0f0; padding: 0 3px; border-radius: 3px; }
`;

const PRINT_STYLE = `
  @page { margin: 2cm; }
  body { font-family: Georgia, serif; color: #000; line-height: 1.4; font-size: 11pt; }
  h1 { font-size: 20pt; } h2 { font-size: 14pt; margin-top: 1.5em; page-break-after: avoid; }
  .report-section { page-break-inside: avoid; }
  .meta { color: #333; font-size: 9pt; }
  .disclaimer { border: 1px solid #999; padding: 0.5em 0.8em; font-size: 9pt; margin: 1em 0; }
  table.citations { width: 100%; border-collapse: collapse; font-size: 8pt; }
  table.citations th, table.citations td { border: 1px solid #999; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }
  .appendix { page-break-before: always; }
`;

/** Screen-oriented HTML — meant to be opened in a browser and read on-screen. */
export function renderHtml(data: ReportData): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.title)}</title><style>${SCREEN_STYLE}</style></head><body>${bodyContent(
    data
  )}</body></html>`;
}

/** Print-oriented HTML — page-break-aware, serif, ready for a browser's "Print to PDF." No PDF binary is generated (no headless-browser dependency in this environment); this is the deliberate "PDF-ready HTML" interpretation of the Phase 8 spec. */
export function renderPdfReadyHtml(data: ReportData): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.title)}</title><style>${PRINT_STYLE}</style></head><body>${bodyContent(
    data
  )}</body></html>`;
}
