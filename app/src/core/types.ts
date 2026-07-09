// Shared types for the BrandOS core engine.
// No workspace, brand, or plugin name may appear as a literal here — see app/specs/01_ARCHITECTURE.md.

export type WorkspaceType = "brand" | "personal_vault" | string;
export type WorkspaceStatus = "planned" | "active" | "archived" | string;

export interface WorkspaceModules {
  assetManagement?: boolean;
  trademark?: boolean;
  copyright?: boolean;
  obsidian?: boolean;
  instagram?: boolean;
  printful?: boolean;
  caseBuilder?: boolean;
  priorityOfUseDossier?: boolean;
  trademarkReadinessReport?: boolean;
  [module: string]: boolean | undefined;
}

export interface WorkspacePaths {
  obsidianVault?: string;
  exports?: string;
  reviewQueue?: string;
}

export interface WorkspaceImportantMarks {
  primaryMark?: string | null;
  relatedOrConflictingMarks?: string[];
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  created?: string;
  primaryUseCase?: string;
  modules: WorkspaceModules;
  paths?: WorkspacePaths;
  importantMarks?: WorkspaceImportantMarks;
  evidenceTypes?: string[];
  caseTypes?: string[];
}

export interface LoadedWorkspace {
  config: WorkspaceConfig;
  /** Absolute path to the workspace folder, e.g. workspaces/Fatletic */
  rootDir: string;
  /** Absolute path to workspace.json */
  configPath: string;
}

export type DateSource =
  | "file_created"
  | "file_modified"
  | "imported"
  | "content_date"
  | "manual";

export interface DiscoveredFile {
  absPath: string;
  relPath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  createdAt: string | null;
  modifiedAt: string | null;
  accessedAt: string | null;
  isHidden: boolean;
  isBrokenShortcut: boolean;
}

export type AssetStatus = "active" | "missing";

