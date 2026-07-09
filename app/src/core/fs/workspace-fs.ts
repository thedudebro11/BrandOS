import fs from "node:fs";
import path from "node:path";
import type { LoadedWorkspace } from "../types";

/**
 * Structural enforcement of "original files are sacred"
 * (app/specs/01_ARCHITECTURE.md core principle; SYSTEM_ARCHITECTURE.md §10
 * evidence integrity model). Every core service that touches the filesystem
 * should go through this wrapper: it can read anywhere under the workspace,
 * but can only write under .brandos/. There is deliberately no rename/delete
 * method at all in Phase 2 — the engine has no code path capable of touching
 * an original file even by mistake.
 */
export class WorkspaceFs {
  readonly rootDir: string;
  readonly brandosDir: string;
  readonly obsidianVaultDir: string;
  readonly archiveDir: string;
  readonly exportsDir: string;

  constructor(private workspace: LoadedWorkspace) {
    this.rootDir = path.resolve(workspace.rootDir);
    this.brandosDir = path.join(this.rootDir, ".brandos");
    const vaultRel = workspace.config.paths?.obsidianVault ?? "06_Obsidian";
    this.obsidianVaultDir = path.join(this.rootDir, vaultRel);
    this.archiveDir = path.join(this.rootDir, `${workspace.config.id}_Archive`);
    const exportsRel = workspace.config.paths?.exports ?? ".brandos/exports";
    this.exportsDir = path.resolve(this.rootDir, exportsRel);
  }

  /** Paths BrandOS itself generates — never evidence, always safe to skip during scanning. */
  isGeneratedPath(absPath: string): boolean {
    const resolved = path.resolve(absPath);
    return (
      resolved === this.brandosDir ||
      resolved.startsWith(this.brandosDir + path.sep) ||
      resolved === this.obsidianVaultDir ||
      resolved.startsWith(this.obsidianVaultDir + path.sep) ||
      resolved === this.archiveDir ||
      resolved.startsWith(this.archiveDir + path.sep) ||
      resolved === this.exportsDir ||
      resolved.startsWith(this.exportsDir + path.sep)
    );
  }

  ensureBrandosDir(): void {
    fs.mkdirSync(this.brandosDir, { recursive: true });
  }

  dbPath(): string {
    return path.join(this.brandosDir, "archive.db");
  }

  manifestsDir(): string {
    return path.join(this.brandosDir, "manifests");
  }

  /** The only write surface this class exposes — always under .brandos/. */
  writeGenerated(relPathUnderBrandos: string, data: string | Buffer): void {
    const target = path.join(this.brandosDir, relPathUnderBrandos);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(this.brandosDir + path.sep) && resolved !== this.brandosDir) {
      throw new Error(
        `Refusing to write outside .brandos/: ${resolved} (evidence tree is read-only, see app/specs/01_ARCHITECTURE.md)`
      );
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, data);
  }

  /** The vault's second, equally-guarded write surface — always under the workspace's Obsidian vault path. Never the evidence tree. */
  writeVaultFile(relPathUnderVault: string, data: string): void {
    const target = path.join(this.obsidianVaultDir, relPathUnderVault);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(this.obsidianVaultDir + path.sep) && resolved !== this.obsidianVaultDir) {
      throw new Error(
        `Refusing to write outside the Obsidian vault dir: ${resolved} (evidence tree is read-only, see app/specs/01_ARCHITECTURE.md)`
      );
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, data, "utf-8");
  }

  readVaultFile(relPathUnderVault: string): string | null {
    const target = path.join(this.obsidianVaultDir, relPathUnderVault);
    if (!fs.existsSync(target)) return null;
    return fs.readFileSync(target, "utf-8");
  }

  /**
   * Phase 7: a third guarded write surface, for importer plugins that must
   * extract a source (e.g. a ZIP archive) to real files on disk before they
   * can be hashed/metadata-extracted. Always under .brandos/.import-staging/,
   * never the evidence tree — same structural guarantee as writeGenerated.
   * Callers are responsible for calling clearStagingDir() when an import run
   * finishes, so this never accumulates as silent disk usage.
   */
  stagingDir(runKey: string): string {
    return path.join(this.brandosDir, ".import-staging", runKey);
  }

  ensureStagingDir(runKey: string): string {
    const dir = this.stagingDir(runKey);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  clearStagingDir(runKey: string): void {
    const dir = this.stagingDir(runKey);
    const resolved = path.resolve(dir);
    const stagingRoot = path.join(this.brandosDir, ".import-staging");
    if (!resolved.startsWith(stagingRoot + path.sep) && resolved !== stagingRoot) {
      throw new Error(`Refusing to clear a directory outside .brandos/.import-staging/: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }

  /**
   * Phase 8: a fourth guarded write surface, for generated reports — always
   * under the workspace's configured exports directory (paths.exports,
   * default .brandos/exports), never the evidence tree. Same structural
   * guarantee as writeGenerated/writeVaultFile.
   */
  writeExport(relPathUnderExports: string, data: string): void {
    const target = path.join(this.exportsDir, relPathUnderExports);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(this.exportsDir + path.sep) && resolved !== this.exportsDir) {
      throw new Error(
        `Refusing to write outside the exports dir: ${resolved} (evidence tree is read-only, see app/specs/01_ARCHITECTURE.md)`
      );
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, data, "utf-8");
  }
}
