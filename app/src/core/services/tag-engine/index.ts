import type { WorkspaceDatabase } from "../../db/connection";
import { clearAutomaticTags, tagAsset } from "../../db/knowledge-repositories";
import { suggestTags } from "./tag-rules";
import type { AssetRecord } from "../../types";

export function tagAssetAutomatically(db: WorkspaceDatabase, asset: AssetRecord, category: string): number {
  clearAutomaticTags(db, asset.id);
  const suggestions = suggestTags(asset.originalPath, category);
  for (const s of suggestions) {
    tagAsset(db, asset.id, s.tag, "automatic", s.confidence, s.reason);
  }
  return suggestions.length;
}

export { suggestTags } from "./tag-rules";
