import type { WorkspaceDatabase } from "./connection";
import type {
  AssetRecord,
  AssetStatus,
  DiscoveredFile,
  MetadataRecord,
  RelationshipRecord,
  ScanRunStatus,
  ScanTrigger,
  TimelineEventInput,
  WorkspaceConfig,
} from "../types";

function formatAssetId(numericId: number): string {
  return `AST-${String(numericId).padStart(8, "0")}`;
}

/** sql.js returns raw column names (snake_case); map to the camelCase AssetRecord shape. */
function mapAssetRow(row: Record<string, unknown> | undefined): AssetRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    assetId: row.asset_id as string,
    originalPath: row.original_path as string,
    filename: row.filename as string,
    extension: row.extension as string,
    sizeBytes: row.size_bytes as number,
    createdAt: (row.created_at as string) ?? null,
    modifiedAt: (row.modified_at as string) ?? null,
    accessedAt: (row.accessed_at as string) ?? null,
    isHidden: row.is_hidden as number,
    isBrokenShortcut: row.is_broken_shortcut as number,
    status: row.status as AssetStatus,
    sha256: (row.sha256 as string) ?? null,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
  };
}

// ---- workspace (single row) ----

export function upsertWorkspaceInfo(db: WorkspaceDatabase, config: WorkspaceConfig): void {
  const existing = db.get<{ id: string }>("SELECT id FROM workspace WHERE id = ?", [config.id]);
  if (existing) {
    db.run(
      `UPDATE workspace SET name = ?, type = ?, status = ?, config_json = ?, updated_at = datetime('now') WHERE id = ?`,
      [config.name, config.type, config.status, JSON.stringify(config), config.id]
    );
  } else {
    db.run(
      `INSERT INTO workspace (id, name, type, status, config_json) VALUES (?, ?, ?, ?, ?)`,
      [config.id, config.name, config.type, config.status, JSON.stringify(config)]
    );
  }
}

// ---- assets ----

export function findAssetByPath(db: WorkspaceDatabase, originalPath: string): AssetRecord | undefined {
  return mapAssetRow(db.get("SELECT * FROM assets WHERE original_path = ?", [originalPath]));
}

export function findAssetByAssetId(db: WorkspaceDatabase, assetId: string): AssetRecord | undefined {
  return mapAssetRow(db.get("SELECT * FROM assets WHERE asset_id = ?", [assetId]));
}

export function listActiveAssets(db: WorkspaceDatabase): AssetRecord[] {
  return db.all("SELECT * FROM assets WHERE status = 'active'").map((r) => mapAssetRow(r)!);
}

