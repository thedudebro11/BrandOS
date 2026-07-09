import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { runMigrations } from "../core/db/migrate";
import { getReportDefinition, listReportDefinitions } from "../core/services/report-engine/report-registry";
import { generateReport } from "../core/services/report-engine/report-generator";
import type { ReportType } from "../core/services/report-engine/report-types";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  const reportType = process.argv[3] as ReportType | undefined;
  const rest = process.argv.slice(4);
  const citationModeArg: "full" | undefined = rest.includes("--full") ? "full" : undefined;
  const caseIdArg = rest.find((a) => !a.startsWith("--"));

  if (!workspaceId || !reportType) {
    console.error("Usage: npm run generate-report -- <workspaceId> <reportType> [caseId] [--full]");
    console.error('  --full opts out of ADR-007 Safe Citation Mode (default: "safe" — no raw filenames in output).');
    console.error("\nKnown report types:");
    for (const def of listReportDefinitions()) console.error(`  ${def.type} (${def.scope}) — ${def.title}`);
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);

  const definition = getReportDefinition(reportType);
  const opts = { ...(caseIdArg ? { caseId: Number(caseIdArg) } : {}), ...(citationModeArg ? { citationMode: citationModeArg } : {}) };

  console.log(`Generating "${definition.title}" for "${workspace.config.name}" (${workspace.config.id})${opts.caseId ? `, case ${opts.caseId}` : ""}...\n`);

  const result = generateReport(db, wfs, workspace.config, definition, opts);
  db.save();
  db.close();

  console.log(`Report ID: ${result.reportId}`);
  console.log(`Content hash: ${result.contentHash}`);
  console.log(`Sections: ${result.data.sections.length}, Citations: ${result.data.citationIndex.length}`);
  console.log(`Validation findings: ${result.findings.length}`);
  for (const f of result.findings) console.log(`  [${f.severity}] ${f.findingType}: ${f.description}`);
  console.log("\n--- Output files ---");
  console.log(`Markdown: ${path.join(wfs.exportsDir, result.paths.markdown)}`);
  console.log(`HTML:     ${path.join(wfs.exportsDir, result.paths.html)}`);
  console.log(`PDF-HTML: ${path.join(wfs.exportsDir, result.paths.pdfHtml)}`);
  console.log(`JSON:     ${path.join(wfs.exportsDir, result.paths.json)}`);
}

main().catch((err) => {
  console.error("Report generation failed:", err.message);
  process.exit(1);
});
