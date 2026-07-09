/**
 * The report data model — one shape every report type produces, every
 * renderer consumes, and every validation check inspects. This is the
 * "single data model, multiple renderers" design: report-content generators
 * (reports/*.ts) build a ReportData by composing existing engines; renderers
 * (renderers/*.ts) are pure ReportData -> string functions with zero DB
 * access. Nothing about a specific output format leaks into ReportData
 * itself, and nothing about report content lives in a renderer.
 */
import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceConfig } from "../../types";

export type ReportType =
  | "trademark_readiness"
  | "priority_of_use_dossier"
  | "evidence_binder"
  | "brand_history"
  | "case_summary"
  | "missing_evidence"
  | "needs_review"
  | "duplicate_assets"
  | "workspace_health";

export const REPORT_SCHEMA_VERSION = "1.0.0";

/**
 * Every factual claim in a report should be backed by one of these. At least
 * one of assetId/timelineEventId/caseId should normally be set — a Citation
 * with none of them is only valid for a whole-report meta-claim (e.g. "this
 * report was generated from N total assets"), which report-validation.ts
 * checks for separately.
 */
export interface Citation {
  assetId?: string;
  timelineEventId?: number;
  caseId?: number;
  description: string;
  confidence?: number;
  sourceType?: string;
  /** Populated when this asset has a generated Obsidian note (Phase 6) — a real, checked cross-reference, never assumed. */
  obsidianNotePath?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  /** Markdown-flavored prose, assembled from templated sentences over real data — never free-form generated text. */
  body: string;
  citations: Citation[];
  /** True only for structural sections (title/legal notice) that legitimately have no factual claim to cite. Checked by report-validation.ts. */
  allowEmptyCitations?: boolean;
}

export interface ReportData {
  reportType: ReportType;
  version: string;
  workspaceId: string;
  workspaceName: string;
  /** Set only for case-scoped reports (Case Summary; Evidence Binder when generated for one case). */
  caseId: number | null;
  caseTitle: string | null;
  generatedAt: string;
  title: string;
  /** Set only for the Trademark Readiness Report — see REPORT_LEGAL_DISCLAIMER. */
  legalDisclaimer: string | null;
  sections: ReportSection[];
  /** Deduped, flattened citations across every section — the report's own appendix/bibliography. */
  citationIndex: Citation[];
  /** ADR-007. "safe" (the default — see ReportGenerateOpts): no raw filename/path appears in any section body or citation description, only Asset IDs and, in one clearly-marked internal index section, an Exhibit-label mapping. "full": unredacted, for internal-only use, requires explicit opt-in. */
  citationMode: "safe" | "full";
}

export interface ReportGenerateOpts {
  caseId?: number;
  /** ADR-007 Safe Citation Mode. Defaults to "safe" — a caller must explicitly pass "full" to see raw filenames/paths in report output. */
  citationMode?: "safe" | "full";
}

/** What an individual report generator produces — everything except `citationMode`, which report-generator.ts sets/applies afterward so no report-content file needs to know ADR-007 exists. */
export type ReportContent = Omit<ReportData, "citationMode">;

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  /** "workspace" reports never take a caseId; "case" reports require one; "either" (Evidence Binder) works both ways. */
  scope: "workspace" | "case" | "either";
  generate: (db: WorkspaceDatabase, workspaceConfig: WorkspaceConfig, opts: ReportGenerateOpts) => ReportContent;
}

export const REPORT_LEGAL_DISCLAIMER =
  "BrandOS is not providing legal advice. This report summarizes evidence discovered in the workspace's " +
  "evidence tree and scores computed by BrandOS's own rule-based engines; it is not a legal opinion, does not " +
  "constitute trademark counsel, and must be reviewed by a licensed attorney before being relied upon for " +
  "filing, litigation, or any other legal purpose.";