/** Insert a brand-new asset row and assign its permanent AST-######## id. */
export function createAsset(db: WorkspaceDatabase, file: DiscoveredFile, sha256: string | null): AssetRecord {
  const { lastInsertRowid } = db.run(
    `INSERT INTO assets
       (original_path, filename, extension, size_bytes, created_at, modified_at, accessed_at,
        is_hidden, is_broken_shortcut, status, sha256, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
    [
      file.relPath,
      file.filename,
      file.extension,
      file.sizeBytes,
      file.createdAt,
      file.modifiedAt,
      file.accessedAt,
      file.isHidden ? 1 : 0,
      file.isBrokenShortcut ? 1 : 0,
      sha256,
    ]
  );
  const id = lastInsertRowid as number;
  const assetId = formatAssetId(id);
  db.run("UPDATE assets SET asset_id = ? WHERE id = ?", [assetId, id]);
  return findAssetByAssetId(db, assetId)!;
}

/** Update an existing asset's filesystem/hash facts after re-scan. Never touches asset_id. */
export function updateAssetOnRescan(
  db: WorkspaceDatabase,
  existing: AssetRecord,
  file: DiscoveredFile,
  sha256: string | null
): void {
  db.run(
    `UPDATE assets SET size_bytes = ?, created_at = ?, modified_at = ?, accessed_at = ?,
       is_hidden = ?, is_broken_shortcut = ?, status = 'active', sha256 = ?, last_seen_at = datetime('now')
     WHERE id = ?`,
    [
      file.sizeBytes,
      file.createdAt,
      file.modifiedAt,
      file.accessedAt,
      file.isHidden ? 1 : 0,
      file.isBrokenShortcut ? 1 : 0,
      sha256,
      existing.id,
    ]
  );
}

export function touchAssetSeen(db: WorkspaceDatabase, assetId: number): void {
  db.run("UPDATE assets SET last_seen_at = datetime('now'), status = 'active' WHERE id = ?", [assetId]);
}

export function markAssetsMissing(db: WorkspaceDatabase, seenIds: Set<number>): number {
  const active = listActiveAssets(db);
  let count = 0;
  for (const asset of active) {
    if (!seenIds.has(asset.id)) {
      db.run("UPDATE assets SET status = 'missing' WHERE id = ?", [asset.id]);
      count++;
    }
  }
  return count;
}

// ---- hash checks ----

export function recordHashCheck(db: WorkspaceDatabase, assetId: number, hash: string, matched: boolean): void {
  db.run("INSERT INTO hash_checks (asset_id, hash_value, matched_previous) VALUES (?, ?, ?)", [
    assetId,
    hash,
    matched ? 1 : 0,
  ]);
}

// ---- duplicates ----

export function registerDuplicateIfNeeded(db: WorkspaceDatabase, sha256: string, assetId: number): boolean {
  const matches = db.all("SELECT * FROM assets WHERE sha256 = ? AND status = 'active'", [sha256]).map(
    (r) => mapAssetRow(r)!
  );
  if (matches.length < 2) return false;

  let group = db.get<{ id: number }>("SELECT id FROM duplicate_groups WHERE sha256 = ?", [sha256]);
  if (!group) {
    const { lastInsertRowid } = db.run("INSERT INTO duplicate_groups (sha256) VALUES (?)", [sha256]);
    group = { id: lastInsertRowid as number };
  }
  for (const match of matches) {
    db.run("INSERT OR IGNORE INTO duplicate_group_members (group_id, asset_id) VALUES (?, ?)", [
      group.id,
      match.id,
    ]);
  }
  db.run("INSERT OR IGNORE INTO duplicate_group_members (group_id, asset_id) VALUES (?, ?)", [group.id, assetId]);
  return true;
}

// ---- metadata ----

export function replaceAssetMetadata(db: WorkspaceDatabase, assetId: number, records: MetadataRecord[]): void {
  db.run("DELETE FROM metadata WHERE asset_id = ?", [assetId]);
  for (const rec of records) {
    db.run("INSERT INTO metadata (asset_id, key, value, source, confidence) VALUES (?, ?, ?, ?, ?)", [
      assetId,
      rec.key,
      rec.value,
      rec.source,
      rec.confidence,
    ]);
  }
}

// ---- relationships ----

export function addRelationship(db: WorkspaceDatabase, rel: RelationshipRecord): void {
  db.run(
    `INSERT OR IGNORE INTO relationships
       (from_asset_id, to_asset_id, relationship_type, confidence, evidence_note, detected_method)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rel.fromAssetId, rel.toAssetId, rel.relationshipType, rel.confidence, rel.evidenceNote, rel.detectedMethod]
  );
}

// ---- timeline ----

export function addTimelineEvent(db: WorkspaceDatabase, event: TimelineEventInput): void {
  db.run(
    `INSERT INTO timeline_events
       (asset_id, event_type, event_date, date_source, title, description, confidence, verified_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.assetId,
      event.eventType,
      event.eventDate,
      event.dateSource,
      event.title,
      event.description ?? null,
      event.confidence,
      event.verifiedStatus,
    ]
  );
}

// ---- scan runs ----

export function createScanRun(db: WorkspaceDatabase, runKey: string, trigger: ScanTrigger): number {
  const { lastInsertRowid } = db.run("INSERT INTO scan_runs (run_key, trigger) VALUES (?, ?)", [runKey, trigger]);
  return lastInsertRowid as number;
}

export function finishScanRun(
  db: WorkspaceDatabase,
  scanRunId: number,
  status: ScanRunStatus,
  counts: {
    filesDiscovered: number;
    filesScanned: number;
    filesSkipped: number;
    filesErrored: number;
    assetsCreated: number;
    assetsUpdated: number;
    assetsMissing: number;
    duplicateGroupsFound: number;
  }
): void {
  db.run(
    `UPDATE scan_runs SET status = ?, finished_at = datetime('now'),
       files_discovered = ?, files_scanned = ?, files_skipped = ?, files_errored = ?,
       assets_created = ?, assets_updated = ?, assets_missing = ?, duplicate_groups_found = ?
     WHERE id = ?`,
    [
      status,
      counts.filesDiscovered,
      counts.filesScanned,
      counts.filesSkipped,
      counts.filesErrored,
      counts.assetsCreated,
      counts.assetsUpdated,
      counts.assetsMissing,
      counts.duplicateGroupsFound,
      scanRunId,
    ]
  );
}

export { formatAssetId };
