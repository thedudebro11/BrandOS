import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { runImport } from "../core/services/import-pipeline/import-orchestrator";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  const zipRelPath = process.argv[3];

  if (!workspaceId || !zipRelPath) {
    console.error("Usage: npm run import-zip -- <workspaceId> <zipRelPathWithinWorkspace>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  console.log(`Importing ZIP "${zipRelPath}" into workspace "${workspaceId}" via importer-zip-archive...\n`);

  const { summary, importRunId, db } = await runImport(workspace, "importer-zip-archive", { kind: "zip", zipRelPath }, "manual");
  db.close();

  console.log("\n--- Import Summary ---");
  console.log(`Import run ID:      ${importRunId}`);
  console.log(`Files discovered:   ${summary.filesDiscovered}`);
  console.log(`Assets created:     ${summary.assetsCreated}`);
  console.log(`Assets updated:     ${summary.assetsUpdated}`);
  console.log(`Files errored:      ${summary.filesErrored}`);
  console.log(`Duplicate groups:   ${summary.duplicateGroupsFound}`);
}

main().catch((err) => {
  console.error("ZIP import failed:", err.message);
  process.exit(1);
});
