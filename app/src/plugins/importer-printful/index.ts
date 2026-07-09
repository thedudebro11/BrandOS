import type { DiscoverResult, ImporterPlugin, ImportSourceRef, PluginContext, PluginManifest } from "../../core/plugin-runtime/plugin-api";
import manifestJson from "./plugin.json";

const manifest = manifestJson as PluginManifest;

const BLOCKED_MESSAGE =
  'importer-printful.discover() is not implemented — blocked on a real Printful data export. ' +
  'The workspace\'s "Printiful Invoices" folder contains real PDF invoices, but those are already ' +
  "picked up as ordinary evidence by the Generic Folder Importer; they are not a structured Printful " +
  "API/CSV export (order IDs, SKUs, shipment tracking, timestamps) this plugin would need to produce " +
  "richer, order-linked relationships than a PDF alone can offer. No such structured export exists in " +
  "this workspace, and this project's principle is to never fabricate extraction logic for an assumed " +
  "format. See app/src/plugins/importer-printful/BLOCKED.md for exactly what's done vs. missing.";

/**
 * Real plugin registration, real activation (workspace.json modules.printful),
 * real manifest/version/compatibility checking, real loader integration — all
 * exercised by tests/core/plugin-runtime.test.ts. What's deliberately absent:
 * discover() has no extraction logic, per Phase 7's explicit "do not fabricate
 * integrations" instruction.
 */
const importerPrintful: ImporterPlugin = {
  manifest,

  async validateSource(_ctx: PluginContext, _source: ImportSourceRef) {
    return { ok: false, reason: BLOCKED_MESSAGE };
  },

  async discover(_ctx: PluginContext, _source: ImportSourceRef): Promise<DiscoverResult> {
    throw new Error(BLOCKED_MESSAGE);
  },
};

export default importerPrintful;
