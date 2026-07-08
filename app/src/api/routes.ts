import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { getDb, getLoadedWorkspace, WORKSPACES_ROOT } from "./db-cache";
import { discoverWorkspaces } from "../core/workspace/workspace-registry";
import { computeEvidenceQualityMetrics, bandLabel } from "../core/services/evidence-quality-metrics/evidence-quality-metrics";
import {
  latestEvidenceAssessments,
  listEvidenceGaps,
  listCaseTemplates,
  listCases,
  getCase,
  listCaseLinks,
  listRelatedCases,
  listOpenReviewQueue,
} from "../core/db/knowledge-repositories";
import { CaseBuilderService } from "../core/services/case-builder/case-builder-service";
import { getAssetIntelligence } from "../core/services/asset-intelligence/asset-intelligence";
import { QueryEngine } from "../core/services/query-engine/query-engine";
import { search } from "../core/services/search-engine/search-engine";
import { findAssetByAssetId } from "../core/db/repositories";
import { getActivityFeed } from "../core/services/activity-feed-engine/activity-feed-engine";
import type {
  ActionItem,
  ActivityEvent,
  AssetFacets,
  AssetSummary,
  CaseDetail,
  CaseEvidenceSuggestion,
  CaseSummary,
  DuplicateGroup,
  OverviewData,
  PriorityOfUseData,
  ReviewQueueEntry,
  SearchResult,
  WorkspaceSummary,
} from "../../shared-types";

const router = Router();

const ARCHITECTURE_HEALTH_PATH = path.resolve(__dirname, "../../docs/architecture-health.json");

// ---- workspaces ----

router.get("/workspaces", (_req, res) => {
  const { workspaces, skipped } = discoverWorkspaces(WORKSPACES_ROOT);
  const summaries: WorkspaceSummary[] = workspaces.map((w) => ({
    id: w.config.id,
    name: w.config.name,
    type: w.config.type,
    status: w.config.status,
  }));
  res.json({ workspaces: summaries, skipped });
});

// ---- overview ----

router.get("/workspaces/:id/overview", async (req, res) => {
  const db = await getDb(req.params.id);
  const workspace = getLoadedWorkspace(req.params.id)!;
  const metrics = computeEvidenceQualityMetrics(db);

  const priorityOfUse = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "priority_of_use");
  const casesCount = listCases(db).length;
  const openReview = db.get<{ c: number }>("SELECT COUNT(*) as c FROM review_queue WHERE status = 'open'")?.c ?? 0;
  const duplicateGroups = db.get<{ c: number }>("SELECT COUNT(*) as c FROM duplicate_groups")?.c ?? 0;
  const latestScan = db.get<{ started_at: string }>("SELECT started_at FROM scan_runs ORDER BY started_at DESC LIMIT 1");
  const latestValidation = db.get<{ run_at: string }>(
    "SELECT run_at FROM knowledge_validation_runs ORDER BY run_at DESC LIMIT 1"
  );
  const architectureHealth = JSON.parse(fs.readFileSync(ARCHITECTURE_HEALTH_PATH, "utf-8"));

  const response: OverviewData = {
    workspace: { id: workspace.config.id, name: workspace.config.name, status: workspace.config.status },
    health: metrics.healthScore,
    trademarkReadiness: "pending", // no report-trademark-readiness plugin exists yet (Phase 5+) — honest placeholder, not invented
    priorityOfUse: priorityOfUse
      ? { score: priorityOfUse.score, status: priorityOfUse.status, notes: priorityOfUse.notes }
      : null,
    evidenceQuality: { label: bandLabel(metrics.evidenceCoverage), coverage: metrics.evidenceCoverage },
    needsReview: { count: openReview, percent: metrics.needsReviewPercent },
    duplicateGroups,
    timelineCompleteness: metrics.timelineCompleteness,
    relationshipCoverage: metrics.relationshipCompleteness,
    casesCount,
    recentActivity: { latestScanAt: latestScan?.started_at ?? null, latestValidationAt: latestValidation?.run_at ?? null },
    architectureHealth,
  };
  res.json(response);
});

