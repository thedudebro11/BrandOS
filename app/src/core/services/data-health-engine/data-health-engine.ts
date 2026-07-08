import type { WorkspaceDatabase } from "../../db/connection";
import { recordDataHealthFinding } from "../../db/knowledge-repositories";
import { runIntegrityCheck } from "../integrity-engine/integrity-engine";
import { checkPlausibility } from "../timeline-intelligence/plausibility";
import type { DataHealthFinding } from "../../types";

/**
 * Continuously detects data-quality problems. Delegates the checks Phase 3's
 * Integrity Engine already covers (duplicate/orphaned/missing assets,
 * circular relationships, broken references, hash mismatches) instead of
 * re-implementing them (System 12: no duplicate logic) — this engine adds
 * only the genuinely new Phase 3.5 checks: epoch/implausible dates, broken
 * candidate-date provenance, and duplicate metadata.
 */
export function runDataHealthCheck(db: WorkspaceDatabase): DataHealthFinding[] {
  const findings: DataHealthFinding[] = [];

  // Delegate to Phase 3's Integrity Engine for the overlapping structural checks.
  const integrityIssues = runIntegrityCheck(db);
  for (const issue of integrityIssues) {
    findings.push({
      findingType: issue.issueType,
      severity: issue.severity,
      scopeType: issue.scopeType,
      scopeId: issue.scopeId,
      description: issue.description,
    });
  }

  // New: implausible/epoch candidate dates.
  const implausible = db.all<{ id: number; asset_id: number; source_type: string; date_value: string; implausibility_reason: string }>(
    "SELECT id, asset_id, source_type, date_value, implausibility_reason FROM candidate_dates WHERE is_plausible = 0"
  );
  const epochCount = implausible.filter((c) => checkPlausibility(c.date_value).reason?.includes("Unix epoch")).length;
  if (epochCount > 0) {
    findings.push({
      findingType: "epoch_date",
      severity: "warning",
      scopeType: "workspace",
      scopeId: null,
      description: `${epochCount} candidate date(s) across the workspace are Unix-epoch artifacts (unpopulated filesystem timestamps), not real dates. See ARCHITECTURE_DECISIONS.md ADR-010.`,
    });
  }
  for (const c of implausible) {
    findings.push({
      findingType: "invalid_timestamp",
      severity: "info",
      scopeType: "asset",
      scopeId: c.asset_id,
      description: `Candidate date from "${c.source_type}" rejected: ${c.implausibility_reason}`,
    });
  }

  // New: broken provenance — a candidate date's source_asset_id (relationship-derived dates) pointing nowhere.
  const brokenProvenance = db.all<{ id: number; asset_id: number; source_asset_id: number }>(
    `SELECT cd.id, cd.asset_id, cd.source_asset_id FROM candidate_dates cd
     WHERE cd.source_asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = cd.source_asset_id)`
  );
  for (const bp of brokenProvenance) {
    findings.push({
      findingType: "broken_provenance",
      severity: "critical",
      scopeType: "candidate_date",
      scopeId: bp.id,
      description: `Candidate date ${bp.id} for asset ${bp.asset_id} references source_asset_id ${bp.source_asset_id}, which does not exist.`,
    });
  }

  // New: duplicate metadata rows (same asset+key+value more than once — should never happen given replaceAssetMetadata's delete-then-insert pattern, but verified, not assumed).
  const dupMetadata = db.all<{ asset_id: number; key: string; value: string; c: number }>(
    `SELECT asset_id, key, value, COUNT(*) as c FROM metadata GROUP BY asset_id, key, value HAVING c > 1`
  );
  for (const d of dupMetadata) {
    findings.push({
      findingType: "duplicate_metadata",
      severity: "warning",
      scopeType: "asset",
      scopeId: d.asset_id,
      description: `Metadata key "${d.key}" = "${d.value}" is stored ${d.c} times for asset ${d.asset_id} (expected exactly once).`,
    });
  }

  for (const f of findings) recordDataHealthFinding(db, f);
  return findings;
}
