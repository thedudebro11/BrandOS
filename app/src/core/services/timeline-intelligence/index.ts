import type { WorkspaceDatabase } from "../../db/connection";
import { recordCandidateDate } from "../../db/knowledge-repositories";
import { checkPlausibility } from "./plausibility";
import {
  collectFilesystemCandidates,
  collectFilenamePatternCandidates,
  collectFolderPatternCandidates,
  collectMetadataCandidates,
} from "./candidate-collectors";
import { resolveAssetDate } from "./timeline-resolution-engine";
import type { AssetRecord, MetadataRecord } from "../../types";

/** Collects every non-relationship candidate date for one asset and stores them all (never discarding any). */
export function collectCandidateDatesForAsset(db: WorkspaceDatabase, asset: AssetRecord, metadata: MetadataRecord[]): void {
  const all = [
    ...collectFilesystemCandidates({ createdAt: asset.createdAt, modifiedAt: asset.modifiedAt }),
    ...collectMetadataCandidates(metadata, asset.extension),
    ...collectFilenamePatternCandidates(asset.filename),
    ...collectFolderPatternCandidates(asset.originalPath),
  ];
  for (const candidate of all) {
    const { plausible, reason } = checkPlausibility(candidate.dateValue);
    recordCandidateDate(db, asset.id, candidate, plausible, reason);
  }
}

export { resolveAssetDate } from "./timeline-resolution-engine";
export { buildRelationshipDerivedCandidate } from "./candidate-collectors";
export { checkPlausibility } from "./plausibility";
