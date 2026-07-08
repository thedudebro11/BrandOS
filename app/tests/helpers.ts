import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { LoadedWorkspace, WorkspaceConfig } from "../src/core/types";

let counter = 0;

/** Creates a throwaway workspace directory under the OS temp dir, with a valid workspace.json. */
export function makeFixtureWorkspace(overrides: Partial<WorkspaceConfig> = {}): LoadedWorkspace {
  const id = overrides.id ?? `fixture-${Date.now()}-${counter++}`;
  const rootDir = path.join(os.tmpdir(), `brandos-test-${id}`);
  fs.rmSync(rootDir, { recursive: true, force: true });
  fs.mkdirSync(rootDir, { recursive: true });

  const config: WorkspaceConfig = {
    name: "Fixture Workspace",
    type: "brand",
    status: "active",
    modules: { assetManagement: true },
    ...overrides,
    id, // id must always match the folder basename — wins over any overrides.id
  };

  const configPath = path.join(rootDir, "workspace.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { config, rootDir, configPath };
}

export function writeFixtureFile(workspace: LoadedWorkspace, relPath: string, content: string | Buffer): string {
  const full = path.join(workspace.rootDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

export function cleanupWorkspace(workspace: LoadedWorkspace): void {
  fs.rmSync(workspace.rootDir, { recursive: true, force: true });
}
