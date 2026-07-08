import type { EventBus } from "../events/event-bus";
import type { WorkspaceDatabase } from "../db/connection";
import type { LogLevel } from "../types";

export interface LogEntryInput {
  level: LogLevel;
  event: string;
  message: string;
  assetId?: string | null;
  scanRunId?: number | null;
  details?: unknown;
}

/**
 * Every scan, hash, database write, skip, and error goes through here — "no hidden
 * operations" (app/specs/01_ARCHITECTURE.md core services list, item: logging).
 * Persists to the `logs` table and emits a `log` event on the bus, and echoes to
 * the console so a running CLI scan is visible in real time.
 */
export class Logger {
  constructor(private db: WorkspaceDatabase, private bus: EventBus) {}

  private write(entry: LogEntryInput): void {
    this.db.run(
      `INSERT INTO logs (level, event, message, asset_id, scan_run_id, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        entry.level,
        entry.event,
        entry.message,
        entry.assetId ?? null,
        entry.scanRunId ?? null,
        entry.details !== undefined ? JSON.stringify(entry.details) : null,
      ]
    );
    this.bus.emit("log", {
      level: entry.level,
      event: entry.event,
      message: entry.message,
      details: entry.details,
    });
    const prefix = `[${entry.level.toUpperCase()}] ${entry.event}:`;
    if (entry.level === "error") console.error(prefix, entry.message);
    else if (entry.level === "warn") console.warn(prefix, entry.message);
    else console.log(prefix, entry.message);
  }

  info(event: string, message: string, extra?: Partial<LogEntryInput>): void {
    this.write({ level: "info", event, message, ...extra });
  }

  warn(event: string, message: string, extra?: Partial<LogEntryInput>): void {
    this.write({ level: "warn", event, message, ...extra });
  }

  error(event: string, message: string, extra?: Partial<LogEntryInput>): void {
    this.write({ level: "error", event, message, ...extra });
  }
}
