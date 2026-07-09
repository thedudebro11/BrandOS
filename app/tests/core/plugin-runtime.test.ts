import { describe, it, expect } from "vitest";
import path from "node:path";
import { WorkspaceDatabase } from "../../src/core/db/connection";
import { runMigrations } from "../../src/core/db/migrate";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { EventBus } from "../../src/core/events/event-bus";
import { Logger } from "../../src/core/logging/logger";
import { discoverPluginManifests, loadPluginsForWorkspace, runPluginCall, PluginExecutionError } from "../../src/core/plugin-runtime/plugin-loader";
import { getPluginHealth, getPluginRegistration, listPluginRegistrations } from "../../src/core/plugin-runtime/plugin-registry";
import { runScan } from "../../src/core/services/import-engine/import-engine";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";

const TEST_PLUGINS_ROOT = path.join(__dirname, "..", "fixtures", "test-plugins");

async function setup(id: string) {
  const ws = makeFixtureWorkspace({ id });
  const wfs = new WorkspaceFs(ws);
  wfs.ensureBrandosDir();
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);
  const bus = new EventBus();
  const logger = new Logger(db, bus);
  return { ws, wfs, db, bus, logger };
}

describe("plugin runtime — discovery, manifests, compatibility", () => {
  it("discovers real plugins under app/src/plugins with valid manifests", () => {
    const found = discoverPluginManifests();
    const ids = found.map((f) => f.manifest.id);
    expect(ids).toContain("importer-generic-folder");
    expect(ids).toContain("importer-zip-archive");
    expect(ids).toContain("importer-instagram");
    expect(ids).toContain("importer-printful");
  });

  it("discovers the good/broken/incompatible test fixture plugins under an override root", () => {
    const found = discoverPluginManifests(TEST_PLUGINS_ROOT);
    const ids = found.map((f) => f.manifest.id).sort();
    expect(ids).toEqual(["broken-plugin", "good-plugin", "incompatible-plugin"]);
  });
});

