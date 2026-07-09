import { WorkspaceDatabase } from "../../db/connection";
import { runMigrations } from "../../db/migrate";
import { WorkspaceFs } from "../../fs/workspace-fs";
import { EventBus } from "../../events/event-bus";
import { Logger } from "../../logging/logger";
import { loadPluginsForWorkspace, runPluginCall } from "../../plugin-runtime/plugin-loader";
import type { ImportSourceRef } from "../../plugin-runtime/plugin-api";
import { processDiscoveredFile, runKnowledgeUpdateStage, runRelationshipDiscoveryStage, runValidationStage } from "./import-pipeline";
import { writeManifests } from "../hashing-engine/hash-engine";
import { createImportRun, finishImportRun } from "../../db/import-runs-repository";
import { createScanRun, finishScanRun, listActiveAssets, markAssetsMissing, upsertWorkspaceInfo } from "../../db/repositories";
import type { AssetRecord, LoadedWorkspace, ScanRunSummary, ScanTrigger } from "../../types";

export interface ImportOutcome {
  summary: ScanRunSummary;
  importRunId: number;
  wfs: WorkspaceFs;
  db: WorkspaceDatabase;
}

/**
 * The one general-purpose entry point for "run this importer plugin against
 * this source, and take the workspace through the full shared pipeline."
 * `runScan` (folder scans) and the ZIP import CLI are both thin callers of
 * this function with a different pluginId/source — this is what makes "no
 * importer bypasses the pipeline" true structurally, not just by convention.
 *
 * scan_runs bookkeeping (started_at/status/counts) is reused for every import
 * kind, not just folder scans — it was already a generic "one run of the
 * engine over this workspace" concept before Phase 7, and duplicating it into
 * a parallel table just for non-folder imports would be the exact kind of
 * needless-parallel-structure this project's principles argue against.
 * import_runs (Phase 7) is the new, plugin-attributed audit layer on top.
 */