// ---- activity ----

router.get("/workspaces/:id/activity", async (req, res) => {
  const db = await getDb(req.params.id);
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const events: ActivityEvent[] = getActivityFeed(db, limit);
  res.json({ events });
});

// ---- action center ----
// Pure composition of existing engine calls — every count here is already
// computed elsewhere (Query Engine, Evidence Engine, Data Health). This
// endpoint only assembles them into a "what needs attention" list; it adds
// no new calculation.

router.get("/workspaces/:id/action-center", async (req, res) => {
  const db = await getDb(req.params.id);
  const query = new QueryEngine(db);
  const openReview = db.get<{ c: number }>("SELECT COUNT(*) as c FROM review_queue WHERE status = 'open'")?.c ?? 0;
  const duplicateGroups = query.duplicateGroups().length;
  const orphaned = query.orphanedAssets().length;
  const missingMetadata = query.assetsMissingMetadata().length;
  const gaps = listEvidenceGaps(db, "workspace", null);
  const priorityOfUse = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "priority_of_use");

  const items: ActionItem[] = [
    openReview > 0 && {
      id: "needs-review",
      label: `${openReview} asset${openReview === 1 ? "" : "s"} need review`,
      severity: "normal" as const,
      href: "review-queue",
    },
    duplicateGroups > 0 && {
      id: "duplicates",
      label: `${duplicateGroups} duplicate group${duplicateGroups === 1 ? "" : "s"}`,
      severity: "info" as const,
      href: "duplicates",
    },
    missingMetadata > 0 && {
      id: "missing-metadata",
      label: `${missingMetadata} asset${missingMetadata === 1 ? "" : "s"} missing metadata`,
      severity: "info" as const,
      href: "assets?filter=missing-metadata",
    },
    orphaned > 0 && {
      id: "orphaned",
      label: `${orphaned} orphaned asset${orphaned === 1 ? "" : "s"} (no relationships, cases, or tags)`,
      severity: "info" as const,
      href: "assets?filter=orphaned",
    },
    priorityOfUse &&
      priorityOfUse.status === "weak" && {
        id: "weak-priority-of-use",
        label: `Priority of Use is weak (${priorityOfUse.score}/100)`,
        severity: "high" as const,
        href: "priority-of-use",
      },
    ...gaps
      .filter((g) => g.gapType !== "open_review_queue") // already surfaced by the dedicated "needs-review" item above
      .map(
        (g, i): ActionItem => ({
          id: `gap-${i}`,
          label: g.description,
          severity: g.priority === "high" ? "high" : "normal",
          href: "priority-of-use",
        })
      ),
  ].filter((x): x is ActionItem => !!x);

  res.json({ items });
});

// ---- review queue ----

router.get("/workspaces/:id/review-queue", async (req, res) => {
  const db = await getDb(req.params.id);
  const entries = listOpenReviewQueue(db);
  const enriched: ReviewQueueEntry[] = entries.map((e) => {
    const raw = db.get<{
      suggested_action: string | null;
      estimated_effort: string | null;
      potential_impact: string | null;
      possible_classifications_detail: string | null;
    }>(
      "SELECT suggested_action, estimated_effort, potential_impact, possible_classifications_detail FROM review_queue WHERE id = ?",
      [e.id]
    );
    const asset = e.assetId
      ? db.get<{ asset_id: string; filename: string; original_path: string }>(
          "SELECT asset_id, filename, original_path FROM assets WHERE id = ?",
          [e.assetId]
        )
      : null;
    return {
      id: e.id,
      reason: e.reason,
      suggestedClassifications: e.suggestedClassifications,
      confidence: e.confidence,
      suggested_action: raw?.suggested_action ?? null,
      estimated_effort: raw?.estimated_effort ?? null,
      potential_impact: raw?.potential_impact ?? null,
      possible_classifications_detail: raw?.possible_classifications_detail ?? null,
      asset: asset ?? null,
    };
  });
  res.json({ entries: enriched });
});

