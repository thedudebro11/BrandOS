import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import { runImport } from "../import-pipeline/import-orchestrator";
import type { LoadedWorkspace, ScanRunSummary, ScanTrigger } from "../../types";

export interface ScanResult {
  summary: ScanRunSummary;
  wfs: WorkspaceFs;
  db: WorkspaceDatabase;
}

const GENERIC_FOLDER_IMPORTER_ID = "importer-generic-folder";

/**
 * A full workspace scan, expressed as exactly what it is (Phase 7): running
 * the Generic Folder Importer plugin, with the workspace root as its source,
 * through the shared import pipeline. Kept as its own named export — rather
 * than having every caller spell out runImport(ws, "importer-generic-folder",
 * {kind:"workspace_root"}) — because "scan the workspace" is still the most
 * common operation in the codebase (CLI, API, every test fixture) and
 * deserves its own clear name, not because it is a separate code path.
 */
export async function runScan(workspace: LoadedWorkspace, trigger: ScanTrigger = "manual"): Promise<ScanResult> {
  const { summary, wfs, db } = await runImport(workspace, GENERIC_FOLDER_IMPORTER_ID, { kind: "workspace_root" }, trigger);
  return { summary, wfs, db };
}
