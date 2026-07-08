import type { WorkspaceDatabase } from "../../db/connection";
import type { AssetRecord } from "../../types";

function mapAsset(row: Record<string, unknown> | undefined): AssetRecord | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    assetId: row.asset_id as string,
    originalPath: row.original_path as string,
    filename: row.filename as string,
    extension: row.extension as string,
    sizeBytes: row.size_bytes as number,
    createdAt: row.created_at as string | null,
    modifiedAt: row.modified_at as string | null,
    accessedAt: row.accessed_at as string | null,
    isHidden: row.is_hidden as number,
    isBrokenShortcut: row.is_broken_shortcut as number,
    status: row.status as "active" | "missing",
    sha256: row.sha256 as string | null,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
  };
}

/**
 * Discrete, typed query methods rather than a query-string DSL/parser — a
 * full natural-language query parser is explicitly future scope ("the query
 * engine becomes the foundation for future UI and AI"). This IS that
 * foundation: every method here is a reusable building block a future NL
 * layer, dashboard, or AI feature can call, none of them re-implement their
 * own SQL against the schema.
 */
export class QueryEngine {
  constructor(private db: WorkspaceDatabase) {}

  firstAssetByCategory(category: string): AssetRecord | undefined {
    return mapAsset(
      this.db.get(
        `SELECT a.* FROM assets a JOIN classifications c ON c.asset_id = a.id
         WHERE c.category = ? AND a.status = 'active' ORDER BY a.created_at ASC LIMIT 1`,
        [category]
      )
    );
  }

  everyAssetByExtension(extension: string): AssetRecord[] {
    return this.db
      .all("SELECT * FROM assets WHERE extension = ? AND status = 'active'", [extension.toLowerCase()])
      .map((r) => mapAsset(r)!);
  }

  assetsBeforeDate(isoDate: string): AssetRecord[] {
    return this.db
      .all("SELECT * FROM assets WHERE created_at IS NOT NULL AND created_at < ? AND status = 'active'", [isoDate])
      .map((r) => mapAsset(r)!);
  }

  assetsSupportingDimension(dimension: string): AssetRecord[] {
    // "Supporting Priority of Use" etc: assets whose classification category has dated
    // timeline evidence contributing to that evidence dimension's assessment.
    const categoriesByDimension: Record<string, string[]> = {
      priority_of_use: ["Design Source", "Marketing Evidence", "Commerce Evidence", "Marketplace Evidence"],
      continuous_use: ["Design Source", "Marketing Evidence", "Commerce Evidence", "Marketplace Evidence", "Historical Evidence"],
    };
    const categories = categoriesByDimension[dimension] ?? [];
    if (categories.length === 0) return [];
    const placeholders = categories.map(() => "?").join(",");
    return this.db
      .all(
        `SELECT DISTINCT a.* FROM assets a JOIN classifications c ON c.asset_id = a.id
         WHERE c.category IN (${placeholders}) AND a.status = 'active'`,
        categories
      )
      .map((r) => mapAsset(r)!);
  }

  assetsConnectedTo(assetId: number): AssetRecord[] {
    return this.db
      .all(
        `SELECT DISTINCT a.* FROM assets a WHERE a.id IN (
           SELECT to_asset_id FROM relationships WHERE from_asset_id = ?
           UNION
           SELECT from_asset_id FROM relationships WHERE to_asset_id = ?
         )`,
        [assetId, assetId]
      )
      .map((r) => mapAsset(r)!);
  }

  assetsMissingMetadata(): AssetRecord[] {
    return this.db
      .all(
        `SELECT a.* FROM assets a WHERE a.status = 'active' AND NOT EXISTS
         (SELECT 1 FROM metadata m WHERE m.asset_id = a.id)`
      )
      .map((r) => mapAsset(r)!);
  }

  duplicateGroups(): { groupId: number; sha256: string; assetIds: number[] }[] {
    const groups = this.db.all<{ id: number; sha256: string }>("SELECT id, sha256 FROM duplicate_groups");
    return groups.map((g) => ({
      groupId: g.id,
      sha256: g.sha256,
      assetIds: this.db
        .all<{ asset_id: number }>("SELECT asset_id FROM duplicate_group_members WHERE group_id = ?", [g.id])
        .map((r) => r.asset_id),
    }));
  }

  orphanedAssets(): AssetRecord[] {
    return this.db
      .all(
        `SELECT a.* FROM assets a WHERE a.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.from_asset_id = a.id OR r.to_asset_id = a.id)
         AND NOT EXISTS (SELECT 1 FROM case_links cl WHERE cl.linked_type = 'asset' AND cl.linked_id = a.id)
         AND NOT EXISTS (SELECT 1 FROM asset_tags at WHERE at.asset_id = a.id)`
      )
      .map((r) => mapAsset(r)!);
  }

  assetsByTag(tagName: string): AssetRecord[] {
    return this.db
      .all(
        `SELECT a.* FROM assets a JOIN asset_tags at ON at.asset_id = a.id JOIN tags t ON t.id = at.tag_id
         WHERE t.name = ? AND a.status = 'active'`,
        [tagName]
      )
      .map((r) => mapAsset(r)!);
  }

  assetsNeedingReview(confidenceBelow = 70): AssetRecord[] {
    return this.db
      .all(
        `SELECT a.* FROM assets a JOIN classifications c ON c.asset_id = a.id
         WHERE c.confidence < ? AND a.status = 'active'`,
        [confidenceBelow]
      )
      .map((r) => mapAsset(r)!);
  }

  /**
   * General-purpose filtered/sorted asset listing — the Evidence Explorer's
   * data source, but written as a reusable engine method (any future
   * consumer gets the same filters), not a dashboard-specific query.
   */
  listAssetsFiltered(opts: {
    classification?: string;
    tag?: string;
    extension?: string;
    needsReview?: boolean;
    sortBy?: "filename" | "date" | "confidence";
    limit?: number;
  }): AssetRecord[] {
    const clauses: string[] = ["a.status = 'active'"];
    const params: unknown[] = [];
    let joins = "";
    const needsClassificationsJoin = !!opts.classification || !!opts.needsReview || opts.sortBy === "confidence";

    if (needsClassificationsJoin) {
      joins += " LEFT JOIN classifications cl ON cl.asset_id = a.id";
    }
    if (opts.classification) {
      clauses.push("cl.category = ?");
      params.push(opts.classification);
    }
    if (opts.needsReview) {
      clauses.push("cl.needs_review = 1");
    }
    if (opts.tag) {
      joins += " JOIN asset_tags at ON at.asset_id = a.id JOIN tags t ON t.id = at.tag_id";
      clauses.push("t.name = ?");
      params.push(opts.tag);
    }
    if (opts.extension) {
      clauses.push("a.extension = ?");
      params.push(opts.extension.toLowerCase());
    }

    const orderBy =
      opts.sortBy === "date"
        ? "a.modified_at DESC"
        : opts.sortBy === "confidence"
          ? "cl.confidence DESC"
          : "a.filename ASC";

    const sql = `SELECT DISTINCT a.* FROM assets a${joins} WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy} LIMIT ?`;
    params.push(opts.limit ?? 300);
    return this.db.all(sql, params).map((r) => mapAsset(r)!);
  }
}