// ---- duplicates ----

router.get("/workspaces/:id/duplicates", async (req, res) => {
  const db = await getDb(req.params.id);
  const query = new QueryEngine(db);
  const groups: DuplicateGroup[] = query.duplicateGroups().map((g) => ({
    groupId: g.groupId,
    sha256: g.sha256,
    assets: g.assetIds.map((id) =>
      db.get<{ asset_id: string; filename: string; original_path: string }>(
        "SELECT asset_id, filename, original_path FROM assets WHERE id = ?",
        [id]
      )
    ),
  }));
  res.json({ groups });
});

// ---- cases ----

router.get("/workspaces/:id/cases", async (req, res) => {
  const db = await getDb(req.params.id);
  const cases: CaseSummary[] = listCases(db).map((c) => {
    const strength = latestEvidenceAssessments(db, "case", c.id).find((a) => a.dimension === "strength");
    const linkCount = listCaseLinks(db, c.id).length;
    return { ...c, evidenceStrength: strength ?? null, linkCount };
  });
  res.json({ cases, templates: listCaseTemplates(db) });
});

router.post("/workspaces/:id/cases", async (req, res) => {
  const db = await getDb(req.params.id);
  const { templateKey, title } = req.body as { templateKey: string; title?: string };
  try {
    const service = new CaseBuilderService(db);
    const created = service.createFromTemplate(templateKey, title);
    db.save();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/workspaces/:id/cases/:caseId", async (req, res) => {
  const db = await getDb(req.params.id);
  const caseId = Number(req.params.caseId);
  const theCase = getCase(db, caseId);
  if (!theCase) return res.status(404).json({ error: "Case not found" });

  const service = new CaseBuilderService(db);
  service.recomputeEvidenceStrength(caseId);
  db.save();

  const links = listCaseLinks(db, caseId);
  const assetLinks = links.filter((l) => l.linkedType === "asset");
  const timelineLinks = links.filter((l) => l.linkedType === "timeline_event");

  const supportingAssets = assetLinks
    .map((l) => {
      const asset = db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [l.linkedId]);
      return asset ? getAssetIntelligence(db, asset.asset_id) : null;
    })
    .filter((a): a is NonNullable<typeof a> => !!a);

  const timeline = timelineLinks
    .map((l) => db.get("SELECT * FROM timeline_events WHERE id = ?", [l.linkedId]))
    .filter(Boolean) as Record<string, unknown>[];

  const conflicts = supportingAssets.filter((a) =>
    db.get("SELECT 1 as x FROM resolved_dates WHERE asset_id = ? AND reasoning LIKE '%conflict%'", [a.asset.id])
  );

  const missingEvidence = db.all("SELECT * FROM case_missing_evidence WHERE case_id = ?", [caseId]) as Record<string, unknown>[];
  const evidenceStrength = latestEvidenceAssessments(db, "case", caseId).find((a) => a.dimension === "strength");
  const relatedCasesRaw = listRelatedCases(db, caseId);
  const relatedCases: CaseSummary[] = relatedCasesRaw.map((c) => ({ ...c, evidenceStrength: null, linkCount: 0 }));

  const response: CaseDetail = {
    case: { ...theCase, evidenceStrength: evidenceStrength ?? null, linkCount: links.length },
    executiveSummary: {
      purpose: theCase.purpose,
      linkedAssetCount: assetLinks.length,
      linkedTimelineEventCount: timelineLinks.length,
    },
    evidenceOverview: evidenceStrength ?? null,
    timeline,
    supportingAssets,
    relatedCases,
    confidence: evidenceStrength?.score ?? null,
    risks: missingEvidence.filter((m: any) => m.priority === "high"),
    missingEvidence,
    conflicts,
    recentChanges: { caseUpdatedAt: theCase.updatedAt },
    linkedDocumentation: links.filter((l) => l.linkedType === "note" || l.linkedType === "report") as unknown as Record<
      string,
      unknown
    >[],
  };
  res.json(response);
});

