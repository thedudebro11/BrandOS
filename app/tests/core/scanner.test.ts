import { describe, it, expect, vi } from "vitest";
import { scanWorkspaceFiles } from "../../src/core/services/file-scanner/scanner";
import { WorkspaceFs } from "../../src/core/fs/workspace-fs";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

function noopLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

describe("file scanner", () => {
  it("discovers files recursively and skips default-ignored + generated paths", () => {
    const ws = makeFixtureWorkspace({ id: "scanner-fixture" });
    writeFixtureFile(ws, "root.txt", "a");
    writeFixtureFile(ws, "nested/deep/file.txt", "b");
    writeFixtureFile(ws, ".git/config", "should be ignored");
    writeFixtureFile(ws, "Thumbs.db", "should be ignored");
    writeFixtureFile(ws, ".brandos/archive.db", "generated, should be ignored");

    const wfs = new WorkspaceFs(ws);
    const { files, stats } = scanWorkspaceFiles(wfs, noopLogger(), 1);

    const relPaths = files.map((f) => f.relPath.replace(/\\/g, "/")).sort();
    expect(relPaths).toEqual(["nested/deep/file.txt", "root.txt"]);
    expect(stats.skippedGenerated).toBeGreaterThanOrEqual(1);
    expect(stats.skippedIgnored).toBeGreaterThanOrEqual(2);
    cleanupWorkspace(ws);
  });

  it("captures size and hidden-file flag correctly", () => {
    const ws = makeFixtureWorkspace({ id: "scanner-fixture-2" });
    writeFixtureFile(ws, "visible.txt", "12345");
    writeFixtureFile(ws, ".hidden-file.txt", "hidden content");

    const wfs = new WorkspaceFs(ws);
    const { files } = scanWorkspaceFiles(wfs, noopLogger(), 1);

    const visible = files.find((f) => f.filename === "visible.txt")!;
    const hidden = files.find((f) => f.filename === ".hidden-file.txt")!;
    expect(visible.sizeBytes).toBe(5);
    expect(visible.isHidden).toBe(false);
    expect(hidden.isHidden).toBe(true);
    cleanupWorkspace(ws);
  });

  it("reports empty directories without erroring", () => {
    const ws = makeFixtureWorkspace({ id: "scanner-fixture-3" });
    const fs = require("node:fs");
    const path = require("node:path");
    fs.mkdirSync(path.join(ws.rootDir, "empty-dir"), { recursive: true });

    const wfs = new WorkspaceFs(ws);
    const { stats } = scanWorkspaceFiles(wfs, noopLogger(), 1);
    expect(stats.emptyDirs).toBeGreaterThanOrEqual(1);
    cleanupWorkspace(ws);
  });
});
