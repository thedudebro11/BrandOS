import fs from "node:fs";
import path from "node:path";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import type { DiscoveredFile } from "../../types";
import type { Logger } from "../../logging/logger";
import { isDefaultIgnored, isHiddenName, extensionOf } from "./ignore-rules";

export interface ScanStats {
  discovered: number;
  skippedGenerated: number;
  skippedIgnored: number;
  emptyDirs: number;
  brokenShortcuts: number;
}

/**
 * Recursively, safely walks a workspace's evidence tree. Read-only: only ever
 * calls readdir/lstat/stat. Never renames, deletes, or writes anything.
 * Skips BrandOS-generated paths (.brandos/, the Obsidian vault, the organized
 * archive) and default-ignored names (.git, node_modules, OS cruft).
 */
export function scanWorkspaceFiles(
  wfs: WorkspaceFs,
  logger: Logger,
  scanRunId: number
): { files: DiscoveredFile[]; stats: ScanStats } {
  const files: DiscoveredFile[] = [];
  const stats: ScanStats = { discovered: 0, skippedGenerated: 0, skippedIgnored: 0, emptyDirs: 0, brokenShortcuts: 0 };

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      logger.error("scan.dir_unreadable", `Cannot read directory: ${dir} (${(err as Error).message})`, {
        scanRunId,
      });
      return;
    }

    if (entries.length === 0) {
      stats.emptyDirs++;
      logger.info("scan.empty_dir", `Empty directory: ${dir}`, { scanRunId });
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);

      if (wfs.isGeneratedPath(absPath)) {
        stats.skippedGenerated++;
        continue;
      }
      if (isDefaultIgnored(entry.name)) {
        stats.skippedIgnored++;
        continue;
      }
      // workspace.json and README.md at the workspace root are BrandOS/platform
      // config and documentation, not evidence — never cataloged as assets.
      // (A README.md nested deeper in the evidence tree is a real business
      // document and IS scanned normally.)
      if (dir === wfs.rootDir && (entry.name === "workspace.json" || entry.name === "README.md")) {
        stats.skippedIgnored++;
        continue;
      }

      if (entry.isSymbolicLink()) {
        try {
          fs.statSync(absPath); // resolves the link; throws if broken
        } catch {
          stats.brokenShortcuts++;
          logger.warn("scan.broken_shortcut", `Broken shortcut/symlink: ${absPath}`, { scanRunId });
          continue;
        }
      }

      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }

      if (!entry.isFile()) continue; // skip sockets, fifos, etc.

      let st: fs.Stats;
      try {
        st = fs.statSync(absPath);
      } catch (err) {
        logger.error("scan.stat_failed", `Cannot stat file: ${absPath} (${(err as Error).message})`, {
          scanRunId,
        });
        continue;
      }

      const relPath = path.relative(wfs.rootDir, absPath);
      files.push({
        absPath,
        relPath,
        filename: entry.name,
        extension: extensionOf(entry.name),
        sizeBytes: st.size,
        createdAt: st.birthtime ? st.birthtime.toISOString() : null,
        modifiedAt: st.mtime ? st.mtime.toISOString() : null,
        accessedAt: st.atime ? st.atime.toISOString() : null,
        isHidden: isHiddenName(entry.name),
        isBrokenShortcut: false,
      });
      stats.discovered++;
    }
  }

  walk(wfs.rootDir);
  return { files, stats };
}
