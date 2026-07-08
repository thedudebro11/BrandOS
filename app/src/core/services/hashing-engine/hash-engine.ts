import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import type { WorkspaceFs } from "../../fs/workspace-fs";
import type { AssetRecord } from "../../types";

/** Streams the file through SHA-256 — safe for large video/PSD files, never loads the whole file into memory. */
export function hashFile(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(absPath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/** Re-hashes an already-known asset and reports whether it still matches the stored hash. */
export async function verifyAssetHash(
  wfs: WorkspaceFs,
  asset: AssetRecord
): Promise<{ hash: string; matched: boolean }> {
  const absPath = path.join(wfs.rootDir, asset.originalPath);
  const hash = await hashFile(absPath);
  return { hash, matched: hash === asset.sha256 };
}

/**
 * Writes FILE_MANIFEST.json/.csv and CHAIN_OF_CUSTODY.md into .brandos/manifests/
 * (app/specs/02_FILE_SCANNER.md, 04_HASHING_AND_CHAIN_OF_CUSTODY.md). Generated
 * output only — never touches the evidence tree.
 */
export function writeManifests(wfs: WorkspaceFs, assets: AssetRecord[]): void {
  const manifestJson = JSON.stringify(
    assets.map((a) => ({
      assetId: a.assetId,
      originalPath: a.originalPath,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256,
      status: a.status,
    })),
    null,
    2
  );
  wfs.writeGenerated(path.join("manifests", "FILE_MANIFEST.json"), manifestJson);

  const csvHeader = "asset_id,original_path,filename,size_bytes,sha256,status\n";
  const csvRows = assets
    .map((a) => [a.assetId, a.originalPath, a.filename, a.sizeBytes, a.sha256, a.status].map(csvEscape).join(","))
    .join("\n");
  wfs.writeGenerated(path.join("manifests", "FILE_MANIFEST.csv"), csvHeader + csvRows + "\n");

  const custodyLines = [
    "# Chain of Custody",
    "",
    "| Asset ID | Original Path | Import Date | SHA-256 | Copied | Modified by System |",
    "|---|---|---|---|---|---|",
    ...assets.map(
      (a) =>
        `| ${a.assetId} | ${a.originalPath} | ${a.firstSeenAt} | ${a.sha256 ?? "(unhashed)"} | No | No |`
    ),
  ];
  wfs.writeGenerated("CHAIN_OF_CUSTODY.md", custodyLines.join("\n") + "\n");
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
