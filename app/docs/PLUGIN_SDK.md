# BrandOS Plugin SDK

Phase 7. This is the practical guide to building a plugin against the runtime in `app/src/core/plugin-runtime/`. It documents what actually exists and is tested today — not an aspirational API. Where a plugin contract has no working runtime yet (Classifier, ReportTemplate, VaultTemplate), that's stated explicitly rather than glossed over.

## Core principle

BrandOS Core (`app/src/core/`) never contains a workspace/brand/source-specific literal — no `if (workspace.modules.printful)`, no `"instagram"` string outside a plugin's own manifest. Core depends only on the `ImporterPlugin` interface. A plugin lives entirely under `app/src/plugins/<id>/` and is the only place that knows about its own external format.

## Interfaces

All types live in `app/src/core/plugin-runtime/plugin-api.ts`.

```ts
export type PluginType = "Importer" | "Classifier" | "ReportTemplate" | "VaultTemplate";

export interface PluginManifest {
  id: string;                 // must match the plugin's directory name exactly
  name: string;
  version: string;            // X.Y.Z
  type: PluginType;
  description: string;
  capabilities: string[];     // free-text, informational — see "Capabilities" below
  activatesOn: string[];      // workspace.json `modules` flags required to activate; [] = always active
  engineCompatibility: string; // minimum engine version, checked against BRANDOS_ENGINE_VERSION
  dependencies?: { pluginId: string; minVersion: string }[];
}

export interface PluginContext {
  workspace: LoadedWorkspace;
  db: WorkspaceDatabase;
  wfs: WorkspaceFs;
  bus: EventBus;
  logger: Logger;
  runId: number | null;       // null during activate()/deactivate(); set during discover()
}

export type ImportSourceRef =
  | { kind: "workspace_root" }
  | { kind: "zip"; zipRelPath: string };

export interface DiscoverResult {
  files: DiscoveredFile[];
  sourceLabel: string;
  cleanup?: () => void;       // called once the pipeline has processed every file
}

export interface ImporterPlugin {
  manifest: PluginManifest;
  activate?(ctx: PluginContext): Promise<void> | void;
  deactivate?(ctx: PluginContext): Promise<void> | void;
  validateSource?(ctx: PluginContext, source: ImportSourceRef): Promise<{ ok: boolean; reason?: string }>;
  discover(ctx: PluginContext, source: ImportSourceRef): Promise<DiscoverResult>;
}
```

**Only `ImporterPlugin` has a working runtime this phase.** `Classifier`, `ReportTemplate`, and `VaultTemplate` remain the same interfaces defined in `app/specs/19_PLUGIN_ARCHITECTURE.md` since Phase 1 — no loader support exists for them, because no second real implementation of any of them exists yet to validate a loader against (the same "don't build a mechanism for one hypothetical case" rule that deferred the Importer loader itself across Phases 2–6).

## The manifest (`plugin.json`)

Every plugin directory needs exactly one `plugin.json`, validated against `app/src/core/plugin-runtime/plugin-manifest.schema.json` at discovery time. A failing manifest throws `PluginManifestError` and stops the whole loader — a typo in one plugin's manifest must never silently vanish that plugin, so it's treated as loud-fail, not skip-with-a-warning.

```json
{
  "id": "importer-generic-folder",
  "name": "Generic Folder Importer",
  "version": "1.0.0",
  "type": "Importer",
  "description": "Recursively discovers every file in a workspace's evidence tree.",
  "capabilities": ["discover", "incremental", "idempotent"],
  "activatesOn": [],
  "engineCompatibility": "1.0.0"
}
```