export async function runImport(
  workspace: LoadedWorkspace,
  pluginId: string,
  source: ImportSourceRef,
  trigger: ScanTrigger = "manual"
): Promise<ImportOutcome> {
  const wfs = new WorkspaceFs(workspace);
  wfs.ensureBrandosDir();
  const db = await WorkspaceDatabase.open(wfs.dbPath());
  runMigrations(db);
  upsertWorkspaceInfo(db, workspace.config);

  const bus = new EventBus();
  const logger = new Logger(db, bus);
  const runKey = `${workspace.config.id}-${new Date().toISOString()}`;
  const scanRunId = createScanRun(db, runKey, trigger);

  bus.emit("scan.started", { workspaceId: workspace.config.id, runKey, trigger });
  logger.info("scan.started", `Starting ${trigger} import of workspace "${workspace.config.id}" via "${pluginId}"`, { scanRunId });

  const counts = {
    filesDiscovered: 0,
    filesScanned: 0,
    filesSkipped: 0,
    filesErrored: 0,
    assetsCreated: 0,
    assetsUpdated: 0,
    assetsMissing: 0,
    duplicateGroupsFound: 0,
  };

  const plugins = await loadPluginsForWorkspace(workspace, db, wfs, bus, logger);
  const importer = plugins.get(pluginId);
  if (!importer) {
    db.save();
    throw new Error(`Importer plugin "${pluginId}" is not active for workspace "${workspace.config.id}" — check plugin_registrations for why.`);
  }

  let importRunId: number | null = null;
  let unchangedCount = 0;
  let warningsCount = 0;

  try {
    const discovery = await runPluginCall(db, pluginId, "discover", () =>
      importer.discover({ workspace, db, wfs, bus, logger, runId: scanRunId }, source)
    );

    try {
      importRunId = createImportRun(db, pluginId, importer.manifest.version, discovery.sourceLabel, scanRunId);
      bus.emit("import.started", { workspaceId: workspace.config.id, pluginId, sourceLabel: discovery.sourceLabel, importRunId });

      counts.filesDiscovered = discovery.files.length;
      const seenAssetIds = new Set<number>();
      const touchedAssets: AssetRecord[] = [];
      const pipelineCtx = { db, bus, logger, workspaceId: workspace.config.id, scanRunId };

      for (const file of discovery.files) {
        const result = await processDiscoveredFile(pipelineCtx, file);
        if (result.outcome === "validation_failed") {
          warningsCount++;
          continue;
        }
        if (result.outcome === "hash_failed") {
          counts.filesErrored++;
          continue;
        }
        if (result.asset) {
          seenAssetIds.add(result.asset.id);
          if (result.outcome === "created") counts.assetsCreated++;
          if (result.outcome === "updated") counts.assetsUpdated++;
          if (result.outcome === "unchanged") unchangedCount++;
          if (result.outcome === "created" || result.outcome === "updated") touchedAssets.push(result.asset);
        }
        counts.filesScanned++;
      }

      // Only a full workspace-root import can meaningfully declare "everything
      // not seen this run is missing" — a partial-source import (a single ZIP)
      // only ever adds/updates/reuses assets, it never has grounds to mark
      // anything workspace-wide missing.
      counts.assetsMissing = source.kind === "workspace_root" ? markAssetsMissing(db, seenAssetIds) : 0;
      counts.duplicateGroupsFound = db.get<{ c: number }>("SELECT COUNT(*) AS c FROM duplicate_groups")?.c ?? 0;

      const allActive = listActiveAssets(db);
      runRelationshipDiscoveryStage(pipelineCtx, allActive);
      const touchedIds = new Set(touchedAssets.map((a) => a.id));
      runKnowledgeUpdateStage(pipelineCtx, allActive, touchedIds);
      writeManifests(wfs, allActive);

      const validationResults = runValidationStage(db);
      const validationPassed = validationResults.every((r) => r.passed);

      finishScanRun(db, scanRunId, "completed", counts);
      finishImportRun(
        db,
        importRunId,
        "completed",
        {
          assetsAdded: counts.assetsCreated,
          assetsUpdated: counts.assetsUpdated,
          assetsSkipped: unchangedCount + warningsCount,
          duplicatesFound: counts.duplicateGroupsFound,
          warningsCount,
          errorsCount: counts.filesErrored,
        },
        validationPassed,
        { ...counts, unchangedCount, validationResults },
        null
      );
      bus.emit("scan.completed", { workspaceId: workspace.config.id, runKey });
      bus.emit("import.completed", { workspaceId: workspace.config.id, pluginId, importRunId, status: "completed" });
      logger.info(
        "scan.completed",
        `Import complete: ${counts.assetsCreated} created, ${counts.assetsUpdated} updated, ${unchangedCount} unchanged, ${counts.assetsMissing} missing, ${counts.duplicateGroupsFound} duplicate group(s)`,
        { scanRunId }
      );

      const summary: ScanRunSummary = {
        runKey,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "completed",
        trigger,
        ...counts,
      };
      return { summary, importRunId, wfs, db };
    } finally {
      // Extraction-based sources (ZIP) may leave scratch files on disk;
      // discover() hands back its own cleanup so the orchestrator doesn't
      // need to know what kind of source it was importing from.
      discovery.cleanup?.();
    }
  } catch (err) {
    finishScanRun(db, scanRunId, "failed", counts);
    if (importRunId !== null) {
      finishImportRun(
        db,
        importRunId,
        "failed",
        {
          assetsAdded: counts.assetsCreated,
          assetsUpdated: counts.assetsUpdated,
          assetsSkipped: unchangedCount + warningsCount,
          duplicatesFound: counts.duplicateGroupsFound,
          warningsCount,
          errorsCount: counts.filesErrored,
        },
        null,
        counts,
        (err as Error).message
      );
      bus.emit("import.completed", { workspaceId: workspace.config.id, pluginId, importRunId, status: "failed" });
    }
    bus.emit("scan.error", { workspaceId: workspace.config.id, runKey, message: (err as Error).message });
    logger.error("scan.error", `Import failed: ${(err as Error).message}`, { scanRunId });
    throw err;
  } finally {
    db.save();
  }
}
