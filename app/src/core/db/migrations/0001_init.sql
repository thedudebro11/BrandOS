-- BrandOS per-workspace schema (ADR-001: one SQLite database per workspace).
-- Applies identically to every workspace; no workspace_id column needed since
-- the database file itself is the workspace boundary.

-- Single-row table describing the workspace this database belongs to.
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  config_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every discovered file becomes one permanent asset row. asset_id (AST-00000001
-- style) is derived from the autoincrement id and never changes, per
-- app/specs/17_CASE_BUILDER.md's "reference by Asset ID, not filename" rule.
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT UNIQUE,
  original_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT,
  modified_at TEXT,
  accessed_at TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_broken_shortcut INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'missing'
  sha256 TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_assets_asset_id ON assets(asset_id);
CREATE INDEX idx_assets_sha256 ON assets(sha256);
CREATE INDEX idx_assets_status ON assets(status);

-- Hash verification history — supports "re-hash on demand to verify no changes"
-- (app/specs/04_HASHING_AND_CHAIN_OF_CUSTODY.md) independent of the asset's
-- current sha256 column, so drift is provable, not just overwritten.
CREATE TABLE hash_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  hash_value TEXT NOT NULL,
  matched_previous INTEGER NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_hash_checks_asset ON hash_checks(asset_id);

CREATE TABLE duplicate_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE duplicate_group_members (
  group_id INTEGER NOT NULL REFERENCES duplicate_groups(id),
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  PRIMARY KEY (group_id, asset_id)
);
CREATE INDEX idx_dup_members_asset ON duplicate_group_members(asset_id);

-- Extracted (high confidence) vs inferred metadata are stored the same way but
-- tagged by `source`, per app/specs/03_METADATA_ENGINE.md's confidence rule.
CREATE TABLE metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL, -- 'extracted' | 'inferred'
  confidence INTEGER NOT NULL,
  extracted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_metadata_asset ON metadata(asset_id);
CREATE INDEX idx_metadata_key ON metadata(key);

CREATE TABLE relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_asset_id INTEGER NOT NULL REFERENCES assets(id),
  to_asset_id INTEGER NOT NULL REFERENCES assets(id),
  relationship_type TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  evidence_note TEXT,
  detected_method TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' | 'manual'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (from_asset_id, to_asset_id, relationship_type)
);
CREATE INDEX idx_relationships_from ON relationships(from_asset_id);
CREATE INDEX idx_relationships_to ON relationships(to_asset_id);

CREATE TABLE timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER REFERENCES assets(id),
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  date_source TEXT NOT NULL, -- file_created | file_modified | imported | content_date | manual
  title TEXT NOT NULL,
  description TEXT,
  confidence INTEGER NOT NULL,
  verified_status TEXT NOT NULL DEFAULT 'inferred', -- 'verified' | 'inferred'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_timeline_asset ON timeline_events(asset_id);
CREATE INDEX idx_timeline_date ON timeline_events(event_date);

-- Schema-ready for Phase 6 (Case Builder). Not populated by Phase 2 code paths.
CREATE TABLE cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_key TEXT UNIQUE,
  title TEXT NOT NULL,
  case_type TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  confidence_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE case_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id),
  linked_type TEXT NOT NULL, -- 'asset' | 'timeline_event' | 'report' | 'note'
  linked_id INTEGER NOT NULL,
  relation_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_case_links_case ON case_links(case_id);

CREATE TABLE case_missing_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id),
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracks which plugins are known/active for this workspace (app/specs/19_PLUGIN_ARCHITECTURE.md).
-- Phase 2 does not load real plugins yet; this table is schema-ready foundation.
CREATE TABLE plugins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id TEXT NOT NULL,
  type TEXT NOT NULL, -- Importer | Classifier | ReportTemplate | VaultTemplate
  version TEXT,
  activated INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  manifest_json TEXT
);

CREATE TABLE scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running | completed | failed
  files_discovered INTEGER NOT NULL DEFAULT 0,
  files_scanned INTEGER NOT NULL DEFAULT 0,
  files_skipped INTEGER NOT NULL DEFAULT 0,
  files_errored INTEGER NOT NULL DEFAULT 0,
  assets_created INTEGER NOT NULL DEFAULT 0,
  assets_updated INTEGER NOT NULL DEFAULT 0,
  assets_missing INTEGER NOT NULL DEFAULT 0,
  duplicate_groups_found INTEGER NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL DEFAULT 'manual' -- manual | watch | incremental
);

CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_run_id INTEGER REFERENCES scan_runs(id),
  level TEXT NOT NULL, -- info | warn | error
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  asset_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_logs_scan_run ON logs(scan_run_id);
CREATE INDEX idx_logs_created_at ON logs(created_at);
