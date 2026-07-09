import fs from "node:fs";
import path from "node:path";
import type { WorkspaceDatabase } from "../../db/connection";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import type { GraphNodeType, ProvenanceStep } from "../../types";
import { getAssetIntelligence } from "../asset-intelligence/asset-intelligence";
import { composeCaseDetail } from "../case-builder/case-detail-composer";
import { obsidianNotePathFor } from "../report-engine/report-helpers";
import { WORKSPACE_NODE_ID } from "./graph-engine";

export interface NodeDetail {
  type: GraphNodeType;
  id: number;
  label: string;
  summary: string;
  assetId?: string;
  metadata?: { key: string; value: string; source: string; confidence: number }[];
  timeline?: { id: number; eventType: string; eventDate: string; title: string; confidence: number }[];
  relationships?: { direction: string; otherAssetId: number; type: string; confidence: number }[];
  evidence?: { dimension: string; score: number; status: string; notes: string }[];
  confidence?: number | null;
  provenance?: ProvenanceStep[];
  supportingAssets?: { assetId: string; filename: string }[];
  cases?: { id: number; title: string }[];
  reports?: { id: number; reportType: string }[];
  obsidianNotePath?: string;
}

/**
 * Phase 9 Section 5: what selecting any node reveals. Every field is a
 * direct composition of an existing engine's already-computed output — this
 * function contains formatting and dispatch-by-type only, no scoring, no
 * inference, nothing that isn't already sitting in a table somewhere.
 */
export function getNodeDetail(db: WorkspaceDatabase, wfs: WorkspaceFs, type: GraphNodeType, id: number): NodeDetail | undefined {
  switch (type) {
    case "asset":
      return assetDetail(db, id);
    case "case":
      return caseDetail(db, id);
    case "evidence":
      return evidenceDetail(db, id);
    case "timeline_event":
      return timelineEventDetail(db, id);
    case "tag":
      return tagDetail(db, id);
    case "report":
      return reportDetail(db, wfs, id);
    case "obsidian_note":
      return obsidianNoteDetail(db, id);
    case "plugin":
      return pluginDetail(db, id);
    case "workspace":
      return workspaceDetail(db, id);
    default:
      return undefined;
  }
}

function assetDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ asset_id: string }>("SELECT asset_id FROM assets WHERE id = ?", [id]);
  if (!row) return undefined;
  const view = getAssetIntelligence(db, row.asset_id);
  if (!view) return undefined;

  return {
    type: "asset",
    id,
    label: view.asset.filename,
    summary: view.classification
      ? `Classified as ${view.classification.category} (confidence ${view.classification.confidence}/100). ${view.classification.reason}`
      : "Not yet classified.",
    assetId: view.asset.assetId,
    metadata: view.metadata,
    timeline: view.timelineEvents,
    relationships: view.relationships,
    confidence: view.resolvedDate?.confidence ?? null,
    provenance: view.provenance,
    cases: view.linkedCases.map((c) => ({ id: c.id, title: c.title })),
    obsidianNotePath: obsidianNotePathFor(db, view.asset.assetId),
  };
}

function caseDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const composed = composeCaseDetail(db, id);
  if (!composed) return undefined;
  const reports = db.all<{ id: number; report_type: string }>("SELECT id, report_type FROM reports WHERE scope_type = 'case' AND scope_id = ?", [id]);

  return {
    type: "case",
    id,
    label: composed.theCase.title,
    summary: composed.theCase.purpose ?? "No purpose recorded.",
    evidence: composed.evidenceStrength ? [composed.evidenceStrength] : [],
    confidence: composed.evidenceStrength?.score ?? null,
    supportingAssets: composed.supportingAssets.map((v) => ({ assetId: v.asset.assetId, filename: v.asset.filename })),
    reports: reports.map((r) => ({ id: r.id, reportType: r.report_type })),
  };
}

function evidenceDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ scope_type: string; scope_id: number | null; dimension: string; score: number; status: string; notes: string }>(
    "SELECT scope_type, scope_id, dimension, score, status, notes FROM evidence_assessments WHERE id = ?",
    [id]
  );
  if (!row) return undefined;
  return {
    type: "evidence",
    id,
    label: `${row.dimension} (${row.score}/100)`,
    summary: row.notes,
    evidence: [row],
    confidence: row.score,
  };
}

function timelineEventDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ id: number; event_type: string; event_date: string; title: string; description: string | null; confidence: number; asset_id: number | null }>(
    "SELECT id, event_type, event_date, title, description, confidence, asset_id FROM timeline_events WHERE id = ?",
    [id]
  );
  if (!row) return undefined;
  const asset = row.asset_id !== null ? db.get<{ asset_id: string; filename: string }>("SELECT asset_id, filename FROM assets WHERE id = ?", [row.asset_id]) : undefined;
  return {
    type: "timeline_event",
    id,
    label: row.title,
    summary: row.description ?? `${row.event_type} on ${row.event_date?.slice(0, 10)}`,
    confidence: row.confidence,
    timeline: [{ id: row.id, eventType: row.event_type, eventDate: row.event_date, title: row.title, confidence: row.confidence }],
    supportingAssets: asset ? [{ assetId: asset.asset_id, filename: asset.filename }] : [],
  };
}

function tagDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ id: number; name: string }>("SELECT id, name FROM tags WHERE id = ?", [id]);
  if (!row) return undefined;
  const assets = db.all<{ asset_id: string; filename: string }>(
    "SELECT a.asset_id, a.filename FROM asset_tags at JOIN assets a ON a.id = at.asset_id WHERE at.tag_id = ?",
    [id]
  );
  return {
    type: "tag",
    id,
    label: row.name,
    summary: `${assets.length} asset(s) tagged "${row.name}".`,
    supportingAssets: assets.map((a) => ({ assetId: a.asset_id, filename: a.filename })),
  };
}

function reportDetail(db: WorkspaceDatabase, wfs: WorkspaceFs, id: number): NodeDetail | undefined {
  const row = db.get<{ id: number; report_type: string; scope_type: string; scope_id: number | null; version: string; generated_at: string; json_path: string | null }>(
    "SELECT id, report_type, scope_type, scope_id, version, generated_at, json_path FROM reports WHERE id = ?",
    [id]
  );
  if (!row) return undefined;

  let citationCount: number | undefined;
  if (row.json_path) {
    const abs = path.join(wfs.exportsDir, row.json_path);
    if (fs.existsSync(abs)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(abs, "utf-8"));
        citationCount = Array.isArray(parsed.citationIndex) ? parsed.citationIndex.length : undefined;
      } catch {
        citationCount = undefined;
      }
    }
  }

  const cases =
    row.scope_type === "case" && row.scope_id !== null
      ? db.all<{ id: number; title: string }>("SELECT id, title FROM cases WHERE id = ?", [row.scope_id])
      : [];

  return {
    type: "report",
    id,
    label: row.report_type,
    summary: `${row.report_type} report, version ${row.version}, generated ${row.generated_at}, scoped to ${row.scope_type}${
      citationCount !== undefined ? `. ${citationCount} citation(s).` : "."
    }`,
    cases: cases.map((c) => ({ id: c.id, title: c.title })),
  };
}

function obsidianNoteDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ id: number; entity_type: string; entity_id: string; vault_path: string; last_generated_at: string; has_manual_edits: number }>(
    "SELECT id, entity_type, entity_id, vault_path, last_generated_at, has_manual_edits FROM obsidian_notes WHERE id = ?",
    [id]
  );
  if (!row) return undefined;
  return {
    type: "obsidian_note",
    id,
    label: row.vault_path,
    summary: `Generated note for ${row.entity_type} "${row.entity_id}", last generated ${row.last_generated_at}${
      row.has_manual_edits ? " (has manual edits preserved)" : ""
    }.`,
    obsidianNotePath: row.vault_path,
  };
}

function pluginDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  const row = db.get<{ plugin_id: string; plugin_type: string; version: string; state: string; disabled_reason: string | null }>(
    "SELECT plugin_id, plugin_type, version, state, disabled_reason FROM plugin_registrations WHERE id = ?",
    [id]
  );
  if (!row) return undefined;
  const health = db.get<{ total_runs: number; total_failures: number; last_run_status: string | null }>(
    "SELECT total_runs, total_failures, last_run_status FROM plugin_health WHERE plugin_id = ?",
    [row.plugin_id]
  );
  return {
    type: "plugin",
    id,
    label: row.plugin_id,
    summary: `${row.plugin_type} plugin v${row.version} — ${row.state}${row.disabled_reason ? ` (${row.disabled_reason})` : ""}. ${
      health ? `${health.total_runs} run(s), ${health.total_failures} failure(s), last: ${health.last_run_status}.` : "No runs recorded."
    }`,
  };
}

function workspaceDetail(db: WorkspaceDatabase, id: number): NodeDetail | undefined {
  if (id !== WORKSPACE_NODE_ID) return undefined;
  const row = db.get<{ id: string; name: string; status: string }>("SELECT id, name, status FROM workspace LIMIT 1");
  if (!row) return undefined;
  const counts = {
    assets: db.get<{ c: number }>("SELECT COUNT(*) as c FROM assets WHERE status = 'active'")?.c ?? 0,
    cases: db.get<{ c: number }>("SELECT COUNT(*) as c FROM cases")?.c ?? 0,
    reports: db.get<{ c: number }>("SELECT COUNT(*) as c FROM reports")?.c ?? 0,
    plugins: db.get<{ c: number }>("SELECT COUNT(*) as c FROM plugin_registrations WHERE state = 'active'")?.c ?? 0,
  };
  return {
    type: "workspace",
    id,
    label: row.name,
    summary: `${row.status}. ${counts.assets} active asset(s), ${counts.cases} case(s), ${counts.reports} generated report(s), ${counts.plugins} active plugin(s).`,
  };
}
