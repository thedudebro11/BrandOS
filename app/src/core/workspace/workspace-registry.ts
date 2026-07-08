import fs from "node:fs";
import path from "node:path";
import { loadWorkspaceConfig, WorkspaceConfigError } from "./workspace-config";
import type { LoadedWorkspace } from "../types";

export interface DiscoveryResult {
  workspaces: LoadedWorkspace[];
  skipped: { dir: string; reason: string }[];
}

/**
 * Discovers every workspace under workspacesRoot. A directory that fails to
 * load or validate is skipped (with a reason) rather than crashing discovery
 * of every other workspace — one bad workspace.json must not take down the
 * whole registry.
 */
export function discoverWorkspaces(workspacesRoot: string): DiscoveryResult {
  const workspaces: LoadedWorkspace[] = [];
  const skipped: { dir: string; reason: string }[] = [];

  if (!fs.existsSync(workspacesRoot)) {
    return { workspaces, skipped };
  }

  const entries = fs.readdirSync(workspacesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(workspacesRoot, entry.name);
    try {
      workspaces.push(loadWorkspaceConfig(dir));
    } catch (err) {
      if (err instanceof WorkspaceConfigError) {
        skipped.push({ dir, reason: err.message });
      } else {
        throw err;
      }
    }
  }
  return { workspaces, skipped };
}

export function getWorkspace(workspacesRoot: string, id: string): LoadedWorkspace {
  const dir = path.join(workspacesRoot, id);
  return loadWorkspaceConfig(dir);
}
