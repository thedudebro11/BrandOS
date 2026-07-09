import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { runMigrations } from "../core/db/migrate";
import { listImportRuns } from "../core/db/import-runs-repository";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npm run list-imports -- <workspaceId>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);

  const runs = listImportRuns(db, 50);
  console.log(`Last ${runs.length} import run(s) for workspace "${workspaceId}":\n`);
  for (const run of runs) {
    console.log(
      `#${run.id} [${run.status}] ${run.pluginId} v${run.pluginVersion} <- "${run.sourceLabel}" — ` +
        `+${run.assetsAdded} ~${run.assetsUpdated} skip:${run.assetsSkipped} dup:${run.duplicatesFound} ` +
        `warn:${run.warningsCount} err:${run.errorsCount} validation:${run.validationPassed === null ? "n/a" : run.validationPassed ? "pass" : "FAIL"} ` +
        `(${run.startedAt} -> ${run.finishedAt ?? "running"})`
    );
    if (run.errorMessage) console.log(`   error: ${run.errorMessage}`);
  }
  db.close();
}

main().catch((err) => {
  console.error("list-imports failed:", err.message);
  process.exit(1);
});
