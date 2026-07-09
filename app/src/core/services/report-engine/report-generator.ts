import crypto from "node:crypto";
import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import type { WorkspaceConfig } from "../../types";
import type { ReportData, ReportDefinition, ReportGenerateOpts } from "./report-types";
import { renderMarkdown } from "./renderers/markdown";
import { renderHtml, renderPdfReadyHtml } from "./renderers/html";
import { renderJson } from "./renderers/json";
import { validateReport, type ReportValidationFinding } from "./report-validation";
import { applySafeCitationMode } from "./safe-citation";

export interface ReportGenerationResult {
  data: ReportData;
  findings: ReportValidationFinding[];
  reportId: number;
  contentHash: string;
  paths: { markdown: string; html: string; pdfHtml: string; json: string };
}

/** Deterministic content hash: everything in ReportData EXCEPT generatedAt (which necessarily differs every run) — the exact proof "regenerating from unchanged data produces the same report." */
export function hashReportContent(data: ReportData): string {
  const { generatedAt: _generatedAt, ...stable } = data;
  return crypto.createHash("sha256").update(stableStringify(stable)).digest("hex");
}

/** Deterministic JSON.stringify: object keys sorted, so field-insertion order in a generator function never affects the hash. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slugFor(data: ReportData): string {
  const scopePart = data.caseId !== null ? `case-${data.caseId}` : "workspace";
  return `${data.reportType}-${scopePart}`;
}

/**
 * The one general-purpose report pipeline: compose -> validate -> render (4
 * formats) -> write (guarded exports surface) -> persist a `reports` row.
 * Every report type (reports/*.ts) is a ReportDefinition plugged into this
 * same function — no report type has its own rendering or file-writing
 * logic, mirroring Phase 7's "no importer bypasses the pipeline" discipline.
 */
export function generateReport(
  db: WorkspaceDatabase,
  wfs: WorkspaceFs,
  workspaceConfig: WorkspaceConfig,
  definition: ReportDefinition,
  opts: ReportGenerateOpts = {}
): ReportGenerationResult {
  if (definition.scope === "case" && opts.caseId === undefined) {
    throw new Error(`Report type "${definition.type}" is case-scoped and requires opts.caseId.`);
  }
  if (definition.scope === "workspace" && opts.caseId !== undefined) {
    throw new Error(`Report type "${definition.type}" is workspace-scoped and does not accept opts.caseId.`);
  }

  const content = definition.generate(db, workspaceConfig, opts);
  // ADR-007: applied once, here, regardless of which of the 9 report types
  // produced `content` — see safe-citation.ts for why this is the one and
  // only place this logic lives. Defaults to "safe"; a caller must
  // explicitly pass "full" to see raw filenames/paths in the output.
  const data = applySafeCitationMode(content, db, opts.citationMode ?? "safe");
  const findings = validateReport(data);
  const critical = findings.filter((f) => f.severity === "critical");
  if (critical.length > 0) {
    throw new Error(
      `Report "${definition.type}" failed validation with ${critical.length} critical finding(s): ${critical
        .map((f) => f.description)
        .join("; ")}`
    );
  }

  const contentHash = hashReportContent(data);
  const slug = slugFor(data);
  const markdownRel = `${definition.type}/${slug}.md`;
  const htmlRel = `${definition.type}/${slug}.html`;
  const pdfHtmlRel = `${definition.type}/${slug}.pdf.html`;
  const jsonRel = `${definition.type}/${slug}.json`;

  wfs.writeExport(markdownRel, renderMarkdown(data));
  wfs.writeExport(htmlRel, renderHtml(data));
  wfs.writeExport(pdfHtmlRel, renderPdfReadyHtml(data));
  wfs.writeExport(jsonRel, renderJson(data));

  const { lastInsertRowid } = db.run(
    `INSERT INTO reports (report_type, scope_type, scope_id, version, content_hash, markdown_path, html_path, pdf_html_path, json_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.reportType,
      data.caseId !== null ? "case" : "workspace",
      data.caseId,
      data.version,
      contentHash,
      markdownRel,
      htmlRel,
      pdfHtmlRel,
      jsonRel,
    ]
  );

  return {
    data,
    findings,
    reportId: lastInsertRowid as number,
    contentHash,
    paths: { markdown: markdownRel, html: htmlRel, pdfHtml: pdfHtmlRel, json: jsonRel },
  };
}