describe("plugin runtime — activation and error isolation", () => {
  it("activates a plugin with no activatesOn flags in every workspace", async () => {
    const { ws, wfs, db, bus, logger } = await setup("plugin-fixture-activation");
    const plugins = await loadPluginsForWorkspace(ws, db, wfs, bus, logger, TEST_PLUGINS_ROOT);
    expect(plugins.has("good-plugin")).toBe(true);

    const reg = getPluginRegistration(db, "good-plugin");
    expect(reg?.state).toBe("active");

    db.close();
    cleanupWorkspace(ws);
  });

  it("an incompatible engineCompatibility is recorded as error and does not stop other plugins loading", async () => {
    const { ws, wfs, db, bus, logger } = await setup("plugin-fixture-incompatible");
    const plugins = await loadPluginsForWorkspace(ws, db, wfs, bus, logger, TEST_PLUGINS_ROOT);

    expect(plugins.has("incompatible-plugin")).toBe(false);
    expect(plugins.has("good-plugin")).toBe(true); // one bad plugin never blocks the rest

    const reg = getPluginRegistration(db, "incompatible-plugin");
    expect(reg?.state).toBe("error");
    expect(reg?.disabledReason).toContain("requires engine >=");

    db.close();
    cleanupWorkspace(ws);
  });

  it("a plugin whose discover() throws is isolated: the error is wrapped, recorded, and never crashes the caller", async () => {
    const { ws, wfs, db, bus, logger } = await setup("plugin-fixture-broken-discover");
    const plugins = await loadPluginsForWorkspace(ws, db, wfs, bus, logger, TEST_PLUGINS_ROOT);
    const broken = plugins.get("broken-plugin")!;
    expect(broken).toBeDefined();

    await expect(
      runPluginCall(db, "broken-plugin", "discover", () => broken.discover({ workspace: ws, db, wfs, bus, logger, runId: 1 }, { kind: "workspace_root" }))
    ).rejects.toThrow(PluginExecutionError);

    const health = getPluginHealth(db, "broken-plugin");
    expect(health?.lastRunStatus).toBe("error");
    expect(health?.consecutiveFailures).toBe(1);
    expect(health?.totalFailures).toBe(1);

    const reg = getPluginRegistration(db, "broken-plugin");
    expect(reg?.state).toBe("error");

    db.close();
    cleanupWorkspace(ws);
  });

  it("health recovers: consecutiveFailures resets to 0 after a later success", async () => {
    const { ws, wfs, db, bus, logger } = await setup("plugin-fixture-recovery");
    const plugins = await loadPluginsForWorkspace(ws, db, wfs, bus, logger, TEST_PLUGINS_ROOT);
    const broken = plugins.get("broken-plugin")!;
    const good = plugins.get("good-plugin")!;

    await runPluginCall(db, "broken-plugin", "discover", () =>
      broken.discover({ workspace: ws, db, wfs, bus, logger, runId: 1 }, { kind: "workspace_root" })
    ).catch(() => undefined);
    expect(getPluginHealth(db, "broken-plugin")?.consecutiveFailures).toBe(1);

    // A different plugin succeeding must not affect broken-plugin's own health row.
    await runPluginCall(db, "good-plugin", "discover", () =>
      good.discover({ workspace: ws, db, wfs, bus, logger, runId: 2 }, { kind: "workspace_root" })
    );
    expect(getPluginHealth(db, "good-plugin")?.consecutiveFailures).toBe(0);
    expect(getPluginHealth(db, "broken-plugin")?.consecutiveFailures).toBe(1);

    db.close();
    cleanupWorkspace(ws);
  });

  it("the SAME plugin recovers: two failures then a success resets its own consecutiveFailures to 0 while totalFailures stays at 2", async () => {
    const { ws, wfs, db, bus, logger } = await setup("plugin-fixture-same-plugin-recovery");
    await loadPluginsForWorkspace(ws, db, wfs, bus, logger, TEST_PLUGINS_ROOT); // registers plugin_health rows

    await runPluginCall(db, "broken-plugin", "discover", () => Promise.reject(new Error("attempt 1 fails"))).catch(() => undefined);
    await runPluginCall(db, "broken-plugin", "discover", () => Promise.reject(new Error("attempt 2 fails"))).catch(() => undefined);
    let health = getPluginHealth(db, "broken-plugin");
    expect(health?.consecutiveFailures).toBe(2);
    expect(health?.totalFailures).toBe(2);

    // Same plugin ID, this time succeeding — proves recovery is per-plugin
    // state, not a one-shot fixture artifact of a different plugin instance.
    await runPluginCall(db, "broken-plugin", "discover", () => Promise.resolve({ files: [], sourceLabel: "recovered" }));
    health = getPluginHealth(db, "broken-plugin");
    expect(health?.consecutiveFailures).toBe(0);
    expect(health?.totalFailures).toBe(2); // history is preserved, not reset
    expect(health?.totalRuns).toBe(3);
    expect(health?.lastRunStatus).toBe("success");

    db.close();
    cleanupWorkspace(ws);
  });
});

describe("plugin runtime — real Instagram/Printful plugins are honestly blocked, not faked", () => {
  it("both plugins register and activate when their module flag is on, but discover() throws a clear blocked-on-real-data error", async () => {
    const ws = makeFixtureWorkspace({ id: "plugin-fixture-blocked", modules: { assetManagement: true, instagram: true, printful: true } });
    const wfs = new WorkspaceFs(ws);
    wfs.ensureBrandosDir();
    const db = await WorkspaceDatabase.open(wfs.dbPath());
    runMigrations(db);
    const bus = new EventBus();
    const logger = new Logger(db, bus);

    const plugins = await loadPluginsForWorkspace(ws, db, wfs, bus, logger);
    const instagram = plugins.get("importer-instagram")!;
    const printful = plugins.get("importer-printful")!;
    expect(instagram).toBeDefined();
    expect(printful).toBeDefined();

    await expect(instagram.discover({ workspace: ws, db, wfs, bus, logger, runId: 1 }, { kind: "workspace_root" })).rejects.toThrow(
      /blocked on real Instagram export data/
    );
    await expect(printful.discover({ workspace: ws, db, wfs, bus, logger, runId: 1 }, { kind: "workspace_root" })).rejects.toThrow(
      /blocked on a real Printful data export/
    );

    db.close();
    cleanupWorkspace(ws);
  });

  it("both plugins are disabled (not active) in a workspace with the module flags off", async () => {
    const ws = makeFixtureWorkspace({ id: "plugin-fixture-blocked-off" });
    const { db } = await runScan(ws, "manual");

    const regs = listPluginRegistrations(db);
    const instagram = regs.find((r) => r.pluginId === "importer-instagram");
    const printful = regs.find((r) => r.pluginId === "importer-printful");
    expect(instagram?.state).toBe("disabled");
    expect(printful?.state).toBe("disabled");

    db.close();
    cleanupWorkspace(ws);
  });
});
