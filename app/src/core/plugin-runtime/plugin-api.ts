import type { WorkspaceDatabase } from "../db/connection";
import type { WorkspaceFs } from "../fs/workspace-fs";
import type { EventBus } from "../events/event-bus";
import type { Logger } from "../logging/logger";
import type { DiscoveredFile, LoadedWorkspace } from "../types";

/**
 * Phase 7 plugin contracts. BrandOS Core depends on these interfaces only —
 * never on a specific plugin's implementation (app/specs/19_PLUGIN_ARCHITECTURE.md
 * "Rule"). Core has no `if (workspace.modules.printful)` branch anywhere;
 * activation is entirely data-driven off `PluginManifest.activatesOn` against
 * a workspace's `modules` flags, resolved by the loader, not by core code.
 *
 * Only the Importer contract has a working runtime this phase. Classifier /
 * ReportTemplate / VaultTemplate remain interface-only (unchanged from
 * app/specs/19_PLUGIN_ARCHITECTURE.md) — no plugin of those types exists yet,
 * and per this project's standing "don't build a mechanism before a second
 * real case exists to validate it against" rule (the same reasoning that
 * deferred the loader itself across Phases 2-6), building runtime support for
 * contract types with zero real implementations would be speculative.
 */
export type PluginType = "Importer" | "Classifier" | "ReportTemplate" | "VaultTemplate";

export type PluginState = "discovered" | "active" | "disabled" | "error";

/** The engine's own version, checked against each manifest's engineCompatibility range. */
export const BRANDOS_ENGINE_VERSION = "1.0.0";

export interface PluginDependency {
  pluginId: string;
  /** A minimum-version string, checked as "installed dependency version >= this", per the SDK docs. */
  minVersion: string;
}

/** The validated shape of every plugin.json. See app/docs/PLUGIN_SDK.md for the full schema and examples. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  /** Free-text capability tags a plugin declares, e.g. "discover", "incremental", "idempotent". Informational + used by health/SDK tooling; the loader does not gate activation on these. */
  capabilities: string[];
  /** workspace.json `modules` flags required for this plugin to activate in a given workspace. Empty array = always active. */
  activatesOn: string[];
  /** A minimum-version string checked against BRANDOS_ENGINE_VERSION. */
  engineCompatibility: string;
  dependencies?: PluginDependency[];
}

/** Everything a plugin lifecycle/import call receives — scoped to one workspace. `runId` correlates log lines and events to one scan_runs row; it's null for activate()/deactivate() (no run exists yet) and set for discover(). */
export interface PluginContext {
  workspace: LoadedWorkspace;
  db: WorkspaceDatabase;
  wfs: WorkspaceFs;
  bus: EventBus;
  logger: Logger;
  runId: number | null;
}

/** Where an importer should look. Kept a closed union so new source kinds are a deliberate, typed addition. */
export type ImportSourceRef =
  | { kind: "workspace_root" }
  | { kind: "zip"; zipRelPath: string };

export interface DiscoverResult {
  /** Files ready for the shared import pipeline — same shape the folder scanner has always produced. */
  files: DiscoveredFile[];
  /** Human-readable description of what was imported from, stored on every import_runs row. */
  sourceLabel: string;
  /** Called by the orchestrator once every file has been through the pipeline. For extraction-based sources (ZIP) this removes scratch files; the orchestrator doesn't need to know why. */
  cleanup?: () => void;
}

/**
 * The only plugin contract with a working runtime this phase. A conforming
 * plugin's entire job is discover() — turning some source into DiscoveredFile
 * records. Everything after discovery (hash, metadata, asset ID, relationship,
 * timeline, knowledge update, validation) is the shared import pipeline
 * (app/src/core/services/import-pipeline/) — no importer plugin re-implements
 * any of that, by construction: the contract doesn't expose a way to.
 */
export interface ImporterPlugin {
  manifest: PluginManifest;
  /** Optional setup hook, e.g. verifying a config value exists. Errors here mark the plugin 'error', never crash the host. */
  activate?(ctx: PluginContext): Promise<void> | void;
  deactivate?(ctx: PluginContext): Promise<void> | void;
  /** Cheap pre-check ("does this zip exist and look readable") before a real discover() run. */
  validateSource?(ctx: PluginContext, source: ImportSourceRef): Promise<{ ok: boolean; reason?: string }>;
  discover(ctx: PluginContext, source: ImportSourceRef): Promise<DiscoverResult>;
}

export function isImporterPlugin(plugin: { manifest: PluginManifest }): plugin is ImporterPlugin {
  return plugin.manifest.type === "Importer" && typeof (plugin as ImporterPlugin).discover === "function";
}
