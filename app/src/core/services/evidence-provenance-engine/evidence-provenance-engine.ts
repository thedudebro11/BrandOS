import type { WorkspaceDatabase } from "../../db/connection";
import { getResolvedDate } from "../../db/knowledge-repositories";
import type { AssetIntelligenceView } from "../asset-intelligence/asset-intelligence";

export interface ProvenanceChainLink {
  layer: string; // e.g. "Resolved Date", "Candidate Date", "Source Asset", "SHA-256 Hash", "Workspace"
  description: string;
  reproducible: boolean;
}

/**
 * Traces a resolved date back through what produced it, down to a
 * hash-verified original asset — the concrete, currently-buildable slice of
 * the full chain in the Phase 3.5 spec (Trademark Readiness -> Priority of
 * Use -> Timeline Event -> ... -> Workspace). The upper layers (Trademark
 * Readiness, Priority of Use, reports) don't exist yet (Phase 5+); when they
 * do, they should call this function for their date citations rather than
 * re-implementing traversal (ARCHITECTURE_PRINCIPLES.md / Phase 3.5 System 12
 * "no duplicate logic").
 */
export function traceResolvedDateProvenance(db: WorkspaceDatabase, assetId: number): ProvenanceChainLink[] {
  const chain: ProvenanceChainLink[] = [];
  const resolved = getResolvedDate(db, assetId);
  if (!resolved) {
    return [
      {
        layer: "Resolved Date",
        description: `Asset ${assetId} has no resolved date — no plausible candidate date was found. Nothing to trace.`,
        reproducible: false,
      },
    ];
  }

  chain.push({
    layer: "Resolved Date",
    description: `${resolved.resolvedDate} (confidence ${resolved.confidence}/100, source "${resolved.sourceType}"). ${resolved.reasoning}`,
    reproducible: true,
  });

  const candidate = db.get<{ id: number; extracted_from: string; source_asset_id: number | null; raw_value: string | null }>(
    "SELECT id, extracted_from, source_asset_id, raw_value FROM candidate_dates WHERE id = ?",
    [resolved.sourceCandidateId]
  );
  if (candidate) {
    chain.push({
      layer: "Candidate Date",
      description: `Extracted from ${candidate.extracted_from}${candidate.raw_value ? ` (raw value: "${candidate.raw_value}")` : ""}.`,
      reproducible: true,
    });

    if (candidate.source_asset_id) {
      const sourceAsset = db.get<{ asset_id: string; filename: string; sha256: string | null }>(
        "SELECT asset_id, filename, sha256 FROM assets WHERE id = ?",
        [candidate.source_asset_id]
      );
      if (sourceAsset) {
        chain.push({
          layer: "Cross-Referenced Source Asset",
          description: `Derived from ${sourceAsset.asset_id} (${sourceAsset.filename})`,
          reproducible: true,
        });
      }
    }
  }

  const asset = db.get<{ asset_id: string; filename: string; original_path: string; sha256: string | null }>(
    "SELECT asset_id, filename, original_path, sha256 FROM assets WHERE id = ?",
    [assetId]
  );
  if (asset) {
    chain.push({
      layer: "Original Asset",
      description: `${asset.asset_id} — ${asset.filename} (${asset.original_path})`,
      reproducible: true,
    });
    chain.push({
      layer: "SHA-256 Hash",
      description: asset.sha256 ?? "(not yet hashed)",
      reproducible: asset.sha256 !== null,
    });
  }

  const workspace = db.get<{ id: string; name: string }>("SELECT id, name FROM workspace LIMIT 1");
  if (workspace) {
    chain.push({ layer: "Workspace", description: `${workspace.name} (${workspace.id})`, reproducible: true });
  }

  return chain;
}

/**
 * Which of the given assets' resolved dates carry a documented conflict —
 * the exact check the Phase 4.5 Case Detail API route uses (a resolved
 * date's reasoning mentioning "conflict", set when the timeline resolution
 * engine found multiple plausible-but-disagreeing candidates). Extracted
 * here so the API route and Phase 8's report generators call the same
 * function instead of each re-implementing the same one-line filter
 * (ARCHITECTURE_PRINCIPLES.md "no duplicate logic").
 */
export function findConflictingAssets(db: WorkspaceDatabase, assets: AssetIntelligenceView[]): AssetIntelligenceView[] {
  return assets.filter(
    (a) => db.get("SELECT 1 as x FROM resolved_dates WHERE asset_id = ? AND reasoning LIKE '%conflict%'", [a.asset.id]) !== undefined
  );
}
