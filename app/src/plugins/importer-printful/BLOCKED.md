# importer-printful — Status

## Complete and real
- `plugin.json` manifest, validated against the schema by the loader.
- Registration: discovered by `discoverPluginManifests()`, a `plugin_registrations` row is created in every workspace's DB whether or not it activates.
- Activation: correctly activates only in workspaces with `modules.printful: true` (Fatletic has this flag; PrecisionWorkz does not).
- Version/engine compatibility checking (same code path as every other plugin).
- Error isolation: calling `discover()` produces a clean, attributed `PluginExecutionError`, recorded to `plugin_health`, never a crash.
- Test scaffolding: `tests/core/plugin-runtime.test.ts` exercises registration, activation, and the blocked-discover() path for this exact plugin.

## Blocked, and why this is a real distinction, not an excuse
Fatletic's workspace does contain a `Printiful Invoices` folder with real PDF invoices — those are already imported today, as ordinary evidence, by the Generic Folder Importer (classified, hashed, timeline-dated from PDF metadata like every other document). What's missing is a **structured** Printful export: the order/SKU/shipment/tracking data Printful's dashboard or API can export as JSON/CSV, which would let this plugin build real `source_to_export`-style relationships between a design file, a specific order, and a specific shipment — richer than a PDF invoice alone can support. No such structured export exists anywhere in this repository.

## What unblocks this
A real Printful order/shipment export (JSON or CSV, from Printful's dashboard export feature or API). Once available:
1. Add fixture data under `tests/fixtures/printful-export-sample/` (real, sanitized data).
2. Implement `discover()` to parse the export and map each order/shipment to `DiscoveredFile`-shaped records (or, if the export references files already in the evidence tree rather than containing binary media itself, extend the pipeline's relationship/timeline stages to consume order data directly rather than treating it as file discovery — a design decision to make once a real export's actual shape is known, not before).
3. Extend `capabilities` in `plugin.json` to include `"discover"` once real, tested extraction exists.