export interface AssetRecord {
  id: number;
  assetId: string;
  originalPath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  createdAt: string | null;
  modifiedAt: string | null;
  accessedAt: string | null;
  isHidden: number;
  isBrokenShortcut: number;
  status: AssetStatus;
  sha256: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MetadataRecord {
  key: string;
  value: string;
  source: "extracted" | "inferred";
  confidence: number;
}

export type RelationshipType = "source_to_export" | string;

export interface RelationshipRecord {
  fromAssetId: number;
  toAssetId: number;
  relationshipType: RelationshipType;
  confidence: number;
  evidenceNote: string;
  detectedMethod: "automatic" | "manual";
}

export interface TimelineEventInput {
  assetId: number | null;
  eventType: string;
  eventDate: string;
  dateSource: DateSource;
  title: string;
  description?: string;
  confidence: number;
  verifiedStatus: "verified" | "inferred";
}

export type ScanRunStatus = "running" | "completed" | "failed";
export type ScanTrigger = "manual" | "watch" | "incremental";

export interface ScanRunSummary {
  runKey: string;
  startedAt: string;
  finishedAt: string | null;
  status: ScanRunStatus;
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  filesErrored: number;
  assetsCreated: number;
  assetsUpdated: number;
  assetsMissing: number;
  duplicateGroupsFound: number;
  trigger: ScanTrigger;
}

// ---------------------------------------------------------------------------
// Phase 3: Knowledge Layer types
// ---------------------------------------------------------------------------

export interface ClassificationRecord {
  id: number;
  assetId: number;
  category: string;
  confidence: number;
  method: "rule_based" | "ai_assisted";
  ruleId: string;
  reason: string;
  needsReview: number;
  createdAt: string;
}

export interface TagRecord {
  id: number;
  name: string;
}

export interface AssetTagRecord {
  assetId: number;
  tagId: number;
  tagName: string;
  source: "automatic" | "manual";
  confidence: number;
  reason: string | null;
}

export type EvidenceScope = "asset" | "case" | "workspace";
export type EvidenceDimension =
  | "strength"
  | "completeness"
  | "confidence"
  | "continuous_use"
  | "priority_of_use";
export type EvidenceStatus = "strong" | "weak" | "conflicting" | "missing";

export interface EvidenceAssessment {
  id: number;
  scopeType: EvidenceScope;
  scopeId: number | null;
  dimension: EvidenceDimension;
  score: number;
  status: EvidenceStatus;
  notes: string;
  computedAt: string;
}

export interface EvidenceGap {
  id: number;
  scopeType: EvidenceScope;
  scopeId: number | null;
  gapType: string;
  description: string;
  priority: string;
}

export interface CaseTemplate {
  id: number;
  templateKey: string;
  title: string;
  description: string | null;
  defaultCaseType: string;
}

export interface CaseRecord {
  id: number;
  caseKey: string | null;
  title: string;
  caseType: string;
  purpose: string | null;
  status: string;
  confidenceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CaseLinkedType = "asset" | "timeline_event" | "report" | "note";

export interface CaseLinkRecord {
  id: number;
  caseId: number;
  linkedType: CaseLinkedType;
  linkedId: number;
  relationNote: string | null;
}

export interface ReviewQueueEntry {
  id: number;
  assetId: number | null;
  reason: string;
  suggestedClassifications: string | null;
  confidence: number | null;
  status: "open" | "resolved";
}

export type IntegrityIssueType =
  | "broken_reference"
  | "hash_mismatch"
  | "missing_asset"
  | "duplicate_asset"
  | "circular_relationship"
  | "orphaned_asset"
  | "workspace_inconsistency";

export interface IntegrityIssue {
  issueType: IntegrityIssueType;
  severity: "info" | "warning" | "critical";
  scopeType: string | null;
  scopeId: number | null;
  description: string;
}

export type GraphNodeType = "workspace" | "asset" | "case" | "evidence" | "timeline_event" | "tag" | "report" | "obsidian_note" | "plugin";

export interface GraphNode {
  type: GraphNodeType;
  id: number;
  label: string;
  /** A short, real, already-computed fact for at-a-glance display without a follow-up fetch — e.g. an asset's classification category, a case's status, a report's type. Never invented; omitted when nothing suitable exists. */
  subtitle?: string;
}

export interface GraphEdge {
  fromType: GraphNodeType;
  fromId: number;
  toType: GraphNodeType;
  toId: number;
  edgeType: string;
  confidence: number | null;
}

export interface ProvenanceStep {
  assetId: number;
  assetLabel: string;
  relationshipType: string | null; // null for the starting asset itself
  confidence: number | null;
  direction: "upstream" | "downstream" | "self";
}

export type LogLevel = "info" | "warn" | "error";

// ---------------------------------------------------------------------------
// Phase 3.5: Evidence Reliability & Knowledge Validation types
// ---------------------------------------------------------------------------

export type DateSourceType =
  | "printful_order"
  | "printful_shipment"
  | "shopify_order"
  | "stripe_payment"
  | "instagram_publish"
  | "pdf_metadata"
  | "psd_metadata"
  | "xcf_metadata"
  | "svg_metadata"
  | "ai_metadata"
  | "embedded_document_metadata"
  | "exif"
  | "image_metadata"
  | "video_metadata"
  | "git_commit"
  | "filesystem_modified"
  | "filesystem_created"
  | "filename_pattern"
  | "folder_pattern"
  | "relationship_derived"
  | "user_confirmed";

export interface CandidateDateInput {
  sourceType: DateSourceType;
  dateValue: string;
  rawValue: string | null;
  extractedFrom: string;
  sourceAssetId?: number | null;
}

export interface CandidateDateRecord extends CandidateDateInput {
  id: number;
  assetId: number;
  isPlausible: boolean;
  implausibilityReason: string | null;
}

export interface DateSourcePriority {
  sourceType: DateSourceType;
  priorityRank: number;
  reliabilityScore: number;
  tierLabel: string;
  producerStatus: "active" | "not_yet_implemented";
}

export interface RejectedAlternative {
  sourceType: DateSourceType;
  dateValue: string;
  reasonRejected: string;
}

export interface ResolvedDateRecord {
  id: number;
  assetId: number;
  resolvedDate: string;
  confidence: number;
  sourceType: DateSourceType;
  sourceCandidateId: number;
  reasoning: string;
  rejectedAlternatives: RejectedAlternative[];
  corroboratingCandidateCount: number;
  resolvedAt: string;
}

export interface DataHealthFinding {
  findingType: string;
  severity: "info" | "warning" | "critical";
  scopeType: string | null;
  scopeId: number | null;
  description: string;
}

export interface ValidationCheckResult {
  checkName: string;
  passed: boolean;
  details: string;
}

export interface EvidenceQualityMetricsResult {
  timelineCompleteness: number;
  metadataCompleteness: number;
  relationshipCompleteness: number;
  classificationCompleteness: number;
  confidenceDistribution: { band: string; count: number }[];
  needsReviewPercent: number;
  duplicateCoverage: number;
  evidenceCoverage: number;
  provenanceCoverage: number;
  healthScore: number;
  missingEvidenceScore: number;
  conflictingEvidenceScore: number;
}

// ---------------------------------------------------------------------------
// Phase 6: Obsidian vault generation types
// ---------------------------------------------------------------------------

export type ObsidianEntityType = "asset" | "case" | "workspace" | "index";

export interface ObsidianNoteRecord {
  id: number;
  entityType: ObsidianEntityType;
  entityId: string;
  vaultPath: string;
  contentHash: string;
  lastGeneratedAt: string;
  hasManualEdits: boolean;
}

export type NoteWriteOutcome = "created" | "updated" | "skipped_unchanged" | "skipped_manual_edit";

export interface NoteWriteResult {
  vaultPath: string;
  outcome: NoteWriteOutcome;
}

export interface KnowledgeReviewFinding {
  findingType: "broken_link" | "orphaned_note" | "missing_note" | "missing_backlink" | "stale_content" | "unresolved_reference";
  severity: "info" | "warning" | "critical";
  vaultPath: string | null;
  description: string;
}
