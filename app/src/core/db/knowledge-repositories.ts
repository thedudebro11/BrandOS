import type { WorkspaceDatabase } from "./connection";
import type {
  AssetTagRecord,
  CandidateDateInput,
  CandidateDateRecord,
  CaseLinkedType,
  CaseLinkRecord,
  CaseRecord,
  CaseTemplate,
  ClassificationRecord,
  DataHealthFinding,
  DateSourcePriority,
  DateSourceType,
  EvidenceAssessment,
  EvidenceDimension,
  EvidenceGap,
  EvidenceScope,
  EvidenceStatus,
  IntegrityIssue,
  RejectedAlternative,
  ResolvedDateRecord,
  ReviewQueueEntry,
  TagRecord,
  ValidationCheckResult,
} from "../types";

// ---- tags ----

export function getOrCreateTag(db: WorkspaceDatabase, name: string): TagRecord {
  const existing = db.get<{ id: number; name: string }>("SELECT * FROM tags WHERE name = ?", [name]);
  if (existing) return existing;
  const { lastInsertRowid } = db.run("INSERT INTO tags (name) VALUES (?)", [name]);
  return { id: lastInsertRowid as number, name };
}

export function tagAsset(
  db: WorkspaceDatabase,
  assetId: number,
  tagName: string,
  source: "automatic" | "manual",
  confidence: number,
  reason: string | null
): void {
  const tag = getOrCreateTag(db, tagName);
  db.run(
    `INSERT INTO asset_tags (asset_id, tag_id, source, confidence, reason) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(asset_id, tag_id) DO UPDATE SET source = excluded.source, confidence = excluded.confidence, reason = excluded.reason`,
    [assetId, tag.id, source, confidence, reason]
  );
}

export function clearAutomaticTags(db: WorkspaceDatabase, assetId: number): void {
  db.run("DELETE FROM asset_tags WHERE asset_id = ? AND source = 'automatic'", [assetId]);
}

export function getAssetTags(db: WorkspaceDatabase, assetId: number): AssetTagRecord[] {
  return db
    .all<{
      asset_id: number;
      tag_id: number;
      name: string;
      source: "automatic" | "manual";
      confidence: number;
      reason: string | null;
    }>(
      `SELECT at.asset_id, at.tag_id, t.name, at.source, at.confidence, at.reason
       FROM asset_tags at JOIN tags t ON t.id = at.tag_id WHERE at.asset_id = ?`,
      [assetId]
    )
    .map((r) => ({
      assetId: r.asset_id,
      tagId: r.tag_id,
      tagName: r.name,
      source: r.source,
      confidence: r.confidence,
      reason: r.reason,
    }));
}

export function findAssetIdsByTag(db: WorkspaceDatabase, tagName: string): number[] {
  return db
    .all<{ asset_id: number }>(
      `SELECT at.asset_id FROM asset_tags at JOIN tags t ON t.id = at.tag_id WHERE t.name = ?`,
      [tagName]
    )
    .map((r) => r.asset_id);
}

// ---- classifications ----

function mapClassification(row: Record<string, unknown> | undefined): ClassificationRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    assetId: row.asset_id as number,
    category: row.category as string,
    confidence: row.confidence as number,
    method: row.method as "rule_based" | "ai_assisted",
    ruleId: row.rule_id as string,
    reason: row.reason as string,
    needsReview: row.needs_review as number,
    createdAt: row.created_at as string,
  };
}

export interface ClassificationExplanation {
  supportingEvidence: string;
  missingEvidence: string;
  conflictingEvidence: string;
}

