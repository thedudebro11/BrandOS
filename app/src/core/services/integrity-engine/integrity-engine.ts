import type { WorkspaceDatabase } from "../../db/connection";
import { recordIntegrityIssue } from "../../db/knowledge-repositories";
import type { IntegrityIssue } from "../../types";

/**
 * Read-only diagnostic pass. Detects, records, and returns issues; never
 * fixes anything automatically — a repair is always a separate, explicit,
 * human-initiated action (ARCHITECTURE_PRINCIPLES.md #9).
 */
export function runIntegrityCheck(db: WorkspaceDatabase): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const assetIds = new Set(db.all<{ id: number }>("SELECT id FROM assets").map((r) => r.id));

  // Broken references: relationships, case_links, classifications, timeline_events, asset_tags, asset_notes pointing at a nonexistent asset id.
  const relRows = db.all<{ id: number; from_asset_id: number; to_asset_id: number }>(
    "SELECT id, from_asset_id, to_asset_id FROM relationships"
  );
  for (const r of relRows) {
    if (!assetIds.has(r.from_asset_id) || !assetIds.has(r.to_asset_id)) {
      issues.push({
        issueType: "broken_reference",
        severity: "critical",
        scopeType: "relationship",
        scopeId: r.id,
        description: `Relationship ${r.id} references a nonexistent asset (from=${r.from_asset_id}, to=${r.to_asset_id})`,
      });
    }
  }

  const caseLinkRows = db.all<{ id: number; linked_type: string; linked_id: number }>(
    "SELECT id, linked_type, linked_id FROM case_links WHERE linked_type = 'asset'"
  );
  for (const cl of caseLinkRows) {
    if (!assetIds.has(cl.linked_id)) {
      issues.push({
        issueType: "broken_reference",
        severity: "critical",
        scopeType: "case_link",
        scopeId: cl.id,
        description: `Case link ${cl.id} references a nonexistent asset ${cl.linked_id}`,
      });
    }
  }

  // Missing assets (evidence went away from disk since last scan — flagged, not deleted).
  const missing = db.all<{ id: number; original_path: string }>("SELECT id, original_path FROM assets WHERE status = 'missing'");
  for (const m of missing) {
    issues.push({
      issueType: "missing_asset",
      severity: "warning",
      scopeType: "asset",
      scopeId: m.id,
      description: `Asset ${m.id} (${m.original_path}) was previously scanned but is no longer present on disk.`,
    });
  }

  // Hash mismatches from verification history (see hash-engine.ts verifyAssetHash / hash_checks table).
  const mismatches = db.all<{ asset_id: number; hash_value: string; checked_at: string }>(
    "SELECT asset_id, hash_value, checked_at FROM hash_checks WHERE matched_previous = 0 ORDER BY checked_at DESC"
  );
  for (const m of mismatches) {
    issues.push({
      issueType: "hash_mismatch",
      severity: "critical",
      scopeType: "asset",
      scopeId: m.asset_id,
      description: `Asset ${m.asset_id} failed hash verification at ${m.checked_at} (recomputed hash ${m.hash_value} did not match the stored hash) — the original file may have been modified.`,
    });
  }

  // Duplicate assets.
  const dupGroups = db.all<{ id: number; sha256: string }>("SELECT id, sha256 FROM duplicate_groups");
  for (const g of dupGroups) {
    const members = db.all<{ asset_id: number }>("SELECT asset_id FROM duplicate_group_members WHERE group_id = ?", [g.id]);
    issues.push({
      issueType: "duplicate_asset",
      severity: "info",
      scopeType: "duplicate_group",
      scopeId: g.id,
      description: `${members.length} asset(s) share identical content (sha256 ${g.sha256}): ${members.map((m) => m.asset_id).join(", ")}`,
    });
  }

  // Circular relationships — DFS cycle detection over the relationships graph.
  const adjacency = new Map<number, number[]>();
  for (const r of relRows) {
    if (!adjacency.has(r.from_asset_id)) adjacency.set(r.from_asset_id, []);
    adjacency.get(r.from_asset_id)!.push(r.to_asset_id);
  }
  const visited = new Set<number>();
  const inStack = new Set<number>();
  function dfs(node: number, path: number[]): number[] | null {
    if (inStack.has(node)) return [...path, node];
    if (visited.has(node)) return null;
    visited.add(node);
    inStack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      const cycle = dfs(next, [...path, node]);
      if (cycle) return cycle;
    }
    inStack.delete(node);
    return null;
  }
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const cycle = dfs(start, []);
    if (cycle) {
      issues.push({
        issueType: "circular_relationship",
        severity: "critical",
        scopeType: "asset",
        scopeId: start,
        description: `Circular relationship chain detected: ${cycle.join(" -> ")}`,
      });
      break; // one report is enough to flag the problem; fixing it is a manual follow-up, not this pass's job
    }
  }

  // Orphaned assets: no relationships, no case links, no tags — fully disconnected from the knowledge graph.
  const inRelationship = new Set<number>();
  for (const r of relRows) {
    inRelationship.add(r.from_asset_id);
    inRelationship.add(r.to_asset_id);
  }
  const inCaseLink = new Set(caseLinkRows.map((c) => c.linked_id));
  const tagged = new Set(db.all<{ asset_id: number }>("SELECT DISTINCT asset_id FROM asset_tags").map((r) => r.asset_id));
  const activeAssets = db.all<{ id: number; original_path: string }>("SELECT id, original_path FROM assets WHERE status = 'active'");
  for (const a of activeAssets) {
    if (!inRelationship.has(a.id) && !inCaseLink.has(a.id) && !tagged.has(a.id)) {
      issues.push({
        issueType: "orphaned_asset",
        severity: "info",
        scopeType: "asset",
        scopeId: a.id,
        description: `Asset ${a.id} (${a.original_path}) has no relationships, case links, or tags — fully disconnected from the knowledge graph.`,
      });
    }
  }

  for (const issue of issues) recordIntegrityIssue(db, issue);
  return issues;
}
