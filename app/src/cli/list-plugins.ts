import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { runMigrations } from "../core/db/migrate";
import { listPluginRegistrations, getPluginHealth } from "../core/plugin-runtime/plugin-registry";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npm run list-plugins -- <workspaceId>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);

  const registrations = listPluginRegistrations(db);
  console.log(`Plugins known to workspace "${workspaceId}":\n`);
  for (const reg of registrations) {
    const health = getPluginHealth(db, reg.pluginId);
    console.log(`${reg.pluginId} (${reg.pluginType} v${reg.version}) — ${reg.state}${reg.disabledReason ? ` [${reg.disabledReason}]` : ""}`);
    if (health && health.totalRuns > 0) {
      console.log(
        `  runs: ${health.totalRuns} total, ${health.totalFailures} failed, ${health.consecutiveFailures} consecutive failures, last: ${health.lastRunStatus} at ${health.lastRunAt}`
      );
    }
  }
  db.close();
}

main().catch((err) => {
  console.error("list-plugins failed:", err.message);
  process.exit(1);
});
