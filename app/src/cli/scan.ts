import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { runScan } from "../core/services/import-engine/import-engine";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npm run scan -- <workspaceId>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  console.log(`Scanning workspace "${workspace.config.name}" (${workspace.config.id})...`);
  console.log(`Root: ${workspace.rootDir}`);
  console.log("Read-only scan — no original files will be moved, renamed, or modified.\n");

  const { summary, db } = await runScan(workspace, "manual");
  db.close();

  console.log("\n--- Scan Summary ---");
  console.log(`Run key:            ${summary.runKey}`);
  console.log(`Files discovered:   ${summary.filesDiscovered}`);
  console.log(`Files scanned:      ${summary.filesScanned}`);
  console.log(`Files skipped:      ${summary.filesSkipped} (generated/ignored paths)`);
  console.log(`Files errored:      ${summary.filesErrored}`);
  console.log(`Assets created:     ${summary.assetsCreated}`);
  console.log(`Assets updated:     ${summary.assetsUpdated}`);
  console.log(`Assets missing:     ${summary.assetsMissing}`);
  console.log(`Duplicate groups:   ${summary.duplicateGroupsFound}`);
  console.log(`\nDatabase: ${path.join(workspace.rootDir, ".brandos", "archive.db")}`);
  console.log(`Manifests: ${path.join(workspace.rootDir, ".brandos", "manifests")}`);
}

main().catch((err) => {
  console.error("Scan failed:", err.message);
  process.exit(1);
});
