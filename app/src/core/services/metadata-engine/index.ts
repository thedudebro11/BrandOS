import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { MetadataRecord } from "../../types";
import type { Logger } from "../../logging/logger";

// ---------------------------------------------------------------------------
// Metadata extraction, dispatched by extension. Every extractor is best-effort
// and MUST NOT throw out of this module — a corrupt/unusual file degrades to
// "no metadata extracted", logged as a warning, never a crashed scan
// (app/specs/03_METADATA_ENGINE.md: metadata directly read from the file is
// high confidence; nothing here guesses).
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "m4v"]);

function record(key: string, value: unknown, confidence = 100): MetadataRecord {
  return { key, value: String(value), source: "extracted", confidence };
}

export async function extractMetadata(
  absPath: string,
  extension: string,
  logger: Logger
): Promise<MetadataRecord[]> {
  const ext = extension.toLowerCase();
  try {
    if (IMAGE_EXTS.has(ext)) return await extractImage(absPath);
    if (VIDEO_EXTS.has(ext)) return extractVideo(absPath, logger);
    if (ext === "pdf") return await extractPdf(absPath);
    if (ext === "ai") return await extractAi(absPath);
    if (ext === "psd") return extractPsd(absPath);
    if (ext === "xcf") return extractXcf(absPath);
    if (ext === "svg") return extractSvg(absPath);
    if (ext === "json") return extractJson(absPath);
    if (ext === "md" || ext === "markdown") return extractMarkdown(absPath);
    if (ext === "txt" || ext === "rtf") return extractText(absPath);
    return [];
  } catch (err) {
    logger.warn("metadata.extraction_failed", `Metadata extraction failed for ${absPath}: ${(err as Error).message}`);
    return [];
  }
}

async function extractImage(absPath: string): Promise<MetadataRecord[]> {
  const exifr = await import("exifr");
  const records: MetadataRecord[] = [];
  try {
    const data = await exifr.default.parse(absPath, { tiff: true, xmp: true, iptc: true, gps: true });
    if (data) {
      const fields: [string, unknown][] = [
        ["ImageWidth", data.ImageWidth ?? data.ExifImageWidth],
        ["ImageHeight", data.ImageHeight ?? data.ExifImageHeight],
        ["Make", data.Make],
        ["Model", data.Model],
        ["DateTimeOriginal", data.DateTimeOriginal],
        ["Software", data.Software],
        ["ColorSpace", data.ColorSpace],
        ["latitude", data.latitude],
        ["longitude", data.longitude],
      ];
      for (const [key, value] of fields) {
        if (value !== undefined && value !== null) records.push(record(key, value));
      }
    }
  } catch {
    // Many images (plain PNGs, screenshots) legitimately carry no EXIF/XMP — not an error.
  }
  return records;
}

function extractVideo(absPath: string, logger: Logger): MetadataRecord[] {
  try {
    const output = execFileSync(
      "ffprobe",
      ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", absPath],
      { encoding: "utf-8", timeout: 10000 }
    );
    const parsed = JSON.parse(output);
    const records: MetadataRecord[] = [];
    if (parsed.format?.duration) records.push(record("durationSeconds", parsed.format.duration));
    const videoStream = (parsed.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === "video");
    if (videoStream) {
      if (videoStream.codec_name) records.push(record("codec", videoStream.codec_name));
      if (videoStream.width) records.push(record("width", videoStream.width));
      if (videoStream.height) records.push(record("height", videoStream.height));
      if (videoStream.r_frame_rate) records.push(record("frameRate", videoStream.r_frame_rate));
    }
    return records;
  } catch (err) {
    logger.info(
      "metadata.video_limited",
      `ffprobe unavailable or failed for ${absPath}; video metadata limited to filesystem info (${(err as Error).message})`
    );
    return [];
  }
}

async function extractPdf(absPath: string): Promise<MetadataRecord[]> {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = fs.readFileSync(absPath);
  const data = await pdfParse(buffer);
  const records: MetadataRecord[] = [record("pageCount", data.numpages)];
  const info = data.info as Record<string, unknown>;
  if (info?.Author) records.push(record("author", info.Author));
  if (info?.Creator) records.push(record("creator", info.Creator));
  if (info?.CreationDate) records.push(record("creationDate", info.CreationDate));
  return records;
}

