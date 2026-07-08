import path from "node:path";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { getWorkspace } from "../core/workspace/workspace-registry";
import type { LoadedWorkspace } from "../core/types";

export const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

const dbCache = new Map<string, WorkspaceDatabase>();
const workspaceCache = new Map<string, LoadedWorkspace>();

/**
 * sql.js keeps the whole database in memory (ADR-009) — opening it fresh on
 * every request would mean re-reading and re-parsing the file each time.
 * Instead, one connection per workspace is kept open for the API server's
 * lifetime; write endpoints call save() explicitly after mutating.
 */
export async function getDb(workspaceId: string): Promise<WorkspaceDatabase> {
  const cached = dbCache.get(workspaceId);
  if (cached) return cached;

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  workspaceCache.set(workspaceId, workspace);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  dbCache.set(workspaceId, db);
  return db;
}

export function getLoadedWorkspace(workspaceId: string): LoadedWorkspace | undefined {
  return workspaceCache.get(workspaceId);
}
