import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { extensionOf, isHiddenName } from "../../core/services/file-scanner/ignore-rules";
import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../core/plugin-runtime/plugin-api";
import type { DiscoveredFile } from "../../core/types";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

/**
 * Provenance convention for every asset this importer creates: original_path
 * is "<zipRelPath>::<entryNameInsideZip>", never just the entry name alone.
 * This is what lets a citation trace back to exactly which ZIP and which
 * member inside it produced an asset (ADR-007's traceability requirement),
 * without ever touching or renaming the real ZIP file, and lets a second
 * import of the same ZIP resolve back to the same asset row (idempotency) —
 * findAssetByPath() matches on this exact string.
 */
export function buildZipMemberPath(zipRelPath: string, entryName: string): string {
  return `${zipRelPath}::${entryName}`;
}

const importerZipArchive: ImporterPlugin = {
  manifest,

  async validateSource(ctx: PluginContext, source: ImportSourceRef) {
    if (source.kind !== "zip") return { ok: false, reason: `expected source.kind "zip", got "${source.kind}"` };
    const absZipPath = path.resolve(ctx.wfs.rootDir, source.zipRelPath);
    if (!absZipPath.startsWith(ctx.wfs.rootDir + path.sep)) {
      return { ok: false, reason: "zip path resolves outside the workspace evidence tree" };
    }
    if (!fs.existsSync(absZipPath)) return { ok: false, reason: `no file at ${source.zipRelPath}` };
    return { ok: true };
  },

  async discover(ctx: PluginContext, source: ImportSourceRef): Promise<DiscoverResult> {
    if (source.kind !== "zip") {
      throw new Error(`importer-zip-archive only supports source.kind "zip", got "${source.kind}"`);
    }
    const absZipPath = path.resolve(ctx.wfs.rootDir, source.zipRelPath);
    const resolved = absZipPath;
    if (!resolved.startsWith(ctx.wfs.rootDir + path.sep)) {
      throw new Error(`Refusing to read a zip path outside the workspace evidence tree: ${resolved}`);
    }
    if (!fs.existsSync(absZipPath)) {
      throw new Error(`No file at ${source.zipRelPath} (resolved: ${absZipPath})`);
    }

    const runKey = `zip-${ctx.runId ?? Date.now()}`;
    const stagingDir = ctx.wfs.ensureStagingDir(runKey);

    // adm-zip is a pure-JS, dependency-free reader/writer (no native
    // compilation) — the same constraint that ruled out better-sqlite3
    // (ADR-009) and Tauri (ADR-011) applies to any zip library, so this was
    // checked before adding the dependency.
    const zip = new AdmZip(absZipPath);
    const files: DiscoveredFile[] = [];

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;

      const entryRelPath = buildZipMemberPath(source.zipRelPath, entry.entryName);
      const basename = path.basename(entry.entryName);
      const stagedAbsPath = path.join(stagingDir, entry.entryName.replace(/\.\./g, "__"));
      fs.mkdirSync(path.dirname(stagedAbsPath), { recursive: true });
      fs.writeFileSync(stagedAbsPath, entry.getData());

      const modifiedAt = entry.header?.time ? new Date(entry.header.time).toISOString() : null;

      files.push({
        absPath: stagedAbsPath,
        relPath: entryRelPath,
        filename: basename,
        extension: extensionOf(basename),
        sizeBytes: entry.header?.size ?? 0,
        // A ZIP's central directory stores one timestamp per entry, not a
        // separate created/modified pair the way a filesystem does — honestly
        // represented here as modifiedAt only, not duplicated into createdAt.
        createdAt: null,
        modifiedAt,
        accessedAt: null,
        isHidden: isHiddenName(basename),
        isBrokenShortcut: false,
      });
    }

    ctx.logger.info("import.discovered", `ZIP Archive Importer found ${files.length} file(s) in ${source.zipRelPath}`, {
      scanRunId: ctx.runId,
    });

    return {
      files,
      sourceLabel: source.zipRelPath,
      cleanup: () => ctx.wfs.clearStagingDir(runKey),
    };
  },
};

export default importerZipArchive;
