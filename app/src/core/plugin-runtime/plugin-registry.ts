import type { WorkspaceDatabase } from "../db/connection";
import type { PluginManifest, PluginState } from "./plugin-api";

export interface PluginRegistrationRecord {
  pluginId: string;
  pluginType: string;
  version: string;
  manifest: PluginManifest;
  state: PluginState;
  disabledReason: string | null;
}

export interface PluginHealthRecord {
  pluginId: string;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalRuns: number;
  totalFailures: number;
}

function mapRegistration(row: Record<string, unknown> | undefined): PluginRegistrationRecord | undefined {
  if (!row) return undefined;
  return {
    pluginId: row.plugin_id as string,
    pluginType: row.plugin_type as string,
    version: row.version as string,
    manifest: JSON.parse(row.manifest_json as string),
    state: row.state as PluginState,
    disabledReason: (row.disabled_reason as string) ?? null,
  };
}

function mapHealth(row: Record<string, unknown> | undefined): PluginHealthRecord | undefined {
  if (!row) return undefined;
  return {
    pluginId: row.plugin_id as string,
    lastRunAt: (row.last_run_at as string) ?? null,
    lastRunStatus: (row.last_run_status as "success" | "error") ?? null,
    lastErrorMessage: (row.last_error_message as string) ?? null,
    consecutiveFailures: row.consecutive_failures as number,
    totalRuns: row.total_runs as number,
    totalFailures: row.total_failures as number,
  };
}

/** Upserts a plugin's registration row every time the loader discovers it, so manifest_json always reflects what's on disk. */
export function upsertPluginRegistration(
  db: WorkspaceDatabase,
  manifest: PluginManifest,
  state: PluginState,
  disabledReason: string | null
): void {
  const existing = db.get<{ plugin_id: string }>("SELECT plugin_id FROM plugin_registrations WHERE plugin_id = ?", [
    manifest.id,
  ]);
  if (existing) {
    db.run(
      `UPDATE plugin_registrations
       SET plugin_type = ?, version = ?, manifest_json = ?, state = ?, disabled_reason = ?, updated_at = datetime('now')
       WHERE plugin_id = ?`,
      [manifest.type, manifest.version, JSON.stringify(manifest), state, disabledReason, manifest.id]
    );
  } else {
    db.run(
      `INSERT INTO plugin_registrations (plugin_id, plugin_type, version, manifest_json, state, disabled_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [manifest.id, manifest.type, manifest.version, JSON.stringify(manifest), state, disabledReason]
    );
    db.run(`INSERT INTO plugin_health (plugin_id) VALUES (?)`, [manifest.id]);
  }
}

export function listPluginRegistrations(db: WorkspaceDatabase): PluginRegistrationRecord[] {
  return db.all("SELECT * FROM plugin_registrations ORDER BY plugin_id").map((r) => mapRegistration(r)!);
}

export function getPluginRegistration(db: WorkspaceDatabase, pluginId: string): PluginRegistrationRecord | undefined {
  return mapRegistration(db.get("SELECT * FROM plugin_registrations WHERE plugin_id = ?", [pluginId]));
}

export function setPluginState(db: WorkspaceDatabase, pluginId: string, state: PluginState, reason: string | null): void {
  db.run(`UPDATE plugin_registrations SET state = ?, disabled_reason = ?, updated_at = datetime('now') WHERE plugin_id = ?`, [
    state,
    reason,
    pluginId,
  ]);
}

export function getPluginHealth(db: WorkspaceDatabase, pluginId: string): PluginHealthRecord | undefined {
  return mapHealth(db.get("SELECT * FROM plugin_health WHERE plugin_id = ?", [pluginId]));
}

export function listPluginHealth(db: WorkspaceDatabase): PluginHealthRecord[] {
  return db.all("SELECT * FROM plugin_health").map((r) => mapHealth(r)!);
}

/**
 * Records the outcome of one plugin lifecycle/import call. This is the single
 * choke point error isolation flows through: every call the runtime makes
 * into a plugin is wrapped so its result — success or thrown error — lands
 * here, never propagating further than the runtime's own catch block.
 */
export function recordPluginRunOutcome(
  db: WorkspaceDatabase,
  pluginId: string,
  outcome: "success" | "error",
  message: string,
  details?: unknown
): void {
  const health = getPluginHealth(db, pluginId);
  const consecutiveFailures = outcome === "error" ? (health?.consecutiveFailures ?? 0) + 1 : 0;
  const totalFailures = (health?.totalFailures ?? 0) + (outcome === "error" ? 1 : 0);
  const totalRuns = (health?.totalRuns ?? 0) + 1;

  db.run(
    `UPDATE plugin_health
     SET last_run_at = datetime('now'), last_run_status = ?, last_error_message = ?,
         consecutive_failures = ?, total_runs = ?, total_failures = ?
     WHERE plugin_id = ?`,
    [outcome, outcome === "error" ? message : null, consecutiveFailures, totalRuns, totalFailures, pluginId]
  );

  db.run(
    `INSERT INTO plugin_health_events (plugin_id, event_type, message, details_json)
     VALUES (?, ?, ?, ?)`,
    [pluginId, outcome === "error" ? "run_failure" : "run_success", message, details !== undefined ? JSON.stringify(details) : null]
  );
}

export function listPluginHealthEvents(db: WorkspaceDatabase, pluginId: string, limit = 50): Record<string, unknown>[] {
  return db.all("SELECT * FROM plugin_health_events WHERE plugin_id = ? ORDER BY occurred_at DESC LIMIT ?", [
    pluginId,
    limit,
  ]);
}
