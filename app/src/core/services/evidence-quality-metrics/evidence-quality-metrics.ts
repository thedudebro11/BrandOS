import type { WorkspaceDatabase } from "../../db/connection";
import type { EvidenceQualityMetricsResult } from "../../types";

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

/**
 * Shared presentation banding for any 0-100 score. Lives in the engine layer,
 * not in the dashboard, so any future consumer (CLI, report, dashboard) gets
 * the identical High/Medium/Low cutoffs — no dashboard-specific calculations
 * (Phase 4 hard rule: the dashboard asks questions, the engine answers them).
 */
export function bandLabel(score: number): "High" | "Medium" | "Low" | "Unknown" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  if (score >= 0) return "Low";
  return "Unknown";
}

/**
 * Every metric here has one clearly-stated formula, computed fresh from real
 * rows each call — nothing cached, nothing estimated. This is the numeric
 * backbone of PHASE_3_5_VALIDATION_REPORT.md and the future dashboard's
 * evidence-quality widgets (System 9/12: build once, reuse everywhere).
 */
export function computeEvidenceQualityMetrics(db: WorkspaceDatabase): EvidenceQualityMetricsResult {
  const totalActive = db.get<{ c: number }>("SELECT COUNT(*) as c FROM assets WHERE status = 'active'")?.c ?? 0;

  const withResolvedDate = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM resolved_dates rd JOIN assets a ON a.id = rd.asset_id WHERE a.status = 'active'"
  )?.c ?? 0;
  const timelineCompleteness = pct(withResolvedDate, totalActive);

  const withMetadata = db.get<{ c: number }>(
    "SELECT COUNT(DISTINCT m.asset_id) as c FROM metadata m JOIN assets a ON a.id = m.asset_id WHERE a.status = 'active'"
  )?.c ?? 0;
  const metadataCompleteness = pct(withMetadata, totalActive);

  const withRelationship = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM assets a WHERE a.status = 'active' AND (
       EXISTS (SELECT 1 FROM relationships r WHERE r.from_asset_id = a.id OR r.to_asset_id = a.id)
     )`
  )?.c ?? 0;
  const relationshipCompleteness = pct(withRelationship, totalActive);

  const confidentlyClassified = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM classifications c JOIN assets a ON a.id = c.asset_id
     WHERE a.status = 'active' AND c.confidence >= 70 AND c.category != 'Unknown'`
  )?.c ?? 0;
  const classificationCompleteness = pct(confidentlyClassified, totalActive);

  const bands = [
    { band: "0-39", min: 0, max: 39 },
    { band: "40-69", min: 40, max: 69 },
    { band: "70-89", min: 70, max: 89 },
    { band: "90-100", min: 90, max: 100 },
  ];
  const confidenceDistribution = bands.map(({ band, min, max }) => ({
    band,
    count:
      db.get<{ c: number }>(
        `SELECT COUNT(*) as c FROM classifications c JOIN assets a ON a.id = c.asset_id
         WHERE a.status = 'active' AND c.confidence >= ? AND c.confidence <= ?`,
        [min, max]
      )?.c ?? 0,
  }));

  const openReview = db.get<{ c: number }>("SELECT COUNT(*) as c FROM review_queue WHERE status = 'open'")?.c ?? 0;
  const needsReviewPercent = pct(openReview, totalActive);

  const inDuplicateGroup = db.get<{ c: number }>(
    `SELECT COUNT(DISTINCT dgm.asset_id) as c FROM duplicate_group_members dgm JOIN assets a ON a.id = dgm.asset_id WHERE a.status = 'active'`
  )?.c ?? 0;
  const duplicateCoverage = pct(inDuplicateGroup, totalActive);

  const withAnyTag = db.get<{ c: number }>(
    `SELECT COUNT(DISTINCT at.asset_id) as c FROM asset_tags at JOIN assets a ON a.id = at.asset_id WHERE a.status = 'active'`
  )?.c ?? 0;
  const evidenceCoverage = pct(withAnyTag, totalActive);

  const fullyTraceable = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM assets a JOIN resolved_dates rd ON rd.asset_id = a.id
     WHERE a.status = 'active' AND a.sha256 IS NOT NULL`
  )?.c ?? 0;
  const provenanceCoverage = pct(fullyTraceable, totalActive);

  // Health score: fixed per the Phase 3.5 finding that a flat per-finding
  // subtraction breaks on real data (it hit 0/100 from finding *volume* alone,
  // e.g. 199 correctly-rejected epoch dates counted as 199 penalties, even
  // though rejecting them is the system working correctly). Now: severity-
  // weighted, and normalized to *percentage of assets affected*, not raw
  // count, so the score doesn't collapse purely because a workspace has many
  // assets. Blended 50/50 with the Knowledge Validation pass rate, a
  // genuinely different signal (structural invariants vs. data quality).
  const findingCounts = db.get<{ critical: number; warning: number }>(
    `SELECT
       SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
       SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning
     FROM data_health_findings WHERE run_at = (SELECT MAX(run_at) FROM data_health_findings)`
  );
  const criticalRatePct = totalActive === 0 ? 0 : ((findingCounts?.critical ?? 0) / totalActive) * 100;
  const warningRatePct = totalActive === 0 ? 0 : ((findingCounts?.warning ?? 0) / totalActive) * 100;
  const findingPenalty = Math.min(100, criticalRatePct * 10 + warningRatePct * 2);

  const validationRows = db.all<{ passed: number }>(
    "SELECT passed FROM knowledge_validation_runs WHERE run_at = (SELECT MAX(run_at) FROM knowledge_validation_runs)"
  );
  const validationPassRate =
    validationRows.length === 0 ? 100 : pct(validationRows.filter((r) => r.passed).length, validationRows.length);

  const healthScore = Math.round(0.5 * validationPassRate + 0.5 * Math.max(0, 100 - findingPenalty));

  const missingSomething = db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM assets a WHERE a.status = 'active' AND (
       NOT EXISTS (SELECT 1 FROM classifications c WHERE c.asset_id = a.id AND c.category != 'Unknown' AND c.confidence >= 70)
       OR NOT EXISTS (SELECT 1 FROM metadata m WHERE m.asset_id = a.id)
       OR NOT EXISTS (SELECT 1 FROM resolved_dates rd WHERE rd.asset_id = a.id)
     )`
  )?.c ?? 0;
  const missingEvidenceScore = pct(missingSomething, totalActive);

  const conflictingResolved = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM resolved_dates WHERE reasoning LIKE '%conflict%'"
  )?.c ?? 0;
  const conflictingEvidenceScore = pct(conflictingResolved, Math.max(withResolvedDate, 1));

  return {
    timelineCompleteness,
    metadataCompleteness,
    relationshipCompleteness,
    classificationCompleteness,
    confidenceDistribution,
    needsReviewPercent,
    duplicateCoverage,
    evidenceCoverage,
    provenanceCoverage,
    healthScore,
    missingEvidenceScore,
    conflictingEvidenceScore,
  };
}
