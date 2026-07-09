# importer-instagram — Status

## Complete and real
- `plugin.json` manifest, validated against the schema by the loader.
- Registration: discovered by `discoverPluginManifests()`, a `plugin_registrations` row is created in every workspace's DB whether or not it activates.
- Activation: correctly activates only in workspaces with `modules.instagram: true` (Fatletic has this flag; PrecisionWorkz does not — verified, the plugin registers as `disabled` there with reason `"module flag(s) [instagram] not enabled"`).
- Version/engine compatibility checking (same code path as every other plugin).
- Error isolation: calling `discover()` produces a clean, attributed `PluginExecutionError`, recorded to `plugin_health`, never a crash.
- Test scaffolding: `tests/core/plugin-runtime.test.ts` exercises registration, activation, and the blocked-discover() path for this exact plugin.

## Blocked
`discover()` has no extraction logic. Turning an Instagram data export (Meta's "Download Your Information" package — a JSON+media bundle with a specific, versioned, undocumented-by-Meta internal structure) into `DiscoveredFile` records requires a real export to build and validate a parser against. None exists anywhere in the Fatletic workspace or elsewhere in this repository.

## What unblocks this
A real Instagram data export for the Fatletic account (or a documented sample of one). Once available:
1. Add fixture data under `tests/fixtures/instagram-export-sample/` (a real, sanitized export — not synthetic data invented to match a guess at the format).
2. Implement `discover()` to walk the export's JSON index, map each post/story to a `DiscoveredFile` (media file as `absPath`, a `zip-provenance`-style `relPath` back to the export bundle + JSON post ID).
3. Extend `capabilities` in `plugin.json` to include `"discover"` once real, tested extraction exists.
