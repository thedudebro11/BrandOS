# Plugin Architecture

## Purpose
Allow brand-specific or source-specific logic (importers, classifiers, report templates, vault note templates) to extend BrandOS without any of it living in the Core Platform Layer.

## Plugin Contracts
1. **Importer** — `parse(sourcePath) -> { events, files, metadata }`
2. **Classifier** — `classify(file, metadata) -> { category, confidence, reasons }`
3. **ReportTemplate** — `generate(workspaceData, caseId?) -> { markdown, pdf, citations }`. `citations` must be non-empty for any factual claim in the output.
4. **VaultTemplate** — `renderNote(entity) -> markdown` (see `20_OBSIDIAN_INTEGRATION.md`)

## Manifest
Each plugin lives at `app/src/plugins/<name>/` with a `plugin.json`:

```json
{
  "id": "importer-printful",
  "type": "Importer",
  "activatesOn": ["printful"]
}
```

## Activation
At startup, the plugin loader reads every `plugin.json` under `app/src/plugins/*`. For each open workspace, a plugin activates only if every flag listed in `activatesOn` is `true` in that workspace's `workspace.json` `modules` object. A workspace with `modules.printful: false` has zero Printful code paths active — not a disabled UI element, an actually-inactive plugin.

## Known Plugins (initial set, see `app/specs/plugins/`)
- `importer-instagram` (activatesOn: `instagram`)
- `importer-printful` (activatesOn: `printful`)
- `classifier-apparel-brand` (activatesOn: `assetManagement`, type=`brand`)
- `report-priority-of-use` (activatesOn: `priorityOfUseDossier`)
- `report-trademark-readiness` (activatesOn: `trademarkReadinessReport`)
- `vault-templates-brand-archive` (activatesOn: `obsidian`)

## Rule
Core Platform Layer code may depend on a plugin *contract* (interface) but never on a specific plugin implementation. Adding, removing, or changing a plugin must never require a change to `app/src/core`.
