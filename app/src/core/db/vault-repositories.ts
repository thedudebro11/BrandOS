import type { WorkspaceDatabase } from "./connection";
import type { ObsidianEntityType, ObsidianNoteRecord } from "../types";

function mapNote(row: Record<string, unknown> | undefined): ObsidianNoteRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    entityType: row.entity_type as ObsidianEntityType,
    entityId: row.entity_id as string,
    vaultPath: row.vault_path as string,
    contentHash: row.content_hash as string,
    lastGeneratedAt: row.last_generated_at as string,
    hasManualEdits: !!row.has_manual_edits,
  };
}

export function getObsidianNoteByPath(db: WorkspaceDatabase, vaultPath: string): ObsidianNoteRecord | undefined {
  return mapNote(db.get("SELECT * FROM obsidian_notes WHERE vault_path = ?", [vaultPath]));
}

export function getObsidianNoteByEntity(
  db: WorkspaceDatabase,
  entityType: ObsidianEntityType,
  entityId: string
): ObsidianNoteRecord | undefined {
  return mapNote(db.get("SELECT * FROM obsidian_notes WHERE entity_type = ? AND entity_id = ?", [entityType, entityId]));
}

export function upsertObsidianNote(
  db: WorkspaceDatabase,
  entityType: ObsidianEntityType,
  entityId: string,
  vaultPath: string,
  contentHash: string,
  hasManualEdits: boolean
): void {
  const existing = getObsidianNoteByPath(db, vaultPath);
  if (existing) {
    db.run(
      `UPDATE obsidian_notes SET content_hash = ?, last_generated_at = datetime('now'), has_manual_edits = ? WHERE vault_path = ?`,
      [contentHash, hasManualEdits ? 1 : 0, vaultPath]
    );
  } else {
    db.run(
      `INSERT INTO obsidian_notes (entity_type, entity_id, vault_path, content_hash, has_manual_edits) VALUES (?, ?, ?, ?, ?)`,
      [entityType, entityId, vaultPath, contentHash, hasManualEdits ? 1 : 0]
    );
  }
}

export function listAllObsidianNotes(db: WorkspaceDatabase): ObsidianNoteRecord[] {
  return db.all("SELECT * FROM obsidian_notes").map((r) => mapNote(r)!);
}