export function upsertClassification(
  db: WorkspaceDatabase,
  assetId: number,
  category: string,
  confidence: number,
  ruleId: string,
  reason: string,
  explanation?: ClassificationExplanation
): ClassificationRecord {
  const needsReview = confidence < 70 ? 1 : 0;
  db.run("DELETE FROM classifications WHERE asset_id = ?", [assetId]);
  db.run(
    `INSERT INTO classifications (asset_id, category, confidence, method, rule_id, reason, needs_review, supporting_evidence, missing_evidence, conflicting_evidence)
     VALUES (?, ?, ?, 'rule_based', ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      category,
      confidence,
      ruleId,
      reason,
      needsReview,
      explanation?.supportingEvidence ?? reason,
      explanation?.missingEvidence ?? null,
      explanation?.conflictingEvidence ?? null,
    ]
  );
  if (needsReview) {
    db.run(
      `INSERT INTO review_queue (asset_id, reason, suggested_classifications, confidence, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [assetId, `Low classification confidence (${confidence}) via rule "${ruleId}": ${reason}`, category, confidence]
    );
  }
  return mapClassification(db.get("SELECT * FROM classifications WHERE asset_id = ?", [assetId]))!;
}

/** Needs Review Intelligence (Phase 3.5 System 7): enriches the most recent open review_queue row for an asset with a concrete explanation and next action. */
export function enrichReviewQueueEntry(
  db: WorkspaceDatabase,
  assetId: number,
  fields: { possibleClassificationsDetail: string; suggestedAction: string; estimatedEffort: string; potentialImpact: string }
): void {
  db.run(
    `UPDATE review_queue SET possible_classifications_detail = ?, suggested_action = ?, estimated_effort = ?, potential_impact = ?
     WHERE id = (SELECT id FROM review_queue WHERE asset_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1)`,
    [fields.possibleClassificationsDetail, fields.suggestedAction, fields.estimatedEffort, fields.potentialImpact, assetId]
  );
}

export function getClassification(db: WorkspaceDatabase, assetId: number): ClassificationRecord | undefined {
  return mapClassification(db.get("SELECT * FROM classifications WHERE asset_id = ?", [assetId]));
}

export function listClassifications(db: WorkspaceDatabase): ClassificationRecord[] {
  return db.all("SELECT * FROM classifications").map((r) => mapClassification(r)!);
}

// ---- review queue ----

export function listOpenReviewQueue(db: WorkspaceDatabase): ReviewQueueEntry[] {
  return db
    .all<Record<string, unknown>>("SELECT * FROM review_queue WHERE status = 'open'")
    .map((r) => ({
      id: r.id as number,
      assetId: r.asset_id as number | null,
      reason: r.reason as string,
      suggestedClassifications: r.suggested_classifications as string | null,
      confidence: r.confidence as number | null,
      status: r.status as "open" | "resolved",
    }));
}

// ---- evidence ----

