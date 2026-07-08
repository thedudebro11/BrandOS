import type { WorkspaceDatabase } from "../../db/connection";
import { enrichReviewQueueEntry } from "../../db/knowledge-repositories";
import type { AssetRecord, ClassificationRecord } from "../../types";

/**
 * Turns "confidence was low" into something a human can actually act on
 * (Phase 3.5 System 7). Every field here is derived from real, queryable
 * facts — duplicate-group size, case/relationship linkage, sibling count —
 * never invented.
 */
export function enrichNeedsReview(db: WorkspaceDatabase, asset: AssetRecord, classification: ClassificationRecord): void {
  if (!classification.needsReview) return;

  const siblingCount = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM assets WHERE original_path LIKE ? AND status = 'active' AND id != ?",
    [`${asset.originalPath.split("/").slice(0, -1).join("/")}/%`, asset.id]
  )?.c ?? 0;

  const inDuplicateGroup = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM duplicate_group_members WHERE asset_id = ?",
    [asset.id]
  )?.c ?? 0;

  const hasRelationships = (db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM relationships WHERE from_asset_id = ? OR to_asset_id = ?",
    [asset.id, asset.id]
  )?.c ?? 0) > 0;

  const linkedCaseCount = db.get<{ c: number }>(
    "SELECT COUNT(*) as c FROM case_links WHERE linked_type = 'asset' AND linked_id = ?",
    [asset.id]
  )?.c ?? 0;

  const possibleClassificationsDetail =
    siblingCount > 0
      ? `Category "${classification.category}" was the best available match. Consider comparing against the ${siblingCount} other asset(s) in the same folder for a stronger signal once more of them are classified.`
      : `Category "${classification.category}" was the only available match — no sibling assets in the same folder to compare against.`;

  const suggestedAction =
    classification.category === "Unknown"
      ? "Manually assign a category — no rule matched this file's extension or path."
      : "Confirm or correct this category — the automated confidence was below the 70 threshold.";

  const estimatedEffort: "low" | "medium" | "high" = inDuplicateGroup > 0 ? "low" : siblingCount > 20 ? "high" : "medium";
  // Low effort if it's a duplicate (resolving one member likely resolves the group by extension);
  // high effort if it sits in a very large, likely-repetitive folder that probably needs a folder-level rule instead of one-by-one review.

  const potentialImpact: "low" | "medium" | "high" =
    linkedCaseCount > 0 ? "high" : hasRelationships ? "medium" : "low";
  // High if it's already relied on by a case; medium if connected to other assets; low if fully isolated.

  enrichReviewQueueEntry(db, asset.id, {
    possibleClassificationsDetail,
    suggestedAction,
    estimatedEffort,
    potentialImpact,
  });
}
