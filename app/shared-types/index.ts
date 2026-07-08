/**
 * The single source of truth for every shape that crosses the HTTP boundary
 * between the BrandOS API (app/src/api/) and Mission Control (app/web/).
 *
 * Both sides import from here — nothing is hand-duplicated. This exists
 * specifically because duplication between app/web/src/api.ts and the API's
 * actual response shapes caused two real, confirmed incidents (Phase 4.5's
 * `stringId` build failure, and the near-miss documented in
 * ARCHITECTURE_DECISIONS.md's Phase 4.5 Consistency Review) before this file
 * existed. Phase 5, Section 1.
 *
 * Scope, deliberately bounded: this file holds API request/response DTOs
 * only — the shapes that actually travel over HTTP. It does NOT hold every
 * internal engine type (see app/src/core/types.ts for those); most DTOs here
 * are a subset or reshaping of an engine type for wire transport, not a
 * duplicate of the engine's internal representation.
 */

// ---- workspaces ----

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: string;
  status: string;
}

// ---- overview ----

export interface OverviewData {
  workspace: { id: string; name: string; status: string };
  health: number;
  trademarkReadiness: string;
  priorityOfUse: { score: number; status: string; notes: string } | null;
  evidenceQuality: { label: string; coverage: number };
  needsReview: { count: number; percent: number };
  duplicateGroups: number;
  timelineCompleteness: number;
  relationshipCoverage: number;
  casesCount: number;
  recentActivity: { latestScanAt: string | null; latestValidationAt: string | null };
  architectureHealth: { score: number; phase: string; phaseName: string; asOf: string; note: string };
}

// ---- activity & action center ----

export interface ActivityEvent {
  timestamp: string;
  eventType: string;
  description: string;
  entityType: string;
  entityId: number | string | null;
}

export interface ActionItem {
  id: string;
  label: string;
  severity: "high" | "normal" | "info";
  href: string;
}

// ---- cases ----

export interface CaseSummary {
  id: number;
  caseKey: string | null;
  title: string;
  caseType: string;
  purpose: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  evidenceStrength: { score: number; status: string; notes: string } | null;
  linkCount: number;
}

export interface CaseTemplate {
  id: number;
  templateKey: string;
  title: string;
  description: string | null;
  defaultCaseType: string;
}

export interface CaseDetail {
  case: CaseSummary;
  executiveSummary: { purpose: string | null; linkedAssetCount: number; linkedTimelineEventCount: number };
  evidenceOverview: { score: number; status: string; notes: string } | null;
  timeline: Record<string, unknown>[];
  supportingAssets: AssetIntelligence[];
  relatedCases: CaseSummary[];
  confidence: number | null;
  risks: Record<string, unknown>[];
  missingEvidence: Record<string, unknown>[];
  conflicts: AssetIntelligence[];
  recentChanges: { caseUpdatedAt: string };
  linkedDocumentation: Record<string, unknown>[];
}

export interface CaseEvidenceSuggestion {
  tagName: string;
  count: number;
}

// ---- assets / asset intelligence ----

export interface AssetSummary {
  id: number;
  assetId: string;
  filename: string;
  originalPath: string;
  sha256: string | null;
}

export interface AssetIntelligence {
  asset: AssetSummary;
  metadata: { key: string; value: string; source: string; confidence: number }[];
  classification: { category: string; confidence: number; reason: string; needsReview: number } | undefined;
  tags: { tagName: string; source: string; confidence: number }[];
  relationships: { direction: string; otherAssetId: number; type: string; confidence: number }[];
  timelineEvents: { id: number; eventType: string; eventDate: string; title: string; confidence: number }[];
  provenance: { assetId: number; assetLabel: string; relationshipType: string | null; direction: string }[];
  linkedCases: { id: number; title: string; caseType: string }[];
  notes: { note: string; author: string; createdAt: string }[];
}

export interface AssetFacets {
  classifications: { category: string; c: number }[];
  tags: { name: string; c: number }[];
}

// ---- priority of use ----

export interface PriorityOfUseData {
  assessment: { score: number; status: string; notes: string } | null;
  gaps: { gapType: string; description: string; priority: string }[];
  supportingAssets: AssetIntelligence[];
}

// ---- search ----

export interface SearchResult {
  entityType: "asset" | "case" | "timeline_event" | "tag";
  id: number;
  /** Populated for entityType "asset" only — the stable AST-######## id, since `id` is the internal numeric row id. */
  stringId?: string;
  label: string;
  matchedField: string;
}

// ---- review queue & duplicates ----

export interface ReviewQueueEntry {
  id: number;
  reason: string;
  suggestedClassifications: string | null;
  confidence: number | null;
  suggested_action: string | null;
  estimated_effort: string | null;
  potential_impact: string | null;
  possible_classifications_detail: string | null;
  asset: { asset_id: string; filename: string; original_path: string } | null;
}

export interface DuplicateGroup {
  groupId: number;
  sha256: string;
  assets: ({ asset_id: string; filename: string; original_path: string } | undefined)[];
}
