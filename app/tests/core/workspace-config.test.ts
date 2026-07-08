import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadWorkspaceConfig, WorkspaceConfigError } from "../../src/core/workspace/workspace-config";
import { discoverWorkspaces } from "../../src/core/workspace/workspace-registry";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

describe("workspace config", () => {
  it("loads the real Fatletic workspace.json", () => {
    const ws = loadWorkspaceConfig(path.join(WORKSPACES_ROOT, "Fatletic"));
    expect(ws.config.id).toBe("fatletic");
    expect(ws.config.modules.assetManagement).toBe(true);
  });

  it("loads the real PrecisionWorkz stub workspace.json", () => {
    const ws = loadWorkspaceConfig(path.join(WORKSPACES_ROOT, "PrecisionWorkz"));
    expect(ws.config.id).toBe("precisionworkz");
    expect(ws.config.status).toBe("planned");
    expect(Object.values(ws.config.modules).every((v) => v === false)).toBe(true);
  });

  it("discovers both real workspaces via the registry", () => {
    const { workspaces, skipped } = discoverWorkspaces(WORKSPACES_ROOT);
    const ids = workspaces.map((w) => w.config.id).sort();
    expect(ids).toEqual(["fatletic", "precisionworkz"]);
    expect(skipped).toEqual([]);
  });

  it("throws a descriptive error for missing workspace.json", () => {
    expect(() => loadWorkspaceConfig("/nonexistent/path/xyz")).toThrow(WorkspaceConfigError);
  });

  it("throws when id does not match the folder name", () => {
    const ws = makeFixtureWorkspace({ id: "mismatch-fixture" });
    const fs = require("node:fs");
    fs.writeFileSync(ws.configPath, JSON.stringify({ ...ws.config, id: "totally-different" }));
    expect(() => loadWorkspaceConfig(ws.rootDir)).toThrow(/does not match containing folder/);
    cleanupWorkspace(ws);
  });

  it("throws on invalid JSON", () => {
    const ws = makeFixtureWorkspace({ id: "bad-json-fixture" });
    const fs = require("node:fs");
    fs.writeFileSync(ws.configPath, "{ not valid json");
    expect(() => loadWorkspaceConfig(ws.rootDir)).toThrow(/not valid JSON/);
    cleanupWorkspace(ws);
  });
});