Rules:
- `id` must exactly match the plugin's directory name.
- `version` and `engineCompatibility` must be exact `X.Y.Z` strings (the loader's `versionSatisfies()` in `version.ts` does a plain `>=` comparison — no ranges, no pre-release tags).
- `activatesOn: []` means always active. A non-empty array lists `workspace.json` `modules` flags that must ALL be `true` for this plugin to activate in a given workspace.

## Lifecycle

1. **Discovery** — `discoverPluginManifests()` scans `app/src/plugins/*/plugin.json` on every `loadPluginsForWorkspace()` call. This is per-process, not cached across workspaces.
2. **Compatibility check** — engine version + every declared dependency's version. A failure here marks the plugin `error` in `plugin_registrations` and it never loads, but every other plugin still does.
3. **Activation check** — `activatesOn` flags checked against the specific workspace's `modules`. Not activating is not an error; it's recorded as `disabled` with a human-readable reason.
4. **Module load** — the plugin's `index.ts` is loaded via dynamic `import()` (not `require()` — see "Why dynamic import()" below) and `activate()` is called if defined, through the error-isolation wrapper.
5. **Use** — the orchestrator (`app/src/core/services/import-pipeline/import-orchestrator.ts`) calls `discover()` once per import run.
6. **Deactivation** — `deactivate()` exists in the contract but nothing calls it yet; no plugin today needs teardown, and the runtime doesn't yet have a "workspace closing" lifecycle event to hang it off. Documented here as a known gap, not hidden.

### Why dynamic `import()`, not `require()`

`require()` of an arbitrary absolute `.ts` path works under `tsx` but fails under `vitest`'s Vite-based module graph (`MODULE_NOT_FOUND`, confirmed by direct test during Phase 7 development) — Vite doesn't let `require()` resolve files outside its own transform pipeline. Dynamic `import()` works identically under `tsx`, the `tsc`-compiled build, and `vitest`. This is the same category of environment constraint as ADR-009 (sql.js) and ADR-011 (local web app) — a real tooling limitation, worked around deliberately and documented, not silently.

## Capabilities

`capabilities: string[]` in the manifest is informational metadata — a plugin's own honest declaration of what it can do (`"discover"`, `"incremental"`, `"idempotent"`, or, for a blocked plugin, `"registered"` only). The loader does not gate any behavior on this field today; it exists for humans (and future tooling, e.g. a Mission Control plugin health widget) reading `plugin_registrations.manifest_json` to understand a plugin's real maturity at a glance, especially useful for a plugin like `importer-instagram` whose manifest legitimately does NOT claim `"discover"`.

## Events

Defined in `app/src/core/events/event-bus.ts`. An importer plugin doesn't need to emit these itself — the shared pipeline and orchestrator emit them around every plugin call:

| Event | Emitted by | When |
|---|---|---|
| `plugin.loaded` | loader | after a plugin's `activate()` succeeds |
| `plugin.failed` | loader | after any plugin lifecycle call throws |
| `import.started` | orchestrator | after `discover()` returns, before pipeline processing |
| `import.completed` | orchestrator | after the pipeline finishes (status `completed` or `failed`) |
| `file.discovered`, `hash.computed`, `metadata.extracted`, `asset.created`/`asset.updated`, `timeline.updated`, `relationship.updated`, `classification.assigned`, `tags.assigned` | shared pipeline | per file / per stage, same events every scan has always emitted |

A plugin can subscribe to any of these via `ctx.bus.on(...)` inside `activate()` if it needs to react to pipeline progress — no importer built so far has needed to.

## Configuration

There is no separate plugin-config file format yet. A plugin's only configuration input today is the workspace's own `modules` flags (for activation) and whatever it reads directly off `ctx.workspace.config` in its own code — e.g. a future Printful importer might read a workspace-specific API credential from a `paths`/custom field once real extraction is built. No plugin needs more than this yet, so a dedicated config schema per plugin was not built ahead of a real need for one.

## Error handling

Every call the runtime makes into a plugin — `activate()`, `discover()` — goes through `runPluginCall()` in `plugin-loader.ts`. This is the one and only place a plugin's own exception is caught:

```ts
export async function runPluginCall<T>(db, pluginId, callName, fn: () => Promise<T>): Promise<T>
```

- Success: recorded to `plugin_health` (`last_run_status = 'success'`, `consecutive_failures` reset to 0) and to the `plugin_health_events` log.
- Failure: recorded the same way (`last_run_status = 'error'`, `consecutive_failures` incremented, `plugin_registrations.state` set to `'error'`), then re-thrown as `PluginExecutionError(pluginId, message, cause)` — never the plugin's raw exception. A caller (the orchestrator, a CLI command) always gets a consistent, attributable error type regardless of what a plugin's own code threw.

**A plugin's failure never crashes another plugin or another workspace.** Each `loadPluginsForWorkspace()` call catches per-plugin during activation (one bad plugin is skipped, logged, and the rest still load); each `runImport()` call is scoped to one workspace's own `WorkspaceDatabase` connection, so a thrown error there only fails that one import run.

## Logging

Every plugin receives `ctx.logger`, the same `Logger` class every core engine uses (`app/src/core/logging/logger.ts`) — `.info()`/`.warn()`/`.error()`, each persisted to the workspace's `logs` table and echoed to the console. Pass `{ scanRunId: ctx.runId }` so a plugin's log lines correlate to the same run as the rest of the pipeline's logging.

## Testing

A conforming Importer plugin should have, at minimum (see `tests/core/plugin-runtime.test.ts` and `tests/core/importer-zip-archive.test.ts` for the worked examples this phase built):

- **Unit**: `discover()` called directly against a small real fixture, asserting the exact `DiscoveredFile[]` shape returned.
- **Integration**: run through `runImport()`/`runScan()` end-to-end against a fixture workspace, asserting real assets/relationships/duplicates land in the database.
- **Validation**: `validateSource()` (if implemented) correctly rejects a bad/missing source before a real `discover()` call is attempted.
- **Failure**: a deliberately broken source (missing file, malformed archive) is handled as a clean thrown error, not a crash — and `plugin_health` reflects it.
- **Recovery**: after a failed run, a subsequent successful run resets `consecutive_failures` to 0.
- **Compatibility**: a manifest with an incompatible `engineCompatibility` or missing dependency is correctly skipped (state `'error'`) without stopping other plugins from loading.

## Worked example: the Generic Folder Importer

`app/src/plugins/importer-generic-folder/` is the reference implementation every other Importer plugin should read first. Its entire `discover()` is:

```ts
async discover(ctx: PluginContext, source: ImportSourceRef): Promise<DiscoverResult> {
  if (source.kind !== "workspace_root") {
    throw new Error(`importer-generic-folder only supports source.kind "workspace_root", got "${source.kind}"`);
  }
  const { files } = scanWorkspaceFiles(ctx.wfs, ctx.logger, ctx.runId ?? 0);
  return { files, sourceLabel: ctx.wfs.rootDir };
}
```

That's the whole plugin. Everything after discovery — hashing, metadata extraction, asset ID assignment, relationship detection, timeline resolution, classification, tagging, knowledge validation — is the shared import pipeline (`app/src/core/services/import-pipeline/`), which every importer gets for free by conforming to the contract. `app/src/plugins/importer-zip-archive/` is a second, slightly richer worked example: it shows the `cleanup` hook in action (removing extracted scratch files after the pipeline is done with them) and the `<zipRelPath>::<entryName>` provenance convention for citing an asset back to exactly which archive member produced it.

## What's still missing (stated honestly)

- No config-file format beyond `modules` flags (see "Configuration" above) — not needed yet.
- No `deactivate()` caller — no workspace-closing lifecycle event exists yet.
- No runtime support for `Classifier`/`ReportTemplate`/`VaultTemplate` plugin types.
- No plugin marketplace/versioning-conflict resolution beyond a flat `>=` check — fine for a handful of first-party plugins, would need real thought before a third-party plugin ecosystem existed.
