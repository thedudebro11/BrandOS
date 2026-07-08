import path from "node:path";
import type { WorkspaceDatabase } from "../../db/connection";
import { addRelationship } from "../../db/repositories";
import type { AssetRecord } from "../../types";

const SOURCE_EXTS = new Set(["psd", "xcf", "ai"]);
const EXPORT_EXTS = new Set(["png", "jpg", "jpeg", "svg", "gif", "webp", "tif", "tiff"]);

function stem(filename: string): string {
  return path.basename(filename, path.extname(filename)).toLowerCase().trim();
}

/**
 * Phase 2 scope only: a single, well-justified heuristic — a source-type file
 * (psd/xcf/ai) and an export-type file (png/jpg/svg/...) sharing the same
 * directory and the same filename stem are almost certainly source -> export.
 * Deliberately not attempting content-based matching, near-in-time matching,
 * or cross-directory matching yet — "implement the data model and basic
 * relationship detection only, do not overreach" (Phase 2 instructions).
 */
export function detectSourceToExportRelationships(db: WorkspaceDatabase, assets: AssetRecord[]): number {
  const byDir = new Map<string, AssetRecord[]>();
  for (const asset of assets) {
    if (asset.status !== "active") continue;
    const dir = path.dirname(asset.originalPath);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(asset);
  }

  let count = 0;
  for (const group of byDir.values()) {
    const sources = group.filter((a) => SOURCE_EXTS.has(a.extension.toLowerCase()));
    const exports_ = group.filter((a) => EXPORT_EXTS.has(a.extension.toLowerCase()));
    for (const source of sources) {
      const sourceStem = stem(source.filename);
      for (const exp of exports_) {
        if (stem(exp.filename) !== sourceStem) continue;
        addRelationship(db, {
          fromAssetId: source.id,
          toAssetId: exp.id,
          relationshipType: "source_to_export",
          confidence: 90,
          evidenceNote: `Same directory, matching filename stem "${sourceStem}" across a source extension (.${source.extension}) and an export extension (.${exp.extension}).`,
          detectedMethod: "automatic",
        });
        count++;
      }
    }
  }
  return count;
}