export function recordEvidenceAssessment(
  db: WorkspaceDatabase,
  scopeType: EvidenceScope,
  scopeId: number | null,
  dimension: EvidenceDimension,
  score: number,
  status: EvidenceStatus,
  notes: string
): void {
  db.run(
    `INSERT INTO evidence_assessments (scope_type, scope_id, dimension, score, status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [scopeType, scopeId, dimension, score, status, notes]
  );
}

export function latestEvidenceAssessments(
  db: WorkspaceDatabase,
  scopeType: EvidenceScope,
  scopeId: number | null
): EvidenceAssessment[] {
  const rows = db.all<Record<string, unknown>>(
    scopeId === null
      ? "SELECT * FROM evidence_assessments WHERE scope_type = ? AND scope_id IS NULL ORDER BY computed_at DESC"
      : "SELECT * FROM evidence_assessments WHERE scope_type = ? AND scope_id = ? ORDER BY computed_at DESC",
    scopeId === null ? [scopeType] : [scopeType, scopeId]
  );
  const seenDimensions = new Set<string>();
  const latest: EvidenceAssessment[] = [];
  for (const r of rows) {
    const dim = r.dimension as string;
    if (seenDimensions.has(dim)) continue;
    seenDimensions.add(dim);
    latest.push({
      id: r.id as number,
      scopeType: r.scope_type as EvidenceScope,
      scopeId: r.scope_id as number | null,
      dimension: r.dimension as EvidenceDimension,
      score: r.score as number,
      status: r.status as EvidenceStatus,
      notes: r.notes as string,
      computedAt: r.computed_at as string,
    });
  }
  return latest;
}

export function recordEvidenceGap(
  db: WorkspaceDatabase,
  scopeType: EvidenceScope,
  scopeId: number | null,
  gapType: string,
  description: string,
  priority = "normal"
): void {
  db.run(
    `INSERT INTO evidence_gaps (scope_type, scope_id, gap_type, description, priority) VALUES (?, ?, ?, ?, ?)`,
    [scopeType, scopeId, gapType, description, priority]
  );
}

export function listEvidenceGaps(db: WorkspaceDatabase, scopeType?: EvidenceScope, scopeId?: number | null): EvidenceGap[] {
  const rows =
    scopeType === undefined
      ? db.all<Record<string, unknown>>("SELECT * FROM evidence_gaps ORDER BY created_at DESC")
      : db.all<Record<string, unknown>>(
          scopeId === null || scopeId === undefined
            ? "SELECT * FROM evidence_gaps WHERE scope_type = ? AND scope_id IS NULL ORDER BY created_at DESC"
            : "SELECT * FROM evidence_gaps WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC",
          scopeId === null || scopeId === undefined ? [scopeType] : [scopeType, scopeId]
        );
  return rows.map((r) => ({
    id: r.id as number,
    scopeType: r.scope_type as EvidenceScope,
    scopeId: r.scope_id as number | null,
    gapType: r.gap_type as string,
    description: r.description as string,
    priority: r.priority as string,
  }));
}

// ---- case templates & cases ----

export function listCaseTemplates(db: WorkspaceDatabase): CaseTemplate[] {
  return db.all<Record<string, unknown>>("SELECT * FROM case_templates").map((r) => ({
    id: r.id as number,
    templateKey: r.template_key as string,
    title: r.title as string,
    description: r.description as string | null,
    defaultCaseType: r.default_case_type as string,
  }));
}

function formatCaseKey(numericId: number): string {
  return `CASE-${String(numericId).padStart(6, "0")}`;
}

function mapCase(row: Record<string, unknown> | undefined): CaseRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    caseKey: row.case_key as string | null,
    title: row.title as string,
    caseType: row.case_type as string,
    purpose: row.purpose as string | null,
    status: row.status as string,
    confidenceNotes: row.confidence_notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createCase(db: WorkspaceDatabase, title: string, caseType: string, purpose: string | null): CaseRecord {
  const { lastInsertRowid } = db.run("INSERT INTO cases (title, case_type, purpose) VALUES (?, ?, ?)", [
    title,
    caseType,
    purpose,
  ]);
  const id = lastInsertRowid as number;
  const caseKey = formatCaseKey(id);
  db.run("UPDATE cases SET case_key = ? WHERE id = ?", [caseKey, id]);
  return mapCase(db.get("SELECT * FROM cases WHERE id = ?", [id]))!;
}

export function getCase(db: WorkspaceDatabase, caseId: number): CaseRecord | undefined {
  return mapCase(db.get("SELECT * FROM cases WHERE id = ?", [caseId]));
}

export function listCases(db: WorkspaceDatabase): CaseRecord[] {
  return db.all("SELECT * FROM cases").map((r) => mapCase(r)!);
}

export function linkToCase(
  db: WorkspaceDatabase,
  caseId: number,
  linkedType: CaseLinkedType,
  linkedId: number,
  relationNote: string | null
): void {
  db.run(
    `INSERT INTO case_links (case_id, linked_type, linked_id, relation_note) VALUES (?, ?, ?, ?)`,
    [caseId, linkedType, linkedId, relationNote]
  );
  db.run("UPDATE cases SET updated_at = datetime('now') WHERE id = ?", [caseId]);
}

export function unlinkFromCase(db: WorkspaceDatabase, caseLinkId: number): void {
  db.run("DELETE FROM case_links WHERE id = ?", [caseLinkId]);
}

export function listCaseLinks(db: WorkspaceDatabase, caseId: number): CaseLinkRecord[] {
  return db.all<Record<string, unknown>>("SELECT * FROM case_links WHERE case_id = ?", [caseId]).map((r) => ({
    id: r.id as number,
    caseId: r.case_id as number,
    linkedType: r.linked_type as CaseLinkedType,
    linkedId: r.linked_id as number,
    relationNote: r.relation_note as string | null,
  }));
}

export function listCasesForAsset(db: WorkspaceDatabase, assetId: number): CaseRecord[] {
  return db
    .all<Record<string, unknown>>(
      `SELECT c.* FROM cases c JOIN case_links cl ON cl.case_id = c.id
       WHERE cl.linked_type = 'asset' AND cl.linked_id = ?`,
      [assetId]
    )
    .map((r) => mapCase(r)!);
}

/** Cases that share at least one linked asset with the given case — pure data retrieval, no judgment about relevance. */
export function listRelatedCases(db: WorkspaceDatabase, caseId: number): CaseRecord[] {
  return db
    .all<Record<string, unknown>>(
      `SELECT DISTINCT c.* FROM cases c
       JOIN case_links cl2 ON cl2.case_id = c.id AND cl2.linked_type = 'asset'
       WHERE c.id != ? AND cl2.linked_id IN (
         SELECT linked_id FROM case_links WHERE case_id = ? AND linked_type = 'asset'
       )`,
      [caseId, caseId]
    )
    .map((r) => mapCase(r)!);
}

export function addCaseMissingEvidence(db: WorkspaceDatabase, caseId: number, description: string, priority = "normal"): void {
  db.run("INSERT INTO case_missing_evidence (case_id, description, priority) VALUES (?, ?, ?)", [
    caseId,
    description,
    priority,
  ]);
}

// ---- asset notes ----

export function addAssetNote(db: WorkspaceDatabase, assetId: number, note: string, author: "system" | "user" = "system"): void {
  db.run("INSERT INTO asset_notes (asset_id, note, author) VALUES (?, ?, ?)", [assetId, note, author]);
}

export function listAssetNotes(db: WorkspaceDatabase, assetId: number): { note: string; author: string; createdAt: string }[] {
  return db
    .all<{ note: string; author: string; created_at: string }>(
      "SELECT note, author, created_at FROM asset_notes WHERE asset_id = ? ORDER BY created_at",
      [assetId]
    )
    .map((r) => ({ note: r.note, author: r.author, createdAt: r.created_at }));
}

// ---- integrity ----

export function recordIntegrityIssue(db: WorkspaceDatabase, issue: IntegrityIssue): void {
  db.run(
    `INSERT INTO integrity_checks (issue_type, severity, scope_type, scope_id, description) VALUES (?, ?, ?, ?, ?)`,
    [issue.issueType, issue.severity, issue.scopeType, issue.scopeId, issue.description]
  );
}

// ---- Phase 3.5: candidate dates, priorities, resolved dates ----

function mapCandidateDate(row: Record<string, unknown>): CandidateDateRecord {
  return {
    id: row.id as number,
    assetId: row.asset_id as number,
    sourceType: row.source_type as DateSourceType,
    dateValue: row.date_value as string,
    rawValue: row.raw_value as string | null,
    extractedFrom: row.extracted_from as string,
    sourceAssetId: row.source_asset_id as number | null,
    isPlausible: !!row.is_plausible,
    implausibilityReason: row.implausibility_reason as string | null,
  };
}

/** Never overwrites — inserts a new row unless an identical one already exists (asset+source+extractedFrom+value). */
export function recordCandidateDate(
  db: WorkspaceDatabase,
  assetId: number,
  input: CandidateDateInput,
  isPlausible: boolean,
  implausibilityReason: string | null
): void {
  db.run(
    `INSERT OR IGNORE INTO candidate_dates
       (asset_id, source_type, date_value, raw_value, extracted_from, source_asset_id, is_plausible, implausibility_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      input.sourceType,
      input.dateValue,
      input.rawValue,
      input.extractedFrom,
      input.sourceAssetId ?? null,
      isPlausible ? 1 : 0,
      implausibilityReason,
    ]
  );
}

