import { describe, it, expect } from "vitest";
import path from "node:path";
import { WorkspaceDatabase } from "../../src/core/db/connection";
import { runMigrations } from "../../src/core/db/migrate";
import { makeFixtureWorkspace, cleanupWorkspace } from "../helpers";

describe("database migrations", () => {
  it("creates all expected tables on a fresh database", async () => {
    const ws = makeFixtureWorkspace({ id: "migrate-fixture" });
    const dbPath = path.join(ws.rootDir, ".brandos", "archive.db");
    const db = await WorkspaceDatabase.open(dbPath);

    const applied = runMigrations(db);
    expect(applied).toContain("0001_init.sql");

    const tables = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .map((r) => r.name)
      .sort();

    for (const expected of [
      "workspace",
      "assets",
      "hash_checks",
      "duplicate_groups",
      "duplicate_group_members",
      "metadata",
      "relationships",
      "timeline_events",
      "cases",
      "case_links",
      "case_missing_evidence",
      "plugins",
      "scan_runs",
      "logs",
    ]) {
      expect(tables).toContain(expected);
    }
    db.close();
    cleanupWorkspace(ws);
  });

  it("is idempotent — running migrations twice applies nothing the second time", async () => {
    const ws = makeFixtureWorkspace({ id: "migrate-fixture-2" });
    const dbPath = path.join(ws.rootDir, ".brandos", "archive.db");
    const db = await WorkspaceDatabase.open(dbPath);
    runMigrations(db);
    const secondRun = runMigrations(db);
    expect(secondRun).toEqual([]);
    db.close();
    cleanupWorkspace(ws);
  });

  it("persists to disk and reloads correctly", async () => {
    const ws = makeFixtureWorkspace({ id: "migrate-fixture-3" });
    const dbPath = path.join(ws.rootDir, ".brandos", "archive.db");
    const db1 = await WorkspaceDatabase.open(dbPath);
    runMigrations(db1);
    db1.run("INSERT INTO scan_runs (run_key) VALUES (?)", ["test-run"]);
    db1.close();

    const db2 = await WorkspaceDatabase.open(dbPath);
    const row = db2.get<{ run_key: string }>("SELECT run_key FROM scan_runs WHERE run_key = ?", ["test-run"]);
    expect(row?.run_key).toBe("test-run");
    db2.close();
    cleanupWorkspace(ws);
  });
});
