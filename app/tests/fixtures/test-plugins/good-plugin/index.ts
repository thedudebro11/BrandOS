import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../../../src/core/plugin-runtime/plugin-api";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

const goodPlugin: ImporterPlugin = {
  manifest,
  async discover(_ctx: PluginContext, _source: ImportSourceRef): Promise<DiscoverResult> {
    return { files: [], sourceLabel: "good-plugin-fixture" };
  },
};

export default goodPlugin;
