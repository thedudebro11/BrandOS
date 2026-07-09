import fs from "node:fs";
import path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";
import type { WorkspaceDatabase } from "../db/connection";
import type { WorkspaceFs } from "../fs/workspace-fs";
import type { EventBus } from "../events/event-bus";
import type { Logger } from "../logging/logger";
import type { LoadedWorkspace } from "../types";
import { BRANDOS_ENGINE_VERSION, isImporterPlugin, type ImporterPlugin, type PluginContext, type PluginManifest } from "./plugin-api";
import { versionSatisfies } from "./version";
import { getPluginRegistration, recordPluginRunOutcome, setPluginState, upsertPluginRegistration } from "./plugin-registry";

const PLUGINS_ROOT = path.join(__dirname, "..", "..", "plugins");
const schemaPath = path.join(__dirname, "plugin-manifest.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

let validateFn: ValidateFunction | null = null;
function getValidator(): ValidateFunction {
  if (!validateFn) validateFn = new Ajv({ allErrors: true }).compile(schema);
  return validateFn;
}

export class PluginManifestError extends Error {}
export class PluginExecutionError extends Error {
  constructor(public pluginId: string, message: string, public cause?: unknown) {
    super(message);
  }
}

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  dir: string;
}

/**
 * Scans app/src/plugins/*\/plugin.json, validates every manifest against the
 * schema, and returns the full set found on disk — regardless of whether any
 * workspace currently activates them. Fails loud on a malformed manifest
 * (same "no silent partial state" rule as loadWorkspaceConfig), since a typo
 * in one plugin's manifest should never be allowed to silently vanish that
 * plugin from every workspace.
 */
