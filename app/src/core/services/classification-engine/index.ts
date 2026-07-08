import path from "node:path";
import type { WorkspaceDatabase } from "../../db/connection";
import { upsertClassification } from "../../db/knowledge-repositories";
import { enrichNeedsReview } from "../needs-review-intelligence/needs-review-intelligence";
import { applySiblingContextBoost, classifyFile, type ClassificationInput } from "./rules";
import type { AssetRecord, ClassificationRecord } from "../../types";

function getSiblingCategories(db: WorkspaceDatabase, asset: AssetRecord): string[] {
  const folder = path.dirname(asset.originalPath);
  const candidates = db.all<{ id: number; original_path: string; category: string }>(
    `SELECT a.id, a.original_path, c.category FROM assets a JOIN classifications c ON c.asset_id = a.id
     WHERE a.id != ? AND a.status = 'active'`,
    [asset.id]
  );
  return candidates.filter((c) => path.dirname(c.original_path) === folder).map((c) => c.category);
}

export function classifyAsset(
  db: WorkspaceDatabase,
  asset: AssetRecord,
  hasExportRelationship: boolean
): ClassificationRecord {
  const input: ClassificationInput = {
    file: { relPath: asset.originalPath, filename: asset.filename, extension: asset.extension },
    hasExportRelationship,
  };
  const base = classifyFile(input);
  const siblingCategories = getSiblingCategories(db, asset);
  const result = applySiblingContextBoost(base, siblingCategories);

  const supportingEvidence = result.reason;
  const missingEvidence =
    result.confidence < 70
      ? `No path keyword, file-format signal, relationship, or sibling majority strong enough to exceed the 70 confidence threshold.`
      : "";
  const conflictingEvidence =
    base.ruleId !== result.ruleId
      ? `Base rule-only result would have been "${base.category}" (confidence ${base.confidence}) via "${base.ruleId}"; sibling context changed this.`
      : "";

  return upsertClassification(db, asset.id, result.category, result.confidence, result.ruleId, result.reason, {
    supportingEvidence,
    missingEvidence,
    conflictingEvidence,
  });
}

export function classifyAssetAndEnrichReview(db: WorkspaceDatabase, asset: AssetRecord, hasExportRelationship: boolean): ClassificationRecord {
  const classification = classifyAsset(db, asset, hasExportRelationship);
  enrichNeedsReview(db, asset, classification);
  return classification;
}

export { classifyFile } from "./rules";
