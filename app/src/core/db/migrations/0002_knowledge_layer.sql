-- Phase 3: Knowledge Layer. Every new table references assets(id) or another
-- table's id — nothing here duplicates a fact that already lives elsewhere
-- (ARCHITECTURE_PRINCIPLES.md #8). All still scoped to one workspace's
-- database (#7); no workspace_id column needed.

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE asset_tags (
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  source TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' | 'manual'
  confidence INTEGER NOT NULL DEFAULT 100,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (asset_id, tag_id)
);
CREATE INDEX idx_asset_tags_tag ON asset_tags(tag_id);

-- One current classification per asset (re-classification replaces via
-- delete-then-insert in the repository layer, same pattern as Phase 2's
-- replaceAssetMetadata — keeps "current state" queries simple; history isn't
-- needed yet and isn't invented ahead of a real requirement).
CREATE TABLE classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL UNIQUE REFERENCES assets(id),
  category TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'rule_based', -- 'rule_based' today; 'ai_assisted' is a future method value, not built yet
  rule_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER REFERENCES assets(id),
  reason TEXT NOT NULL,
  suggested_classifications TEXT,
  confidence INTEGER,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_review_queue_status ON review_queue(status);

-- Generic scoring table: works for a single asset, a case, or the whole
-- workspace (scope_id NULL) without three near-identical tables.
CREATE TABLE evidence_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL, -- 'asset' | 'case' | 'workspace'
  scope_id INTEGER,          -- assets.id or cases.id; NULL for workspace-wide
  dimension TEXT NOT NULL,   -- 'strength' | 'completeness' | 'confidence' | 'continuous_use' | 'priority_of_use'
  score INTEGER NOT NULL,    -- 0-100
  status TEXT NOT NULL,      -- 'strong' | 'weak' | 'conflicting' | 'missing'
  notes TEXT NOT NULL,       -- must state which assets/events informed the score (traceability)
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_evidence_assessments_scope ON evidence_assessments(scope_type, scope_id);

CREATE TABLE evidence_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL, -- 'asset' | 'case' | 'workspace'
  scope_id INTEGER,
  gap_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_evidence_gaps_scope ON evidence_gaps(scope_type, scope_id);

-- Config over hardcoding (ARCHITECTURE_PRINCIPLES.md #6): case templates are
-- data, not an enum baked into TypeScript. A workspace can add a custom
-- template with an INSERT, not a code change.
CREATE TABLE case_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  default_case_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE asset_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  note TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'system', -- 'system' | 'user'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_asset_notes_asset ON asset_notes(asset_id);

CREATE TABLE integrity_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  issue_type TEXT NOT NULL, -- broken_reference | hash_mismatch | missing_asset | duplicate_asset | circular_relationship | orphaned_asset | workspace_inconsistency
  severity TEXT NOT NULL,   -- 'info' | 'warning' | 'critical'
  scope_type TEXT,
  scope_id INTEGER,
  description TEXT NOT NULL
);
CREATE INDEX idx_integrity_checks_run ON integrity_checks(run_at);

INSERT INTO case_templates (template_key, title, description, default_case_type) VALUES
  ('trademark_registration', 'Trademark Registration', 'Supports a federal or state trademark application for the workspace''s primary mark.', 'trademark_registration'),
  ('trademark_opposition', 'Trademark Opposition', 'Supports opposing or defending against a conflicting mark.', 'trademark_opposition'),
  ('priority_of_use', 'Priority of Use', 'Establishes earliest documented use of the brand or mark.', 'priority_of_use'),
  ('copyright_registration', 'Copyright Registration', 'Supports a copyright registration for design or creative works.', 'copyright_registration'),
  ('investor_due_diligence', 'Investor Due Diligence', 'Assembles brand history and evidence for investor review.', 'investor_due_diligence'),
  ('brand_acquisition', 'Brand Acquisition', 'Assembles brand assets and history for an acquisition process.', 'brand_acquisition'),
  ('media_kit', 'Media Kit', 'Assembles finalized brand assets for press or media use.', 'media_kit'),
  ('historical_timeline', 'Historical Timeline', 'A general chronological case with no legal filing purpose.', 'historical_timeline');
