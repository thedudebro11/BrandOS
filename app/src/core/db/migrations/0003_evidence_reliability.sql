-- Phase 3.5: Evidence Reliability & Knowledge Validation.
--
-- Architectural fix for the Phase 3 finding that filesystem timestamps are
-- not trustworthy on this environment (100% of real Fatletic assets came back
-- epoch-dated). Filesystem timestamps become ONE candidate evidence source
-- among many, never assumed true. See ARCHITECTURE_DECISIONS.md ADR-010.

-- Every date BrandOS ever finds for an asset, from any source, kept forever.
-- Never overwritten, never discarded — if a source is re-examined and yields
-- a different value, a NEW row is inserted, preserving history naturally.
CREATE TABLE candidate_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  source_type TEXT NOT NULL, -- see date_source_priorities.source_type for the full vocabulary
  date_value TEXT NOT NULL,  -- resolved ISO date/time
  raw_value TEXT,            -- the original, unparsed representation (traceability)
  extracted_from TEXT NOT NULL, -- e.g. a metadata key, "filename", "folder:<segment>", or a relationship description
  source_asset_id INTEGER REFERENCES assets(id), -- for cross-referenced/relationship-derived dates: which OTHER asset this date came from
  is_plausible INTEGER NOT NULL DEFAULT 1,
  implausibility_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asset_id, source_type, extracted_from, date_value)
);
CREATE INDEX idx_candidate_dates_asset ON candidate_dates(asset_id);
CREATE INDEX idx_candidate_dates_source ON candidate_dates(source_type);

-- Configurable priority ranking (lower priority_rank wins when multiple
-- plausible candidates exist). Workspace-overridable later — this table is
-- data, not a hardcoded enum (ARCHITECTURE_PRINCIPLES.md #6).
CREATE TABLE date_source_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL UNIQUE,
  priority_rank INTEGER NOT NULL, -- lower = tried/trusted first
  reliability_score INTEGER NOT NULL, -- 0-100 intrinsic quality, feeds resolved_dates.confidence
  tier_label TEXT NOT NULL,
  producer_status TEXT NOT NULL DEFAULT 'not_yet_implemented' -- 'active' | 'not_yet_implemented' (no data source built yet)
);

-- One resolved date per asset — the single answer every other engine
-- (dashboard, reports, Priority of Use) should read instead of touching
-- candidate_dates or the raw filesystem fields directly.
CREATE TABLE resolved_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL UNIQUE REFERENCES assets(id),
  resolved_date TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_candidate_id INTEGER NOT NULL REFERENCES candidate_dates(id),
  reasoning TEXT NOT NULL,
  rejected_alternatives_json TEXT NOT NULL, -- JSON array of {sourceType, dateValue, reasonRejected}
  corroborating_candidate_count INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Classification explainability (System 6/7): why a category was chosen and
-- what would change it. Additive columns on the existing Phase 3 table —
-- no new table, no duplicated classification storage.
ALTER TABLE classifications ADD COLUMN supporting_evidence TEXT;
ALTER TABLE classifications ADD COLUMN missing_evidence TEXT;
ALTER TABLE classifications ADD COLUMN conflicting_evidence TEXT;

-- Needs Review Intelligence (System 7): expand each review item with a real
-- explanation and a concrete next action, not just "confidence was low."
ALTER TABLE review_queue ADD COLUMN possible_classifications_detail TEXT;
ALTER TABLE review_queue ADD COLUMN suggested_action TEXT;
ALTER TABLE review_queue ADD COLUMN estimated_effort TEXT; -- 'low' | 'medium' | 'high'
ALTER TABLE review_queue ADD COLUMN potential_impact TEXT; -- 'low' | 'medium' | 'high'

-- Health/validation findings, kept distinct from Phase 3's integrity_checks
-- table (which the Data Health Engine still reuses via function calls, not
-- duplicated queries) so the newer date/candidate-specific checks have a
-- clear home and the two tables can be told apart in history.
CREATE TABLE data_health_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  finding_type TEXT NOT NULL, -- epoch_date | invalid_timestamp | impossible_date | broken_provenance | duplicate_metadata | (delegated integrity types)
  severity TEXT NOT NULL,     -- 'info' | 'warning' | 'critical'
  scope_type TEXT,
  scope_id INTEGER,
  description TEXT NOT NULL
);
CREATE INDEX idx_data_health_findings_run ON data_health_findings(run_at);

-- Knowledge Validation Engine results: pass/fail checklist, not an issue log.
CREATE TABLE knowledge_validation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  check_name TEXT NOT NULL,
  passed INTEGER NOT NULL,
  details TEXT NOT NULL
);
CREATE INDEX idx_knowledge_validation_run ON knowledge_validation_runs(run_at);

-- Seed the default priority order exactly as specified. NOTE (documented
-- further in ADR-010): "User Confirmed" is deliberately last in the
-- specified default *priority_rank* (tie-break order when multiple sources
-- exist), even though a human-confirmed date is intuitively very reliable —
-- it gets a high reliability_score (90) instead. This tension is real, not
-- smoothed over, and is exactly why priority_rank is workspace-configurable.
INSERT INTO date_source_priorities (source_type, priority_rank, reliability_score, tier_label, producer_status) VALUES
  ('printful_order', 10, 95, 'Verified Commercial Record', 'not_yet_implemented'),
  ('printful_shipment', 10, 95, 'Verified Commercial Record', 'not_yet_implemented'),
  ('shopify_order', 10, 95, 'Verified Commercial Record', 'not_yet_implemented'),
  ('stripe_payment', 10, 95, 'Verified Commercial Record', 'not_yet_implemented'),
  ('instagram_publish', 20, 85, 'Verified Social Platform', 'not_yet_implemented'),
  ('pdf_metadata', 30, 75, 'Embedded Metadata', 'active'),
  ('psd_metadata', 30, 75, 'Embedded Metadata', 'active'),
  ('xcf_metadata', 30, 75, 'Embedded Metadata', 'active'),
  ('svg_metadata', 30, 70, 'Embedded Metadata', 'active'),
  ('ai_metadata', 30, 75, 'Embedded Metadata', 'active'),
  ('embedded_document_metadata', 30, 70, 'Embedded Metadata', 'active'),
  ('exif', 40, 65, 'EXIF', 'active'),
  ('image_metadata', 40, 60, 'EXIF', 'active'),
  ('video_metadata', 40, 60, 'EXIF', 'active'),
  ('git_commit', 50, 70, 'Git History', 'not_yet_implemented'),
  ('filesystem_modified', 60, 50, 'Filesystem Modified', 'active'),
  ('filesystem_created', 70, 25, 'Filesystem Created', 'active'),
  ('filename_pattern', 80, 45, 'Filename Pattern', 'active'),
  ('folder_pattern', 90, 30, 'Folder Context', 'active'),
  ('relationship_derived', 100, 35, 'Relationship Inference', 'active'),
  ('user_confirmed', 110, 90, 'User Confirmed', 'not_yet_implemented');
