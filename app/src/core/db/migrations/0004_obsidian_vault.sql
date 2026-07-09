-- Phase 6: Obsidian vault generation tracking.
--
-- One row per generated note. content_hash covers ONLY the generated block
-- (between the delimiter comments) — if the file on disk no longer matches
-- this hash, the user has hand-edited it, and regeneration must not
-- overwrite it (ADR-008). Never a second copy of engine data: this table
-- tracks *generation state*, not note content itself.
CREATE TABLE obsidian_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'asset' | 'case' | 'workspace' | 'index'
  entity_id TEXT NOT NULL,   -- asset_id string, case id, 'workspace', or index slug
  vault_path TEXT NOT NULL UNIQUE, -- relative path within the vault, e.g. "Assets/AST-00000001.md"
  content_hash TEXT NOT NULL, -- hash of the generated block only, as last written
  last_generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  has_manual_edits INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_obsidian_notes_entity ON obsidian_notes(entity_type, entity_id);
