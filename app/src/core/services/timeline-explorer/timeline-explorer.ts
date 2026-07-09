import type { WorkspaceDatabase } from "../../db/connection";
import { listResolvedDates, getClassification } from "../../db/knowledge-repositories";

export interface TimelineEntry {
  assetNumericId: number;
  assetId: string;
  filename: string;
  category: string | undefined;
  resolvedDate: string;
  confidence: number;
  sourceType: string;
  reasoning: string;
  groupKey: string;
}

export interface TimelineGroup {
  key: string;
  count: number;
}

export interface TimelineExplorerData {
  entries: TimelineEntry[];
  groups: TimelineGroup[];
  categories: string[];
}

export interface TimelineExplorerFilters {
  category?: string;
  fromDate?: string;
  toDate?: string;
  minConfidence?: number;
}

/**
 * Chronological navigation data (Phase 9 Section 2), built entirely from
 * Phase 3.5's resolved dates — the same "engine's actual answer" every other
 * consumer (Mission Control's Asset Detail, the Obsidian vault, Brand
 * History Report) already uses, never a raw filesystem timestamp. Grouped
 * by year so the UI can offer real chronological navigation without
 * pre-computing every possible granularity. Filtering happens here, not in
 * the API route, so the route stays a thin pass-through per ADR-011's rule.
 */
export function getTimelineExplorerData(db: WorkspaceDatabase, filters: TimelineExplorerFilters = {}): TimelineExplorerData {
  const resolved = listResolvedDates(db);
  const categorySet = new Set<string>();

  let entries: TimelineEntry[] = resolved.map((rd) => {
    const assetRow = db.get<{ asset_id: string; filename: string }>("SELECT asset_id, filename FROM assets WHERE id = ?", [rd.assetId]);
    const classification = getClassification(db, rd.assetId);
    if (classification) categorySet.add(classification.category);
    return {
      assetNumericId: rd.assetId,
      assetId: assetRow?.asset_id ?? "",
      filename: assetRow?.filename ?? "",
      category: classification?.category,
      resolvedDate: rd.resolvedDate,
      confidence: rd.confidence,
      sourceType: rd.sourceType,
      reasoning: rd.reasoning,
      groupKey: rd.resolvedDate.slice(0, 4),
    };
  });

  entries = entries
    .filter((e) => e.assetId !== "")
    .filter((e) => (filters.category ? e.category === filters.category : true))
    .filter((e) => (filters.fromDate ? e.resolvedDate >= filters.fromDate : true))
    .filter((e) => (filters.toDate ? e.resolvedDate <= filters.toDate : true))
    .filter((e) => (filters.minConfidence !== undefined ? e.confidence >= filters.minConfidence : true))
    .sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate));

  const groupCounts = new Map<string, number>();
  for (const e of entries) groupCounts.set(e.groupKey, (groupCounts.get(e.groupKey) ?? 0) + 1);
  const groups = Array.from(groupCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { entries, groups, categories: Array.from(categorySet).sort() };
}