export function discoverPluginManifests(pluginsRootOverride?: string): DiscoveredPlugin[] {
  const root = pluginsRootOverride ?? PLUGINS_ROOT;
  if (!fs.existsSync(root)) return [];
  const validate = getValidator();
  const found: DiscoveredPlugin[] = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifestPath = path.join(dir, "plugin.json");
    if (!fs.existsSync(manifestPath)) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (err) {
      throw new PluginManifestError(`${manifestPath} is not valid JSON: ${(err as Error).message}`);
    }
    if (!validate(raw)) {
      const details = (validate.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message}`).join("; ");
      throw new PluginManifestError(`${manifestPath} failed validation: ${details}`);
    }
    const manifest = raw as PluginManifest;
    if (manifest.id !== entry.name) {
      throw new PluginManifestError(
        `${manifestPath}: manifest id "${manifest.id}" must match its containing directory name "${entry.name}"`
      );
    }
    found.push({ manifest, dir });
  }
  return found;
}

/** Dependency + engine-compatibility checks against the full discovered set. Returns a reason string if incompatible, null if OK. */
function checkCompatibility(manifest: PluginManifest, allManifests: PluginManifest[]): string | null {
  if (!versionSatisfies(BRANDOS_ENGINE_VERSION, manifest.engineCompatibility)) {
    return `requires engine >= ${manifest.engineCompatibility}, running ${BRANDOS_ENGINE_VERSION}`;
  }
  for (const dep of manifest.dependencies ?? []) {
    const found = allManifests.find((m) => m.id === dep.pluginId);
    if (!found) return `missing dependency "${dep.pluginId}"`;
    if (!versionSatisfies(found.version, dep.minVersion)) {
      return `dependency "${dep.pluginId}" requires >= ${dep.minVersion}, found ${found.version}`;
    }
  }
  return null;
}

function isActiveForWorkspace(manifest: PluginManifest, workspace: LoadedWorkspace): boolean {
  if (manifest.activatesOn.length === 0) return true;
  return manifest.activatesOn.every((flag) => workspace.config.modules[flag] === true);
}

/**
 * Loads and activates every plugin relevant to one workspace: discovers all
 * manifests, checks compatibility, resolves per-workspace activation off
 * `modules` flags, registers state in the workspace DB (plugin_registrations),
 * and — for Importer-type plugins only, since that's the one contract with a
 * working runtime this phase — requires the implementation module and calls
 * activate() through the error-isolation wrapper.
 *
 * A single plugin's manifest error, incompatibility, or activate() throw is
 * recorded and skipped; it never stops the rest of the plugin set from
 * loading, and never throws out of this function.
 */
export async function loadPluginsForWorkspace(
  workspace: LoadedWorkspace,
  db: WorkspaceDatabase,
  wfs: WorkspaceFs,
  bus: EventBus,
  logger: Logger,
  pluginsRootOverride?: string
): Promise<Map<string, ImporterPlugin>> {
  const discovered = discoverPluginManifests(pluginsRootOverride);
  const allManifests = discovered.map((d) => d.manifest);
  const active = new Map<string, ImporterPlugin>();

  for (const { manifest, dir } of discovered) {
    const compatIssue = checkCompatibility(manifest, allManifests);
    if (compatIssue) {
      upsertPluginRegistration(db, manifest, "error", compatIssue);
      logger.warn("plugin.incompatible", `Plugin "${manifest.id}" not loaded: ${compatIssue}`);
      continue;
    }

    if (!isActiveForWorkspace(manifest, workspace)) {
      upsertPluginRegistration(db, manifest, "disabled", `module flag(s) [${manifest.activatesOn.join(", ")}] not enabled`);
      continue;
    }

    if (manifest.type !== "Importer") {
      // No runtime support yet for Classifier/ReportTemplate/VaultTemplate — see plugin-api.ts doc comment.
      upsertPluginRegistration(db, manifest, "discovered", "no runtime support yet for this plugin type");
      continue;
    }

    upsertPluginRegistration(db, manifest, "active", null);

    const ctx: PluginContext = { workspace, db, wfs, bus, logger, runId: null };
    try {
      // Dynamic import() rather than require(): works identically under tsx,
      // the tsc-compiled build, AND vitest's Vite-based module graph, which
      // does not support require()-ing an arbitrary absolute .ts path outside
      // its own transform pipeline (confirmed by direct test — require()
      // throws MODULE_NOT_FOUND there even though the file plainly exists).
      const mod = await import(/* @vite-ignore */ path.join(dir, "index"));
      const instance: ImporterPlugin = mod.default ?? mod.plugin ?? mod;
      if (!isImporterPlugin(instance)) {
        throw new Error(`module at ${dir}/index does not export a valid ImporterPlugin`);
      }
      if (instance.activate) {
        await runPluginCall(db, manifest.id, "activate", () => Promise.resolve(instance.activate!(ctx)));
      }
      active.set(manifest.id, instance);
      bus.emit("plugin.loaded", { workspaceId: workspace.config.id, pluginId: manifest.id });
    } catch (err) {
      const message = (err as Error).message;
      setPluginState(db, manifest.id, "error", message);
      recordPluginRunOutcome(db, manifest.id, "error", `load/activate failed: ${message}`);
      logger.error("plugin.load_failed", `Plugin "${manifest.id}" failed to load: ${message}`);
      bus.emit("plugin.failed", { workspaceId: workspace.config.id, pluginId: manifest.id, message });
    }
  }

  return active;
}

/**
 * The error-isolation choke point: every call the runtime makes into a
 * plugin's own code goes through here. Success and failure are both recorded
 * to plugin_health; a failure never escapes as a raw plugin exception — it's
 * wrapped in PluginExecutionError so callers get a consistent, attributable
 * error type regardless of what the plugin itself threw.
 */
export async function runPluginCall<T>(
  db: WorkspaceDatabase,
  pluginId: string,
  callName: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    recordPluginRunOutcome(db, pluginId, "success", `${callName} succeeded`);
    return result;
  } catch (err) {
    const message = (err as Error).message;
    recordPluginRunOutcome(db, pluginId, "error", `${callName} failed: ${message}`);
    const health = getPluginRegistration(db, pluginId);
    if (health && health.state !== "disabled") setPluginState(db, pluginId, "error", message);
    throw new PluginExecutionError(pluginId, `Plugin "${pluginId}".${callName}() failed: ${message}`, err);
  }
}
