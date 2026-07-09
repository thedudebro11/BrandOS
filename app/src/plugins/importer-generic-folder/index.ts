import { scanWorkspaceFiles } from "../../core/services/file-scanner/scanner";
import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../core/plugin-runtime/plugin-api";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

/**
 * The reference Importer implementation (Phase 7 spec: "future importers
 * should require minimal new code"). Its entire job is discover() — walking
 * the workspace's evidence tree via the existing, already-tested
 * scanWorkspaceFiles() — everything after that is the shared import pipeline.
 */
const importerGenericFolder: ImporterPlugin = {
  manifest,

  async discover(ctx: PluginContext, source: ImportSourceRef): Promise<DiscoverResult> {
    if (source.kind !== "workspace_root") {
      throw new Error(`importer-generic-folder only supports source.kind "workspace_root", got "${source.kind}"`);
    }
    const { files, stats } = scanWorkspaceFiles(ctx.wfs, ctx.logger, ctx.runId ?? 0);
    ctx.logger.info(
      "import.discovered",
      `Generic Folder Importer found ${files.length} file(s) (${stats.skippedGenerated + stats.skippedIgnored} skipped)`,
      { scanRunId: ctx.runId }
    );
    return { files, sourceLabel: ctx.wfs.rootDir };
  },
};

export default importerGenericFolder;
