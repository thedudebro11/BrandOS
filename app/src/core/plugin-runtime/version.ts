/** Minimal semver-shape comparator — the manifest schema already restricts versions to exactly X.Y.Z, so this never needs to handle pre-release tags or ranges. */
export function parseVersion(v: string): [number, number, number] {
  const parts = v.split(".").map((p) => Number.parseInt(p, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Returns true if `actual` >= `minimum`. */
export function versionSatisfies(actual: string, minimum: string): boolean {
  const a = parseVersion(actual);
  const m = parseVersion(minimum);
  for (let i = 0; i < 3; i++) {
    if (a[i] > m[i]) return true;
    if (a[i] < m[i]) return false;
  }
  return true; // equal
}
