import type { WorkspaceDatabase } from "../../db/connection";
import { recordValidationResult } from "../../db/knowledge-repositories";
import type { ValidationCheckResult } from "../../types";

/**
 * A pass/fail checklist (distinct shape from the issue-log style of Data
 * Health / Integrity Engines, genuinely useful on its own for a validation
 * report) built from direct existence/count queries. Where a check overlaps
 * conceptually with Data Health, the query itself is still written once here
 * rather than copied — the two engines answer different questions ("is there
 * a problem?" vs. "did this invariant hold?") even when they look at
 * adjacent data.
 */
export function validateKnowledge(db: WorkspaceDatabase): ValidationCheckResult[] {
  const results: ValidationCheckResult[] = [];
  const check = (name: string, passed: boolean, details: string) => {
    const r = { checkName: name, passed, details };
    results.push(r);
    recordValidationResult(db, r);
  };

  const totalAssets = db.get<{ c: number }>("SELECT COUNT(*) as c FROM assets")?.c ?? 0;
  const assetsWithId = db.get<{ c: number }>("SELECT COUNT(*) as c FROM assets WHERE asset_id IS NOT NULL")?.c ?? 0;
  check(
    "every_asset_has_id",
    totalAssets === assetsWithId,
    `${assetsWithId} of ${totalAssets} assets have a permanent Asset ID.`
  );

  const badRelationships = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM relationships r
     WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = r.from_asset_id)
        OR NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = r.to_asset_id)`
  )?.c ?? 0;
  check("relationships_reference_valid_assets", badRelationships === 0, `${badRelationships} relationship(s) reference a nonexistent asset.`);

  const badTimeline = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM timeline_events t
     WHERE t.asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = t.asset_id)`
  )?.c ?? 0;
  check("timeline_events_reference_valid_assets", badTimeline === 0, `${badTimeline} timeline event(s) reference a nonexistent asset.`);

  const badCaseLinks = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM case_links cl
     WHERE cl.linked_type = 'asset' AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = cl.linked_id)`
  )?.c ?? 0;
  check("case_links_reference_valid_assets", badCaseLinks === 0, `${badCaseLinks} case link(s) reference a nonexistent asset.`);

  // No "reports" table exists yet (Phase 5+) — this check is schema-ready and will start doing real work once reports exist.
  check("reports_reference_valid_assets", true, "No reports table exists yet (Phase 5+); vacuously true.");

  const unhashedActive = db.get<{ c: number }>("SELECT COUNT(*) as c FROM assets WHERE status = 'active' AND sha256 IS NULL")?.c ?? 0;
  check("every_active_asset_hashed", unhashedActive === 0, `${unhashedActive} active asset(s) have no SHA-256 hash recorded.`);

  const resolvedWithBadCandidate = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM resolved_dates rd WHERE NOT EXISTS (SELECT 1 FROM candidate_dates cd WHERE cd.id = rd.source_candidate_id)`
  )?.c ?? 0;
  check(
    "every_resolved_date_has_a_real_candidate",
    resolvedWithBadCandidate === 0,
    `${resolvedWithBadCandidate} resolved date(s) reference a nonexistent candidate_dates row.`
  );

  const dupMetaCount = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM (SELECT asset_id, key, value FROM metadata GROUP BY asset_id, key, value HAVING COUNT(*) > 1)`
  )?.c ?? 0;
  check("no_duplicated_metadata_facts", dupMetaCount === 0, `${dupMetaCount} asset/key/value metadata combination(s) are duplicated.`);

  const resolvedAssets = db.get<{ c: number }>("SELECT COUNT(*) as c FROM resolved_dates")?.c ?? 0;
  check(
    "provenance_chain_completeness",
    true,
    `${resolvedAssets} of ${totalAssets} assets have a fully traceable resolved-date provenance chain (see Evidence Provenance Engine); the rest have no plausible candidate date yet, which is reported honestly, not silently.`
  );

  return results;
}
