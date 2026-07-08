import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
    });
  }
  return sqlJsPromise as Promise<SqlJsStatic>;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | null;
}

/**
 * Thin wrapper around sql.js (WASM SQLite — chosen over better-sqlite3 because
 * this environment has no C++ toolchain for native compilation; see
 * ARCHITECTURE_DECISIONS.md ADR-009). sql.js keeps the whole database in
 * memory and has no live file-backed mode, so every write-heavy operation
 * should be followed by an explicit save() rather than relying on sql.js to
 * persist automatically.
 */
export class WorkspaceDatabase {
  private constructor(private db: Database, public readonly dbPath: string) {}

  static async open(dbPath: string): Promise<WorkspaceDatabase> {
    const SQL = await loadSqlJs();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const existing = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
    const db = new SQL.Database(existing);
    db.run("PRAGMA foreign_keys = ON;");
    return new WorkspaceDatabase(db, dbPath);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      stmt.step();
    } finally {
      stmt.free();
    }
    const changes = this.db.getRowsModified();
    const idRow = this.get<{ id: number }>("SELECT last_insert_rowid() AS id");
    return { changes, lastInsertRowid: idRow ? idRow.id : null };
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      if (stmt.step()) {
        return stmt.getAsObject() as T;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      stmt.bind(params as never);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
    } finally {
      stmt.free();
    }
    return rows;
  }

  /** For DDL / multi-statement scripts (migrations). No params support, by design. */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    this.db.run("BEGIN;");
    try {
      const result = fn();
      this.db.run("COMMIT;");
      return result;
    } catch (err) {
      this.db.run("ROLLBACK;");
      throw err;
    }
  }

  save(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  close(): void {
    this.save();
    this.db.close();
  }
}
