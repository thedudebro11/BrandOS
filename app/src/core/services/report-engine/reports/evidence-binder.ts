import type { WorkspaceDatabase } from "../../../db/connection";
import type { WorkspaceConfig } from "../../../types";
import { listActiveAssets } from "../../../db/repositories";
import { listCasesForAsset, listEvidenceGaps } from "../../../db/knowledge-repositories";
import { getAssetIntelligence, type AssetIntelligenceView } from "../../asset-intelligence/asset-intelligence";
import { composeCaseDetail } from "../../case-builder/case-detail-composer";
import { findConflictingAssets, traceResolvedDateProvenance } from "../../evidence-provenance-engine/evidence-provenance-engine";
import { assessWorkspaceEvidence } from "../../evidence-engine/evidence-engine";
import { REPORT_SCHEMA_VERSION, type ReportContent, type ReportGenerateOpts } from "../report-types";
import { buildCitationIndex, citeAsset, citeGap, section } from "../report-helpers";

const STRENGTH_LIST_SIZE = 10;

function strengthScore(v: AssetIntelligenceView): number {
  const classificationScore = v.classification?.confidence ?? 0;
  const dateScore = v.resolvedDate?.confidence ?? 0;
  return Math.round((classificationScore + dateScore) / 2);
}

/**
 * Works both workspace-wide (opts.caseId omitted) and case-scoped
 * (opts.caseId set) — the one report type the spec explicitly asks to
 * support both scopes. Case scope reuses composeCaseDetail(); workspace
 * scope reuses getAssetIntelligence() per active asset, same as every other
 * report and Mission Control itself.
 */
