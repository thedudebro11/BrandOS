import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../../../src/core/plugin-runtime/plugin-api";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

const brokenPlugin: ImporterPlugin = {
  manifest,
  async discover(_ctx: PluginContext, _source: ImportSourceRef): Promise<DiscoverResult> {
    throw new Error("broken-plugin always fails — this is intentional test fixture behavior");
  },
};

export default brokenPlugin;
