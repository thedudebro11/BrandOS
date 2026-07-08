import type { WorkspaceDatabase } from "../../db/connection";

export interface SearchResult {
  entityType: "asset" | "case" | "timeline_event" | "tag";
  id: number;
  /** Populated for entityType "asset" only — the stable AST-######## id the UI should navigate/link with, since `id` here is the internal numeric row id. */
  stringId?: string;
  label: string;
  matchedField: string;
}

/**
 * LIKE-based unified search across filenames, paths, asset/case ids, hashes,
 * tags, metadata values, case titles, and timeline titles. Deliberately not
 * FTS5/semantic — that's explicitly future scope per the Phase 3 spec
 * ("future semantic search"). Kept behind this one function so a smarter
 * implementation can replace the body later without any caller changing
 * (same pattern as the DB driver behind WorkspaceDatabase, ADR-009).
 */
export function search(db: WorkspaceDatabase, term: string): SearchResult[] {
  const like = `%${term}%`;
  const results: SearchResult[] = [];

  const assetsByPath = db.all<{ id: number; asset_id: string; filename: string; original_path: string }>(
    "SELECT id, asset_id, filename, original_path FROM assets WHERE filename LIKE ? OR original_path LIKE ? OR asset_id LIKE ? OR sha256 LIKE ?",
    [like, like, like, like]
  );
  for (const a of assetsByPath) {
    results.push({ entityType: "asset", id: a.id, stringId: a.asset_id, label: a.filename, matchedField: "filename/path/id/hash" });
  }

  const assetsByMetadata = db.all<{ id: number; asset_id: string; filename: string; value: string }>(
    `SELECT DISTINCT a.id, a.asset_id, a.filename, m.value FROM assets a JOIN metadata m ON m.asset_id = a.id WHERE m.value LIKE ?`,
    [like]
  );
  for (const a of assetsByMetadata) {
    if (results.some((r) => r.entityType === "asset" && r.id === a.id)) continue;
    results.push({ entityType: "asset", id: a.id, stringId: a.asset_id, label: a.filename, matchedField: `metadata: ${a.value}` });
  }

  const assetsByTag = db.all<{ id: number; asset_id: string; filename: string; name: string }>(
    `SELECT DISTINCT a.id, a.asset_id, a.filename, t.name FROM assets a
     JOIN asset_tags at ON at.asset_id = a.id JOIN tags t ON t.id = at.tag_id WHERE t.name LIKE ?`,
    [like]
  );
  for (const a of assetsByTag) {
    if (results.some((r) => r.entityType === "asset" && r.id === a.id)) continue;
    results.push({ entityType: "asset", id: a.id, stringId: a.asset_id, label: a.filename, matchedField: `tag: ${a.name}` });
  }

  const cases = db.all<{ id: number; title: string }>("SELECT id, title FROM cases WHERE title LIKE ? OR case_key LIKE ?", [
    like,
    like,
  ]);
  for (const c of cases) results.push({ entityType: "case", id: c.id, label: c.title, matchedField: "title/case_key" });

  const events = db.all<{ id: number; title: string }>(
    "SELECT id, title FROM timeline_events WHERE title LIKE ? OR description LIKE ?",
    [like, like]
  );
  for (const e of events) {
    results.push({ entityType: "timeline_event", id: e.id, label: e.title, matchedField: "title/description" });
  }

  const tags = db.all<{ id: number; name: string }>("SELECT id, name FROM tags WHERE name LIKE ?", [like]);
  for (const t of tags) results.push({ entityType: "tag", id: t.id, label: t.name, matchedField: "name" });

  return results;
}