export function generateEvidenceBinder(db: WorkspaceDatabase, workspace: WorkspaceConfig, opts: ReportGenerateOpts): ReportContent {
  assessWorkspaceEvidence(db);

  let assets: AssetIntelligenceView[];
  let caseTitle: string | null = null;
  if (opts.caseId !== undefined) {
    const composed = composeCaseDetail(db, opts.caseId);
    if (!composed) throw new Error(`Case ${opts.caseId} not found in workspace "${workspace.id}"`);
    assets = composed.supportingAssets;
    caseTitle = composed.theCase.title;
  } else {
    assets = listActiveAssets(db)
      .map((a) => getAssetIntelligence(db, a.assetId))
      .filter((v): v is AssetIntelligenceView => !!v);
  }

  const ranked = [...assets].sort((a, b) => strengthScore(b) - strengthScore(a));
  const strongest = ranked.slice(0, STRENGTH_LIST_SIZE);
  const weakest = ranked.slice(-STRENGTH_LIST_SIZE).reverse();
  const conflicts = findConflictingAssets(db, assets);
  const gaps = opts.caseId === undefined ? listEvidenceGaps(db, "workspace", null) : listEvidenceGaps(db, "case", opts.caseId);

  const executiveSummary = section(
    "executive-summary",
    "Executive Summary",
    `Evidence Binder for ${opts.caseId !== undefined ? `case "${caseTitle}"` : `workspace "${workspace.name}"`}. ` +
      `${assets.length} asset(s) included. ${conflicts.length} conflict(s) detected. ${gaps.length} evidence gap(s) flagged.`,
    [{ description: `Computed from ${assets.length} asset(s) at generation time.` }]
  );

  const sortedByDate = [...assets].filter((v) => v.resolvedDate).sort((a, b) => a.resolvedDate!.resolvedDate.localeCompare(b.resolvedDate!.resolvedDate));
  const timelineSection = section(
    "timeline",
    "Timeline",
    sortedByDate.length === 0
      ? "No dated evidence available to build a timeline."
      : sortedByDate.map((v) => `- ${v.resolvedDate!.resolvedDate.slice(0, 10)}: ${v.asset.assetId} — ${v.classification?.category ?? "unclassified"}`).join("\n"),
    sortedByDate.map((v) => citeAsset(db, v, "Timeline entry")),
    sortedByDate.length === 0
  );

  const strongestSection = section(
    "strongest-evidence",
    "Strongest Evidence",
    strongest.length === 0
      ? "No assets available."
      : strongest.map((v) => `- ${v.asset.assetId} — strength ${strengthScore(v)}/100 (classification ${v.classification?.confidence ?? "n/a"}, date ${v.resolvedDate?.confidence ?? "n/a"})`).join("\n"),
    strongest.map((v) => citeAsset(db, v, "Ranked among strongest evidence")),
    strongest.length === 0
  );

  const weakestSection = section(
    "weakest-evidence",
    "Weakest Evidence",
    weakest.length === 0
      ? "No assets available."
      : weakest.map((v) => `- ${v.asset.assetId} — strength ${strengthScore(v)}/100`).join("\n"),
    weakest.map((v) => citeAsset(db, v, "Ranked among weakest evidence")),
    weakest.length === 0
  );

  const missingSection = section(
    "missing-evidence",
    "Missing Evidence",
    gaps.length === 0 ? "No evidence gaps flagged." : gaps.map((g) => `- [${g.priority}] ${g.description}`).join("\n"),
    gaps.map((g) => citeGap(db, g)),
    gaps.length === 0
  );

  const conflictsSection = section(
    "conflicts",
    "Conflicts",
    conflicts.length === 0 ? "No conflicting evidence detected." : conflicts.map((v) => `- ${v.asset.assetId}: ${v.resolvedDate?.reasoning ?? ""}`).join("\n"),
    conflicts.map((v) => citeAsset(db, v, "Flagged as conflicting")),
    conflicts.length === 0
  );

  const supportingSection = section(
    "supporting-assets",
    "Supporting Assets",
    assets.map((v) => `- ${v.asset.assetId} (${v.asset.filename})`).join("\n") || "No assets included.",
    assets.map((v) => citeAsset(db, v, "Included in this Evidence Binder")),
    assets.length === 0
  );

  const referencedCaseIds = new Set<number>();
  if (opts.caseId !== undefined) referencedCaseIds.add(opts.caseId);
  else for (const v of assets) for (const c of listCasesForAsset(db, v.asset.id)) referencedCaseIds.add(c.id);
  const caseRefSection = section(
    "case-references",
    "Case References",
    referencedCaseIds.size === 0 ? "No case references." : `Referenced case ID(s): ${[...referencedCaseIds].join(", ")}.`,
    [...referencedCaseIds].map((id) => ({ caseId: id, description: "Referenced by this Evidence Binder's scope." })),
    referencedCaseIds.size === 0
  );

  const custodySample = assets.slice(0, STRENGTH_LIST_SIZE);
  const custodyBody = custodySample
    .map((v) => `**${v.asset.assetId}**:\n` + traceResolvedDateProvenance(db, v.asset.id).map((l) => `  - ${l.layer}: ${l.description}`).join("\n"))
    .join("\n");
  const custodySection = section(
    "chain-of-custody",
    "Chain of Custody",
    custodySample.length === 0 ? "No assets to trace." : `Provenance chains for the first ${custodySample.length} of ${assets.length} asset(s):\n${custodyBody}`,
    custodySample.map((v) => citeAsset(db, v, "Chain-of-custody trace included")),
    custodySample.length === 0
  );

  const hashSection = section(
    "hash-references",
    "Hash References",
    assets.map((v) => `- ${v.asset.assetId}: \`${v.asset.sha256 ?? "(not yet hashed)"}\``).join("\n") || "No assets to hash-reference.",
    assets.map((v) => citeAsset(db, v, "SHA-256 hash reference")),
    assets.length === 0
  );

  const sections = [
    executiveSummary,
    timelineSection,
    strongestSection,
    weakestSection,
    missingSection,
    conflictsSection,
    supportingSection,
    caseRefSection,
    custodySection,
    hashSection,
  ];

  return {
    reportType: "evidence_binder",
    version: REPORT_SCHEMA_VERSION,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    caseId: opts.caseId ?? null,
    caseTitle,
    generatedAt: new Date().toISOString(),
    title: `Evidence Binder — ${opts.caseId !== undefined ? caseTitle : workspace.name}`,
    legalDisclaimer: null,
    sections,
    citationIndex: buildCitationIndex(sections),
  };
}
