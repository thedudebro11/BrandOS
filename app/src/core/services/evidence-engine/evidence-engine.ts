import type { WorkspaceDatabase } from "../../db/connection";
import {
  listClassifications,
  recordEvidenceAssessment,
  recordEvidenceGap,
} from "../../db/knowledge-repositories";
import type { EvidenceStatus } from "../../types";

function statusForScore(score: number): EvidenceStatus {
  if (score >= 70) return "strong";
  if (score >= 40) return "weak";
  return "missing";
}

/**
 * Every score here is a plainly-documented arithmetic formula over real rows
 * — never a guess, never AI. Notes always name which assets/events/counts
 * produced the number (ARCHITECTURE_PRINCIPLES.md #3/#4): a workspace with
 * zero evidence gets a score of 0 and a note saying so, not a withheld
 * assessment and not an inflated one.
 */
export function assessWorkspaceEvidence(db: WorkspaceDatabase): void {
  assessCompleteness(db);
  assessContinuousUse(db);
  assessPriorityOfUse(db);
  detectCategoryGaps(db);
}

function assessCompleteness(db: WorkspaceDatabase): void {
  const classifications = listClassifications(db);
  const total = classifications.length;
  const classified = classifications.filter((c) => c.category !== "Unknown" && c.confidence >= 70).length;
  const score = total === 0 ? 0 : Math.round((classified / total) * 100);
  recordEvidenceAssessment(
    db,
    "workspace",
    null,
    "completeness",
    score,
    statusForScore(score),
    `${classified} of ${total} active assets have a confident (>=70), non-Unknown classification. Formula: classified / total * 100.`
  );
}

function assessContinuousUse(db: WorkspaceDatabase): void {
  const dates = db
    .all<{ event_date: string }>(
      "SELECT DISTINCT event_date FROM timeline_events WHERE event_date IS NOT NULL ORDER BY event_date"
    )
    .map((r) => new Date(r.event_date).getTime())
    .filter((t) => !Number.isNaN(t));

  if (dates.length < 2) {
    recordEvidenceAssessment(
      db,
      "workspace",
      null,
      "continuous_use",
      0,
      "missing",
      `Only ${dates.length} distinct timeline date(s) found — not enough to assess continuity of use.`
    );
    return;
  }

  const spanDays = (dates[dates.length - 1] - dates[0]) / 86_400_000;
  let maxGapDays = 0;
  for (let i = 1; i < dates.length; i++) {
    maxGapDays = Math.max(maxGapDays, (dates[i] - dates[i - 1]) / 86_400_000);
  }
  // Larger gaps relative to the overall span indicate weaker continuity.
  const gapRatio = spanDays > 0 ? maxGapDays / spanDays : 1;
  const score = Math.max(0, Math.round((1 - gapRatio) * 100));
  recordEvidenceAssessment(
    db,
    "workspace",
    null,
    "continuous_use",
    score,
    statusForScore(score),
    `${dates.length} distinct dated events spanning ${Math.round(spanDays)} day(s); largest single gap between consecutive dated events is ${Math.round(
      maxGapDays
    )} day(s). Formula: (1 - largest_gap/total_span) * 100.`
  );
}

function assessPriorityOfUse(db: WorkspaceDatabase): void {
  // "Expected earliest evidence" categories a brand-type workspace typically wants
  // dated proof for. A workspace missing all of these has weak priority-of-use support.
  const expectedCategories = ["Design Source", "Marketing Evidence", "Commerce Evidence", "Marketplace Evidence"];
  const present: string[] = [];
  const missing: string[] = [];

  for (const category of expectedCategories) {
    const row = db.get<{ earliest: string | null }>(
      `SELECT MIN(te.event_date) as earliest
       FROM timeline_events te
       JOIN classifications c ON c.asset_id = te.asset_id
       WHERE c.category = ?`,
      [category]
    );
    if (row?.earliest) present.push(category);
    else missing.push(category);
  }

  const score = Math.round((present.length / expectedCategories.length) * 100);
  recordEvidenceAssessment(
    db,
    "workspace",
    null,
    "priority_of_use",
    score,
    statusForScore(score),
    `Dated evidence present for: ${present.join(", ") || "(none)"}. Missing dated evidence for: ${
      missing.join(", ") || "(none)"
    }. Formula: categories_with_dated_evidence / total_expected_categories * 100.`
  );

  for (const category of missing) {
    recordEvidenceGap(
      db,
      "workspace",
      null,
      "priority_of_use_category_missing",
      `No dated timeline evidence found for category "${category}" — priority-of-use claims for this category cannot currently be supported.`,
      "high"
    );
  }
}

function detectCategoryGaps(db: WorkspaceDatabase): void {
  const unknownCount = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM classifications WHERE category = 'Unknown'"
  )?.c ?? 0;
  if (unknownCount > 0) {
    recordEvidenceGap(
      db,
      "workspace",
      null,
      "unclassified_assets",
      `${unknownCount} asset(s) could not be classified by any rule and need manual review before they can support any evidence claim.`,
      "normal"
    );
  }

  const reviewCount = db.get<{ c: number }>("SELECT COUNT(*) as c FROM review_queue WHERE status = 'open'")?.c ?? 0;
  if (reviewCount > 0) {
    recordEvidenceGap(
      db,
      "workspace",
      null,
      "open_review_queue",
      `${reviewCount} item(s) are in the Human Review Queue with confidence below 70 and are not yet usable as settled evidence.`,
      "normal"
    );
  }
}

/** Case-scoped evidence strength: what fraction of a case's linked assets are confidently classified. */
export function assessCaseEvidence(db: WorkspaceDatabase, caseId: number): void {
  const links = db.all<{ linked_id: number }>(
    "SELECT linked_id FROM case_links WHERE case_id = ? AND linked_type = 'asset'",
    [caseId]
  );
  if (links.length === 0) {
    recordEvidenceAssessment(db, "case", caseId, "strength", 0, "missing", "Case has no linked assets yet.");
    return;
  }
  let strong = 0;
  for (const l of links) {
    const c = db.get<{ confidence: number; category: string }>(
      "SELECT confidence, category FROM classifications WHERE asset_id = ?",
      [l.linked_id]
    );
    if (c && c.confidence >= 90 && c.category !== "Unknown") strong++;
  }
  const score = Math.round((strong / links.length) * 100);
  recordEvidenceAssessment(
    db,
    "case",
    caseId,
    "strength",
    score,
    statusForScore(score),
    `${strong} of ${links.length} linked asset(s) have a high-confidence (>=90) classification. Formula: strong / total_linked * 100.`
  );
}