router.get("/workspaces/:id/cases/:caseId/suggestions", async (req, res) => {
  const db = await getDb(req.params.id);
  const service = new CaseBuilderService(db);
  const suggestions: CaseEvidenceSuggestion[] = service.suggestUnlinkedEvidence(Number(req.params.caseId));
  res.json({ suggestions });
});

router.post("/workspaces/:id/cases/:caseId/links", async (req, res) => {
  const db = await getDb(req.params.id);
  const caseId = Number(req.params.caseId);
  const { linkedType, linkedId, note } = req.body as { linkedType: "asset" | "timeline_event"; linkedId: number; note?: string };
  try {
    const service = new CaseBuilderService(db);
    if (linkedType === "asset") service.linkAsset(caseId, linkedId, note);
    else service.linkTimelineEvent(caseId, linkedId, note);
    db.save();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ---- priority of use ----

router.get("/workspaces/:id/priority-of-use", async (req, res) => {
  const db = await getDb(req.params.id);
  const assessment = latestEvidenceAssessments(db, "workspace", null).find((a) => a.dimension === "priority_of_use");
  const gaps = listEvidenceGaps(db, "workspace", null).filter((g) => g.gapType === "priority_of_use_category_missing");
  const query = new QueryEngine(db);
  const supportingAssets = query
    .assetsSupportingDimension("priority_of_use")
    .map((a) => getAssetIntelligence(db, a.assetId))
    .filter((a): a is NonNullable<typeof a> => !!a);

  const response: PriorityOfUseData = {
    assessment: assessment ? { score: assessment.score, status: assessment.status, notes: assessment.notes } : null,
    gaps: gaps.map((g) => ({ gapType: g.gapType, description: g.description, priority: g.priority })),
    supportingAssets,
  };
  res.json(response);
});

// ---- assets ----

router.get("/workspaces/:id/assets/:assetId", async (req, res) => {
  const db = await getDb(req.params.id);
  const view = getAssetIntelligence(db, req.params.assetId);
  if (!view) return res.status(404).json({ error: "Asset not found" });
  res.json(view);
});

router.get("/workspaces/:id/assets", async (req, res) => {
  const db = await getDb(req.params.id);
  const query = new QueryEngine(db);
  const assets: AssetSummary[] = query.listAssetsFiltered({
    classification: req.query.classification as string | undefined,
    tag: req.query.tag as string | undefined,
    extension: req.query.extension as string | undefined,
    needsReview: req.query.needsReview === "true",
    sortBy: req.query.sortBy as "filename" | "date" | "confidence" | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  const facets: AssetFacets = {
    classifications: db.all<{ category: string; c: number }>(
      "SELECT category, COUNT(*) as c FROM classifications GROUP BY category ORDER BY c DESC"
    ),
    tags: db.all<{ name: string; c: number }>(
      "SELECT t.name, COUNT(*) as c FROM asset_tags at JOIN tags t ON t.id = at.tag_id GROUP BY t.name ORDER BY c DESC"
    ),
  };
  res.json({ assets, facets });
});

// ---- search ----

router.get("/workspaces/:id/search", async (req, res) => {
  const db = await getDb(req.params.id);
  const term = (req.query.q as string) ?? "";
  if (!term.trim()) return res.json({ results: [] as SearchResult[] });
  const results: SearchResult[] = search(db, term);
  res.json({ results });
});

router.get("/asset-by-string-id/:workspaceId/:assetId", async (req, res) => {
  const db = await getDb(req.params.workspaceId);
  const asset = findAssetByAssetId(db, req.params.assetId);
  res.json({ asset: asset ?? null });
});

export default router;
