import type { WorkspaceDatabase } from "../../db/connection";

export interface ActivityEvent {
  timestamp: string;
  eventType: string;
  description: string;
  entityType: "scan" | "validation" | "case" | "asset" | "relationship" | "health";
  entityId: number | string | null;
}

/**
 * A read-time UNION over existing timestamped tables — no new storage, no
 * duplicated facts (ARCHITECTURE_PRINCIPLES.md #8). Mission Control's
 * "living system" feed and the Recent Activity section both call this one
 * function; nothing computes activity independently in the dashboard.
 */
export function getActivityFeed(db: WorkspaceDatabase, limit = 30): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  const scans = db.all<{ id: number; started_at: string; finished_at: string | null; status: string; assets_created: number; assets_updated: number; duplicate_groups_found: number }>(
    "SELECT id, started_at, finished_at, status, assets_created, assets_updated, duplicate_groups_found FROM scan_runs ORDER BY started_at DESC LIMIT ?",
    [limit]
  );
  for (const s of scans) {
    if (s.status !== "completed") continue;
    events.push({
      timestamp: s.finished_at ?? s.started_at,
      eventType: "scan.completed",
      description: `Scanned workspace — ${s.assets_created} asset(s) created, ${s.assets_updated} updated, ${s.duplicate_groups_found} duplicate group(s) found.`,
      entityType: "scan",
      entityId: s.id,
    });
  }

  const validations = db.all<{ run_at: string; passed: number }>(
    `SELECT run_at, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed FROM knowledge_validation_runs GROUP BY run_at ORDER BY run_at DESC LIMIT ?`,
    [limit]
  );
  for (const v of validations) {
    events.push({
      timestamp: v.run_at,
      eventType: "validation.completed",
      description: `Knowledge validation ran — ${v.passed} check(s) passed.`,
      entityType: "validation",
      entityId: null,
    });
  }

  const cases = db.all<{ id: number; title: string; created_at: string; updated_at: string }>(
    "SELECT id, title, created_at, updated_at FROM cases ORDER BY updated_at DESC LIMIT ?",
    [limit]
  );
  for (const c of cases) {
    const isNew = c.created_at === c.updated_at;
    events.push({
      timestamp: c.updated_at,
      eventType: isNew ? "case.created" : "case.updated",
      description: isNew ? `Case created: "${c.title}"` : `Case updated: "${c.title}"`,
      entityType: "case",
      entityId: c.id,
    });
  }

  const links = db.all<{ id: number; case_id: number; linked_type: string; created_at: string; case_title: string }>(
    `SELECT cl.id, cl.case_id, cl.linked_type, cl.created_at, c.title as case_title
     FROM case_links cl JOIN cases c ON c.id = cl.case_id ORDER BY cl.created_at DESC LIMIT ?`,
    [limit]
  );
  for (const l of links) {
    events.push({
      timestamp: l.created_at,
      eventType: "evidence.linked",
      description: `Evidence linked to "${l.case_title}"`,
      entityType: "case",
      entityId: l.case_id,
    });
  }

  const relationships = db.all<{ id: number; relationship_type: string; created_at: string; from_asset_id: number; to_asset_id: number }>(
    "SELECT id, relationship_type, created_at, from_asset_id, to_asset_id FROM relationships ORDER BY created_at DESC LIMIT ?",
    [limit]
  );
  for (const r of relationships) {
    events.push({
      timestamp: r.created_at,
      eventType: "relationship.discovered",
      description: `Relationship discovered: ${r.relationship_type}`,
      entityType: "relationship",
      entityId: r.id,
    });
  }

  const findings = db.all<{ finding_type: string; severity: string; run_at: string; c: number }>(
    `SELECT finding_type, severity, run_at, COUNT(*) as c FROM data_health_findings
     WHERE run_at = (SELECT MAX(run_at) FROM data_health_findings)
     GROUP BY finding_type, severity`
  );
  for (const f of findings) {
    events.push({
      timestamp: f.run_at,
      eventType: "health.findings",
      description: `Data health check: ${f.c} ${f.severity} finding(s) of type "${f.finding_type}"`,
      entityType: "health",
      entityId: null,
    });
  }

  return events
    .filter((e) => !!e.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
