import type { AssetRecord, CandidateDateInput, DiscoveredFile, MetadataRecord } from "../../types";

/**
 * Gathers every candidate date BrandOS can currently find for an asset, from
 * every source Phase 2/3 already extract. Never a source of truth by itself
 * — the Timeline Resolution Engine decides which one (if any) wins. Sources
 * with no producer yet (Printful, Instagram, Shopify, Stripe, git, email,
 * user-confirmed) are not collected here because there is no data yet, not
 * because they're unsupported — see date_source_priorities.producer_status.
 */
export function collectFilesystemCandidates(file: Pick<DiscoveredFile, "createdAt" | "modifiedAt">): CandidateDateInput[] {
  const candidates: CandidateDateInput[] = [];
  if (file.createdAt) {
    candidates.push({
      sourceType: "filesystem_created",
      dateValue: file.createdAt,
      rawValue: file.createdAt,
      extractedFrom: "fs.stat().birthtime",
    });
  }
  if (file.modifiedAt) {
    candidates.push({
      sourceType: "filesystem_modified",
      dateValue: file.modifiedAt,
      rawValue: file.modifiedAt,
      extractedFrom: "fs.stat().mtime",
    });
  }
  return candidates;
}

const METADATA_DATE_KEYS: Record<string, "exif" | "pdf_metadata" | "ai_metadata"> = {
  DateTimeOriginal: "exif",
  creationDate: "pdf_metadata",
  CreationDate: "pdf_metadata",
};

export function collectMetadataCandidates(metadata: MetadataRecord[], extension: string): CandidateDateInput[] {
  const candidates: CandidateDateInput[] = [];
  for (const m of metadata) {
    const mappedSource = METADATA_DATE_KEYS[m.key];
    if (!mappedSource) continue;
    // A CreationDate key on a .ai file is Illustrator (PDF-compatible), not a generic PDF.
    const sourceType = mappedSource === "pdf_metadata" && extension.toLowerCase() === "ai" ? "ai_metadata" : mappedSource;
    const parsed = parsePdfOrExifDate(m.value);
    if (!parsed) continue;
    candidates.push({
      sourceType,
      dateValue: parsed,
      rawValue: m.value,
      extractedFrom: `metadata:${m.key}`,
    });
  }
  return candidates;
}

/** PDF dates are often "D:20240925193507Z"-style; EXIF dates are often "2024:09:25 19:35:07". Best-effort normalize both to ISO; anything else is passed through to Date() parsing. */
function parsePdfOrExifDate(raw: string): string | null {
  const pdfMatch = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (pdfMatch) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = pdfMatch;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  }
  const exifMatch = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (exifMatch) {
    const [, y, mo, d, h, mi, s] = exifMatch;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  }
  const asDate = new Date(raw);
  return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
}

const FILENAME_DATE_PATTERNS = [
  /(\d{4})-(\d{2})-(\d{2})/, // 2024-09-25
  /(\d{4})_(\d{2})_(\d{2})/, // 2024_09_25
  /(\d{4})(\d{2})(\d{2})[_ ]\d{6}/, // 20240925_193507 or "20240925 193507"
];

export function collectFilenamePatternCandidates(filename: string): CandidateDateInput[] {
  for (const pattern of FILENAME_DATE_PATTERNS) {
    const match = filename.match(pattern);
    if (!match) continue;
    const [, y, mo, d] = match;
    const iso = `${y}-${mo}-${d}T00:00:00.000Z`;
    if (Number.isNaN(new Date(iso).getTime())) continue;
    return [{ sourceType: "filename_pattern", dateValue: iso, rawValue: match[0], extractedFrom: "filename" }];
  }
  return [];
}

export function collectFolderPatternCandidates(relPath: string): CandidateDateInput[] {
  const segments = relPath.split(/[/\\]/).slice(0, -1); // exclude the filename itself
  for (const segment of segments) {
    for (const pattern of FILENAME_DATE_PATTERNS) {
      const match = segment.match(pattern);
      if (!match) continue;
      const [, y, mo, d] = match;
      const iso = `${y}-${mo}-${d}T00:00:00.000Z`;
      if (Number.isNaN(new Date(iso).getTime())) continue;
      return [{ sourceType: "folder_pattern", dateValue: iso, rawValue: match[0], extractedFrom: `folder:${segment}` }];
    }
  }
  return [];
}

/** A relationship-derived candidate: "this export's date is probably close to its source file's resolved date." */
export function buildRelationshipDerivedCandidate(
  relatedAsset: AssetRecord,
  relatedResolvedDate: string,
  relationshipType: string
): CandidateDateInput {
  return {
    sourceType: "relationship_derived",
    dateValue: relatedResolvedDate,
    rawValue: relatedResolvedDate,
    extractedFrom: `relationship:${relationshipType}`,
    sourceAssetId: relatedAsset.id,
  };
}
