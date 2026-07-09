import type { WorkspaceDatabase } from "./connection";

export interface ImportRunCounts {
  assetsAdded: number;
  assetsUpdated: number;
  assetsSkipped: number;
  duplicatesFound: number;
  warningsCount: number;
  errorsCount: number;
}

export interface ImportRunRecord extends ImportRunCounts {
  id: number;
  pluginId: string;
  pluginVersion: string;
  sourceLabel: string;
  scanRunId: number | null;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "completed" | "failed" | "cancelled";
  validationPassed: boolean | null;
  errorMessage: string | null;
}

function mapImportRun(row: Record<string, unknown> | undefined): ImportRunRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    pluginId: row.plugin_id as string,
    pluginVersion: row.plugin_version as string,
    sourceLabel: row.source_label as string,
    scanRunId: (row.scan_run_id as number) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) ?? null,
    status: row.status as ImportRunRecord["status"],
    assetsAdded: row.assets_added as number,
    assetsUpdated: row.assets_updated as number,
    assetsSkipped: row.assets_skipped as number,
    duplicatesFound: row.duplicates_found as number,
    warningsCount: row.warnings_count as number,
    errorsCount: row.errors_count as number,
    validationPassed: row.validation_passed === null || row.validation_passed === undefined ? null : Boolean(row.validation_passed),
    errorMessage: (row.error_message as string) ?? null,
  };
}

/** Every import — including every folder scan, since scan uses the Generic Folder Importer plugin through this same pipeline — gets exactly one row here. This IS the audit trail Phase 7's spec requires. */
export function createImportRun(
  db: WorkspaceDatabase,
  pluginId: string,
  pluginVersion: string,
  sourceLabel: string,
  scanRunId: number | null
): number {
  const { lastInsertRowid } = db.run(
    `INSERT INTO import_runs (plugin_id, plugin_version, source_label, scan_run_id, status)
     VALUES (?, ?, ?, ?, 'running')`,
    [pluginId, pluginVersion, sourceLabel, scanRunId]
  );
  return lastInsertRowid as number;
}

export function finishImportRun(
  db: WorkspaceDatabase,
  importRunId: number,
  status: "completed" | "failed" | "cancelled",
  counts: ImportRunCounts,
  validationPassed: boolean | null,
  summary: unknown,
  errorMessage: string | null
): void {
  db.run(
    `UPDATE import_runs
     SET finished_at = datetime('now'), status = ?, assets_added = ?, assets_updated = ?, assets_skipped = ?,
         duplicates_found = ?, warnings_count = ?, errors_count = ?, validation_passed = ?, summary_json = ?, error_message = ?
     WHERE id = ?`,
    [
      status,
      counts.assetsAdded,
      counts.assetsUpdated,
      counts.assetsSkipped,
      counts.duplicatesFound,
      counts.warningsCount,
      counts.errorsCount,
      validationPassed === null ? null : validationPassed ? 1 : 0,
      JSON.stringify(summary),
      errorMessage,
      importRunId,
    ]
  );
}

export function listImportRuns(db: WorkspaceDatabase, limit = 50): ImportRunRecord[] {
  return db.all("SELECT * FROM import_runs ORDER BY started_at DESC LIMIT ?", [limit]).map((r) => mapImportRun(r)!);
}

export function getImportRun(db: WorkspaceDatabase, id: number): ImportRunRecord | undefined {
  return mapImportRun(db.get("SELECT * FROM import_runs WHERE id = ?", [id]));
}
