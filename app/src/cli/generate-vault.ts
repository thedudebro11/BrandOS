import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { runMigrations } from "../core/db/migrate";
import { generateVault } from "../core/services/vault-generator/vault-generator";
import { runKnowledgeReview } from "../core/services/vault-generator/knowledge-review";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npm run generate-vault -- <workspaceId>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);

  console.log(`Generating Obsidian vault for "${workspace.config.name}" (${workspace.config.id})...`);
  console.log(`Vault path: ${wfs.obsidianVaultDir}\n`);

  const summary = generateVault(wfs, db, workspace.config);
  db.save();

  console.log("--- Generation Summary ---");
  console.log(`Created:            ${summary.created}`);
  console.log(`Updated:            ${summary.updated}`);
  console.log(`Skipped (unchanged): ${summary.skippedUnchanged}`);
  console.log(`Skipped (manual edit preserved): ${summary.skippedManualEdit}`);
  console.log(`Total notes:        ${summary.results.length}`);

  console.log("\n--- Living Knowledge Review ---");
  const findings = runKnowledgeReview(wfs, db);
  const bySeverity = new Map<string, number>();
  for (const f of findings) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  for (const [sev, count] of bySeverity) console.log(`${sev}: ${count}`);
  for (const f of findings.filter((f) => f.severity === "critical")) {
    console.log(`  CRITICAL [${f.findingType}]: ${f.description}`);
  }

  db.close();
}

main().catch((err) => {
  console.error("Vault generation failed:", err.message);
  process.exit(1);
});