export function getCandidateDates(db: WorkspaceDatabase, assetId: number): CandidateDateRecord[] {
  return db
    .all<Record<string, unknown>>("SELECT * FROM candidate_dates WHERE asset_id = ?", [assetId])
    .map(mapCandidateDate);
}

let priorityCache: DateSourcePriority[] | null = null;

export function getDateSourcePriorities(db: WorkspaceDatabase): DateSourcePriority[] {
  if (priorityCache) return priorityCache;
  priorityCache = db
    .all<Record<string, unknown>>("SELECT * FROM date_source_priorities ORDER BY priority_rank ASC")
    .map((r) => ({
      sourceType: r.source_type as DateSourceType,
      priorityRank: r.priority_rank as number,
      reliabilityScore: r.reliability_score as number,
      tierLabel: r.tier_label as string,
      producerStatus: r.producer_status as "active" | "not_yet_implemented",
    }));
  return priorityCache;
}

/** Test-only escape hatch: the priority table is workspace-static in practice, so it's cached per-process for query performance. */
export function _resetPriorityCacheForTests(): void {
  priorityCache = null;
}

function mapResolvedDate(row: Record<string, unknown>): ResolvedDateRecord {
  return {
    id: row.id as number,
    assetId: row.asset_id as number,
    resolvedDate: row.resolved_date as string,
    confidence: row.confidence as number,
    sourceType: row.source_type as DateSourceType,
    sourceCandidateId: row.source_candidate_id as number,
    reasoning: row.reasoning as string,
    rejectedAlternatives: JSON.parse(row.rejected_alternatives_json as string),
    corroboratingCandidateCount: row.corroborating_candidate_count as number,
    resolvedAt: row.resolved_at as string,
  };
}

