-- Phase 7: Plugin runtime + import framework tracking.
--
-- Plugin *discovery* is global (app/src/plugins/*/plugin.json on disk); plugin
-- *state* is per-workspace, same as every other BrandOS fact (ADR-001) — a
-- plugin can be healthy in one workspace and disabled/erroring in another,
-- since activation itself is workspace-scoped (workspace.json `modules`).

-- One row per plugin known to this workspace's runtime (registered at least once).
CREATE TABLE plugin_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id TEXT NOT NULL UNIQUE,     -- manifest "id", e.g. "importer-generic-folder"
  plugin_type TEXT NOT NULL,          -- "Importer" | "Classifier" | "ReportTemplate" | "VaultTemplate"
  version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,        -- full validated manifest, for audit/debugging
  state TEXT NOT NULL DEFAULT 'discovered', -- 'discovered' | 'active' | 'disabled' | 'error'
  disabled_reason TEXT,               -- set when state = 'disabled' (e.g. "module flag off", "manual")
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Health/error-isolation record: one row per plugin, continuously updated —
-- NOT an event log (that's plugin_health_events below). This is "what is
-- true right now," queried on every dashboard-style health check.
CREATE TABLE plugin_health (
  plugin_id TEXT PRIMARY KEY REFERENCES plugin_registrations(plugin_id),
  last_run_at TEXT,
  last_run_status TEXT,               -- 'success' | 'error'
  last_error_message TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0
);

-- Append-only health event log, so "why is this plugin unhealthy" has a real
-- history rather than only the current snapshot in plugin_health.
CREATE TABLE plugin_health_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id TEXT NOT NULL REFERENCES plugin_registrations(plugin_id),
  event_type TEXT NOT NULL,           -- 'lifecycle_error' | 'run_success' | 'run_failure'
  message TEXT NOT NULL,
  details_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_plugin_health_events_plugin ON plugin_health_events(plugin_id);

-- One row per import run, by any importer plugin (including the Generic
-- Folder Importer used by every `scan`) — the full audit trail Phase 7's
-- spec requires. scan_run_id links back to the existing scan_runs table
-- (0001_init.sql) when the import was a folder/rescan; NULL for imports
-- that don't correspond to a filesystem scan run (e.g. a ZIP import that
-- doesn't touch the primary evidence tree walk).
CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id TEXT NOT NULL REFERENCES plugin_registrations(plugin_id),
  plugin_version TEXT NOT NULL,
  source_label TEXT NOT NULL,         -- human-readable source, e.g. a folder path or zip filename
  scan_run_id INTEGER REFERENCES scan_runs(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed' | 'cancelled'
  assets_added INTEGER NOT NULL DEFAULT 0,
  assets_updated INTEGER NOT NULL DEFAULT 0,
  assets_skipped INTEGER NOT NULL DEFAULT 0,
  duplicates_found INTEGER NOT NULL DEFAULT 0,
  warnings_count INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  validation_passed INTEGER,          -- 1/0/NULL — result of the post-import Knowledge Validation pass; NULL = not run
  summary_json TEXT,                  -- full ImportRunSummary, for exact replay/audit
  error_message TEXT
);
CREATE INDEX idx_import_runs_plugin ON import_runs(plugin_id);
CREATE INDEX idx_import_runs_started ON import_runs(started_at);
