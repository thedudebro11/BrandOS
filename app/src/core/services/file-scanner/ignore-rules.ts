import path from "node:path";

/** Names ignored anywhere in the tree, regardless of workspace config. */
export const DEFAULT_IGNORE_NAMES = new Set([
  ".git",
  "node_modules",
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".brandos",
]);

export function isDefaultIgnored(basename: string): boolean {
  return DEFAULT_IGNORE_NAMES.has(basename);
}

export function isHiddenName(basename: string): boolean {
  return basename.startsWith(".");
}

export function extensionOf(filename: string): string {
  const ext = path.extname(filename);
  return ext ? ext.slice(1).toLowerCase() : "";
}
