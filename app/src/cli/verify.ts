import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { findAssetByAssetId, listActiveAssets, recordHashCheck } from "../core/db/repositories";
import { verifyAssetHash } from "../core/services/hashing-engine/hash-engine";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  const assetId = process.argv[3]; // optional — verify all active assets if omitted

  if (!workspaceId) {
    console.error("Usage: npm run verify -- <workspaceId> [assetId]");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());

  const targets = assetId ? [findAssetByAssetId(db, assetId)].filter((a) => a !== undefined) : listActiveAssets(db);

  if (assetId && targets.length === 0) {
    console.error(`Asset ${assetId} not found in workspace "${workspaceId}".`);
    process.exit(1);
  }

  console.log(`Verifying ${targets.length} asset(s) in "${workspaceId}"...\n`);
  let matched = 0;
  let mismatched = 0;
  for (const asset of targets) {
    try {
      const result = await verifyAssetHash(wfs, asset!);
      recordHashCheck(db, asset!.id, result.hash, result.matched);
      if (result.matched) {
        matched++;
      } else {
        mismatched++;
        console.warn(`MISMATCH: ${asset!.assetId} (${asset!.originalPath}) — stored ${asset!.sha256}, now ${result.hash}`);
      }
    } catch (err) {
      console.error(`ERROR verifying ${asset!.assetId}: ${(err as Error).message}`);
    }
  }
  db.close();

  console.log(`\nVerified: ${matched} matched, ${mismatched} mismatched.`);
  process.exit(mismatched > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Verify failed:", err.message);
  process.exit(1);
});
