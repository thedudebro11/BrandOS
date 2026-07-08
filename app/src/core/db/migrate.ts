import fs from "node:fs";
import path from "node:path";
import type { WorkspaceDatabase } from "./connection";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/** Applies every .sql file under migrations/ that hasn't run yet, in filename order. */
export function runMigrations(db: WorkspaceDatabase): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`
  );

  const applied = new Set(db.all<{ filename: string }>("SELECT filename FROM _migrations").map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    db.transaction(() => {
      db.exec(sql);
      db.run("INSERT INTO _migrations (filename) VALUES (?)", [file]);
    });
    newlyApplied.push(file);
  }
  return newlyApplied;
}
