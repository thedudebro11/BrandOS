-- Phase 8: generated report tracking.
--
-- One row per generated report. Reports are files on disk under the
-- workspace's exports directory (paths.exports, default .brandos/exports) —
-- this table tracks generation state and provides an integer id that
-- case_links.linked_id can reference when linked_type = 'report' (that enum
-- value has existed since Phase 3's case_links schema; this is the first
-- phase to actually produce rows it can point to).
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,   -- 'workspace' | 'case'
  scope_id INTEGER,           -- case id when scope_type = 'case', else NULL
  version TEXT NOT NULL,      -- report template/schema version, e.g. "1.0.0"
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_hash TEXT NOT NULL, -- hash of ReportData with generatedAt stripped — the determinism proof
  markdown_path TEXT,
  html_path TEXT,
  pdf_html_path TEXT,
  json_path TEXT
);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_scope ON reports(scope_type, scope_id);
