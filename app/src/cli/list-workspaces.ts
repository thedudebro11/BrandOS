import path from "node:path";
import { discoverWorkspaces } from "../core/workspace/workspace-registry";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

function main() {
  const { workspaces, skipped } = discoverWorkspaces(WORKSPACES_ROOT);
  console.log(`Found ${workspaces.length} workspace(s):\n`);
  for (const ws of workspaces) {
    const activeModules = Object.entries(ws.config.modules)
      .filter(([, v]) => v)
      .map(([k]) => k);
    console.log(`- ${ws.config.id} (${ws.config.name}) — type: ${ws.config.type}, status: ${ws.config.status}`);
    console.log(`  active modules: ${activeModules.length ? activeModules.join(", ") : "(none)"}`);
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} invalid workspace dir(s):`);
    for (const s of skipped) console.log(`- ${s.dir}: ${s.reason}`);
  }
}

main();
