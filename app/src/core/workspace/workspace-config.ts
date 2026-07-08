import fs from "node:fs";
import path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";
import type { LoadedWorkspace, WorkspaceConfig } from "../types";

const schemaPath = path.join(__dirname, "workspace.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

let validateFn: ValidateFunction | null = null;
function getValidator(): ValidateFunction {
  if (!validateFn) {
    const ajv = new Ajv({ allErrors: true });
    validateFn = ajv.compile(schema);
  }
  return validateFn;
}

export class WorkspaceConfigError extends Error {}

/**
 * Loads and validates one workspace's workspace.json. Per
 * app/specs/18_WORKSPACE_CONFIG_SCHEMA.md: a workspace that fails validation
 * must not silently start with partial config — this throws with the specific
 * validation errors rather than returning a best-effort partial object.
 */
export function loadWorkspaceConfig(workspaceDir: string): LoadedWorkspace {
  const configPath = path.join(workspaceDir, "workspace.json");
  if (!fs.existsSync(configPath)) {
    throw new WorkspaceConfigError(`No workspace.json found at ${configPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    throw new WorkspaceConfigError(
      `workspace.json at ${configPath} is not valid JSON: ${(err as Error).message}`
    );
  }

  const validate = getValidator();
  if (!validate(raw)) {
    const details = (validate.errors ?? [])
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new WorkspaceConfigError(`workspace.json at ${configPath} failed validation: ${details}`);
  }

  const config = raw as WorkspaceConfig;
  const folderName = path.basename(workspaceDir);
  if (config.id.toLowerCase() !== folderName.toLowerCase()) {
    throw new WorkspaceConfigError(
      `workspace.json id "${config.id}" does not match containing folder "${folderName}" (case-insensitive match required, per app/specs/18_WORKSPACE_CONFIG_SCHEMA.md)`
    );
  }

  return { config, rootDir: workspaceDir, configPath };
}
