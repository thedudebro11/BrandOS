import type { WorkspaceDatabase } from "../../db/connection";
import { addTimelineEvent } from "../../db/repositories";
import type { AssetRecord, MetadataRecord } from "../../types";

const CONTENT_DATE_KEYS = ["DateTimeOriginal", "creationDate", "CreationDate"];

/**
 * Records the filesystem-known dates for a newly-created asset as timeline
 * events, plus a "content_date" event if metadata extraction found a
 * plausible in-file date (EXIF DateTimeOriginal, PDF CreationDate). This
 * covers the Phase 2 requirement's "published date when available / referenced
 * date when available" via one generic content_date bucket rather than
 * inventing a semantic distinction between "published" and "referenced" that
 * would require judgment beyond what filesystem/metadata facts can support at
 * this stage — see IMPLEMENTATION_PLAN.md Phase 2 notes.
 */
export function recordAssetTimelineEvents(
  db: WorkspaceDatabase,
  asset: AssetRecord,
  metadata: MetadataRecord[]
): number {
  let count = 0;

  if (asset.createdAt) {
    addTimelineEvent(db, {
      assetId: asset.id,
      eventType: "file_created",
      eventDate: asset.createdAt,
      dateSource: "file_created",
      title: `${asset.filename} — file created`,
      confidence: 100,
      verifiedStatus: "verified",
    });
    count++;
  }

  if (asset.modifiedAt && asset.modifiedAt !== asset.createdAt) {
    addTimelineEvent(db, {
      assetId: asset.id,
      eventType: "file_modified",
      eventDate: asset.modifiedAt,
      dateSource: "file_modified",
      title: `${asset.filename} — file modified`,
      confidence: 100,
      verifiedStatus: "verified",
    });
    count++;
  }

  addTimelineEvent(db, {
    assetId: asset.id,
    eventType: "imported",
    eventDate: asset.firstSeenAt,
    dateSource: "imported",
    title: `${asset.filename} — first scanned by BrandOS`,
    confidence: 100,
    verifiedStatus: "verified",
  });
  count++;

  for (const key of CONTENT_DATE_KEYS) {
    const found = metadata.find((m) => m.key === key);
    if (found) {
      addTimelineEvent(db, {
        assetId: asset.id,
        eventType: "content_date",
        eventDate: found.value,
        dateSource: "content_date",
        title: `${asset.filename} — date from file content (${key})`,
        confidence: 90,
        verifiedStatus: "verified",
      });
      count++;
      break; // one content_date event per asset is enough at foundation stage
    }
  }

  return count;
}