export function upsertResolvedDate(
  db: WorkspaceDatabase,
  assetId: number,
  resolvedDate: string,
  confidence: number,
  sourceType: DateSourceType,
  sourceCandidateId: number,
  reasoning: string,
  rejectedAlternatives: RejectedAlternative[],
  corroboratingCandidateCount: number
): ResolvedDateRecord {
  db.run("DELETE FROM resolved_dates WHERE asset_id = ?", [assetId]);
  db.run(
    `INSERT INTO resolved_dates
       (asset_id, resolved_date, confidence, source_type, source_candidate_id, reasoning, rejected_alternatives_json, corroborating_candidate_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetId,
      resolvedDate,
      confidence,
      sourceType,
      sourceCandidateId,
      reasoning,
      JSON.stringify(rejectedAlternatives),
      corroboratingCandidateCount,
    ]
  );
  return mapResolvedDate(db.get("SELECT * FROM resolved_dates WHERE asset_id = ?", [assetId])!);
}

export function getResolvedDate(db: WorkspaceDatabase, assetId: number): ResolvedDateRecord | undefined {
  const row = db.get<Record<string, unknown>>("SELECT * FROM resolved_dates WHERE asset_id = ?", [assetId]);
  return row ? mapResolvedDate(row) : undefined;
}

export function listResolvedDates(db: WorkspaceDatabase): ResolvedDateRecord[] {
  return db.all<Record<string, unknown>>("SELECT * FROM resolved_dates").map(mapResolvedDate);
}

// ---- Phase 3.5: data health & knowledge validation ----

export function recordDataHealthFinding(db: WorkspaceDatabase, finding: DataHealthFinding): void {
  db.run(
    `INSERT INTO data_health_findings (finding_type, severity, scope_type, scope_id, description) VALUES (?, ?, ?, ?, ?)`,
    [finding.findingType, finding.severity, finding.scopeType, finding.scopeId, finding.description]
  );
}

export function recordValidationResult(db: WorkspaceDatabase, result: ValidationCheckResult): void {
  db.run(`INSERT INTO knowledge_validation_runs (check_name, passed, details) VALUES (?, ?, ?)`, [
    result.checkName,
    result.passed ? 1 : 0,
    result.details,
  ]);
}
