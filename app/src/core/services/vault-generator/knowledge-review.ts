import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import { listAllObsidianNotes } from "../../db/vault-repositories";
import { listActiveAssets } from "../../db/repositories";
import { listCases } from "../../db/knowledge-repositories";
import { validateKnowledge } from "../knowledge-validation-engine/knowledge-validation-engine";
import type { KnowledgeReviewFinding } from "../../types";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Real checks against the generated vault + database — never a heuristic
 * guess. Phase 6 Section 9. Delegates to the existing Knowledge Validation
 * Engine (Phase 3.5) for DB-level reference integrity rather than
 * re-implementing it (no duplicate logic).
 */
export function runKnowledgeReview(wfs: WorkspaceFs, db: WorkspaceDatabase): KnowledgeReviewFinding[] {
  const findings: KnowledgeReviewFinding[] = [];
  const notes = listAllObsidianNotes(db);
  const notesByEntityId = new Map(notes.map((n) => [n.entityId, n]));
  const linkedFrom = new Map<string, Set<string>>(); // target entityId -> set of source vaultPaths linking to it

  // Missing notes: every active asset/case should have a corresponding generated note.
  const activeAssets = listActiveAssets(db);
  for (const a of activeAssets) {
    if (!notesByEntityId.has(a.assetId)) {
      findings.push({
        findingType: "missing_note",
        severity: "warning",
        vaultPath: null,
        description: `Asset ${a.assetId} (${a.filename}) has no generated note yet — run vault generation.`,
      });
    }
  }
  for (const c of listCases(db)) {
    const key = c.caseKey ?? `case-${c.id}`;
    if (!notesByEntityId.has(key)) {
      findings.push({
        findingType: "missing_note",
        severity: "warning",
        vaultPath: null,
        description: `Case ${key} (${c.title}) has no generated note yet — run vault generation.`,
      });
    }
  }

  // Broken links + backlink coverage: parse every note's actual on-disk content.
  for (const note of notes) {
    const raw = wfs.readVaultFile(note.vaultPath);
    if (raw === null) {
      findings.push({
        findingType: "orphaned_note",
        severity: "warning",
        vaultPath: note.vaultPath,
        description: `Tracked in the database but missing from disk: ${note.vaultPath}.`,
      });
      continue;
    }
    const matches = [...raw.matchAll(WIKILINK_RE)].map((m) => m[1]);
    for (const target of matches) {
      const targetId = target.split("/").pop()!; // handle "Indexes/All Assets" style links too
      if (!notesByEntityId.has(targetId) && !notesByEntityId.has(target)) {
        findings.push({
          findingType: "broken_link",
          severity: "info",
          vaultPath: note.vaultPath,
          description: `${note.vaultPath} links to "${target}", which has no corresponding generated note.`,
        });
      } else {
        const realTargetId = notesByEntityId.has(targetId) ? targetId : target;
        if (!linkedFrom.has(realTargetId)) linkedFrom.set(realTargetId, new Set());
        linkedFrom.get(realTargetId)!.add(note.vaultPath);
      }
    }
  }

  // Orphaned notes: no other note links to this one, and it isn't the workspace root/an index.
  for (const note of notes) {
    if (note.entityType === "workspace" || note.entityType === "index") continue;
    if (!linkedFrom.has(note.entityId) || linkedFrom.get(note.entityId)!.size === 0) {
      findings.push({
        findingType: "orphaned_note",
        severity: "info",
        vaultPath: note.vaultPath,
        description: `No other note links to ${note.vaultPath} — only reachable via an index page, not organically connected.`,
      });
    }
  }

  // Stale content: underlying data changed after this note was last generated.
  for (const note of notes) {
    if (note.entityType !== "asset") continue;
    const lastTouched = db.get<{ t: string }>(
      "SELECT MAX(last_seen_at) as t FROM assets WHERE asset_id = ?",
      [note.entityId]
    )?.t;
    if (lastTouched && lastTouched > note.lastGeneratedAt) {
      findings.push({
        findingType: "stale_content",
        severity: "info",
        vaultPath: note.vaultPath,
        description: `Asset ${note.entityId} was rescanned (${lastTouched}) after its note was last generated (${note.lastGeneratedAt}) — regenerate to refresh.`,
      });
    }
  }

  // Unresolved DB-level references — delegate to the existing Knowledge Validation Engine, never re-implement.
  for (const check of validateKnowledge(db)) {
    if (!check.passed) {
      findings.push({
        findingType: "unresolved_reference",
        severity: "critical",
        vaultPath: null,
        description: `Knowledge validation check "${check.checkName}" failed: ${check.details}`,
      });
    }
  }

  return findings;
}