async function extractAi(absPath: string): Promise<MetadataRecord[]> {
  // Modern .ai files are PDF-compatible; fall back to a minimal note if not.
  try {
    return await extractPdf(absPath);
  } catch {
    return [record("format", "Adobe Illustrator (legacy/non-PDF-compatible)", 90)];
  }
}

/** PSD fixed 26-byte header, per Adobe's documented format — no dependency needed. */
function extractPsd(absPath: string): MetadataRecord[] {
  const fd = fs.openSync(absPath, "r");
  try {
    const buf = Buffer.alloc(26);
    fs.readSync(fd, buf, 0, 26, 0);
    if (buf.toString("ascii", 0, 4) !== "8BPS") return [];
    const version = buf.readUInt16BE(4);
    const channels = buf.readUInt16BE(12);
    const height = buf.readUInt32BE(14);
    const width = buf.readUInt32BE(18);
    const depth = buf.readUInt16BE(22);
    const colorMode = buf.readUInt16BE(24);
    const modeNames: Record<number, string> = {
      0: "Bitmap",
      1: "Grayscale",
      2: "Indexed",
      3: "RGB",
      4: "CMYK",
      7: "Multichannel",
      8: "Duotone",
      9: "Lab",
    };
    return [
      record("psdVersion", version === 2 ? "PSB" : "PSD"),
      record("width", width),
      record("height", height),
      record("channels", channels),
      record("bitDepth", depth),
      record("colorMode", modeNames[colorMode] ?? `unknown(${colorMode})`),
    ];
  } finally {
    fs.closeSync(fd);
  }
}

/** XCF (GIMP) header: "gimp xcf " + version(4) + NUL, then width/height/base-type as big-endian uint32. */
function extractXcf(absPath: string): MetadataRecord[] {
  const fd = fs.openSync(absPath, "r");
  try {
    const buf = Buffer.alloc(26);
    fs.readSync(fd, buf, 0, 26, 0);
    if (buf.toString("ascii", 0, 9) !== "gimp xcf ") return [];
    const version = buf.toString("ascii", 9, 13).replace(/\0/g, "");
    const width = buf.readUInt32BE(14);
    const height = buf.readUInt32BE(18);
    const baseType = buf.readUInt32BE(22);
    const typeNames: Record<number, string> = { 0: "RGB", 1: "Grayscale", 2: "Indexed" };
    return [
      record("xcfVersion", version || "file"),
      record("width", width),
      record("height", height),
      record("baseType", typeNames[baseType] ?? `unknown(${baseType})`),
    ];
  } finally {
    fs.closeSync(fd);
  }
}

function extractSvg(absPath: string): MetadataRecord[] {
  const content = fs.readFileSync(absPath, "utf-8").slice(0, 4096);
  const svgTagMatch = content.match(/<svg[^>]*>/i);
  if (!svgTagMatch) return [];
  const tag = svgTagMatch[0];
  const records: MetadataRecord[] = [];
  const width = tag.match(/\bwidth="([^"]+)"/i);
  const height = tag.match(/\bheight="([^"]+)"/i);
  const viewBox = tag.match(/\bviewBox="([^"]+)"/i);
  if (width) records.push(record("width", width[1]));
  if (height) records.push(record("height", height[1]));
  if (viewBox) records.push(record("viewBox", viewBox[1]));
  return records;
}

function extractJson(absPath: string): MetadataRecord[] {
  const content = fs.readFileSync(absPath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    const topLevelKeys = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    return [
      record("valid", true),
      record(Array.isArray(parsed) ? "arrayLength" : "topLevelKeyCount", topLevelKeys),
    ];
  } catch {
    return [record("valid", false, 100)];
  }
}

function extractMarkdown(absPath: string): MetadataRecord[] {
  const content = fs.readFileSync(absPath, "utf-8");
  const lines = content.split(/\r?\n/);
  const heading = lines.find((l) => /^#\s+/.test(l));
  const records: MetadataRecord[] = [record("lineCount", lines.length)];
  if (heading) records.push(record("title", heading.replace(/^#\s+/, "").trim()));
  return records;
}

function extractText(absPath: string): MetadataRecord[] {
  const content = fs.readFileSync(absPath, "utf-8");
  const lines = content.split(/\r?\n/);
  return [record("lineCount", lines.length), record("charCount", content.length)];
}
