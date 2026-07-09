import { EventEmitter } from "node:events";
import type { LogLevel } from "../types";

/**
 * Core BrandOS event names. This is the foundation for the eventual full flow:
 * file discovered -> metadata extracted -> hash computed -> asset created/updated
 * -> relationships updated -> timeline updated -> cases updated -> dashboard
 * refreshed -> Obsidian updated.
 *
 * Phase 2 emits and consumes the core scan-path events. "cases updated",
 * "dashboard refresh", and "Obsidian updated" are defined now so later phases
 * (Case Builder, dashboard, Obsidian generation) can subscribe without any
 * change to the scanner/import engine — that's the point of building the bus
 * as a foundation piece now instead of bolting it on later.
 */
export interface BrandOSEvents {
  "scan.started": { workspaceId: string; runKey: string; trigger: string };
  "scan.completed": { workspaceId: string; runKey: string };
  "scan.error": { workspaceId: string; runKey: string; message: string };
  "file.discovered": { workspaceId: string; relPath: string };
  "hash.computed": { workspaceId: string; relPath: string; sha256: string };
  "metadata.extracted": { workspaceId: string; relPath: string; count: number };
  "asset.created": { workspaceId: string; assetId: string; relPath: string };
  "asset.updated": { workspaceId: string; assetId: string; relPath: string };
  "asset.missing": { workspaceId: string; assetId: string; relPath: string };
  "relationship.updated": { workspaceId: string; count: number };
  "timeline.updated": { workspaceId: string; count: number };
  "classification.assigned": { workspaceId: string; assetId: string; category: string; confidence: number };
  "tags.assigned": { workspaceId: string; assetId: string; count: number };
  "evidence.assessed": { workspaceId: string; dimension: string; score: number };
  "integrity.issue_found": { workspaceId: string; issueType: string; severity: string };
  /** Producer wired in a future Case Builder reports phase; the CaseBuilderService itself exists from Phase 3. */
  "case.updated": { workspaceId: string; caseId: number };
  /** Foundation only in Phase 2 — no producer/consumer wired yet. */
  "dashboard.refresh.requested": { workspaceId: string };
  /** Foundation only in Phase 2 — no producer/consumer wired yet. */
  "obsidian.update.requested": { workspaceId: string };
  /** Phase 7: the plugin-runtime/import-pipeline event set. */
  "import.started": { workspaceId: string; pluginId: string; sourceLabel: string; importRunId: number };
  "import.completed": { workspaceId: string; pluginId: string; importRunId: number; status: "completed" | "failed" };
  "plugin.loaded": { workspaceId: string; pluginId: string };
  "plugin.failed": { workspaceId: string; pluginId: string; message: string };
  log: { level: LogLevel; event: string; message: string; details?: unknown };
}

export type BrandOSEventName = keyof BrandOSEvents;

/** Typed wrapper around Node's EventEmitter so every emit/on call is checked against BrandOSEvents. */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Scans can touch hundreds of files; avoid Node's default max-listener warning noise.
    this.emitter.setMaxListeners(50);
  }

  emit<E extends BrandOSEventName>(event: E, payload: BrandOSEvents[E]): void {
    this.emitter.emit(event, payload);
  }

  on<E extends BrandOSEventName>(event: E, handler: (payload: BrandOSEvents[E]) => void): void {
    this.emitter.on(event, handler);
  }

  off<E extends BrandOSEventName>(event: E, handler: (payload: BrandOSEvents[E]) => void): void {
    this.emitter.off(event, handler);
  }
}
