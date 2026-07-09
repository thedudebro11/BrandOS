import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../core/plugin-runtime/plugin-api";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

const BLOCKED_MESSAGE =
  'importer-instagram.discover() is not implemented — blocked on real Instagram export data. ' +
  "No Instagram data export exists anywhere in this workspace to build and validate a parser against, " +
  "and this project's principle is to never fabricate extraction logic for an undocumented format. " +
  "See app/src/plugins/importer-instagram/BLOCKED.md for exactly what's done vs. missing.";

/**
 * Real plugin registration, real activation (workspace.json modules.instagram),
 * real manifest/version/compatibility checking, real loader integration — all
 * exercised by tests/core/plugin-runtime.test.ts. What's deliberately absent:
 * discover() has no extraction logic, per Phase 7's explicit "do not fabricate
 * integrations" instruction. Calling discover() throws a clear, attributable
 * error rather than silently returning zero files (which would look like a
 * successful-but-empty import instead of an honestly-blocked one).
 */
const importerInstagram: ImporterPlugin = {
  manifest,

  async validateSource(_ctx: PluginContext, _source: ImportSourceRef) {
    return { ok: false, reason: BLOCKED_MESSAGE };
  },

  async discover(_ctx: PluginContext, _source: ImportSourceRef): Promise<DiscoverResult> {
    throw new Error(BLOCKED_MESSAGE);
  },
};

export default importerInstagram;
