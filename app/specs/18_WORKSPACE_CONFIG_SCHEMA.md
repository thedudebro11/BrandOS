# Workspace Config Schema

## Purpose
Define the schema, validation rules, and loading contract for `workspace.json` — the file that makes a workspace folder self-describing and controls which plugins and dashboard widgets activate for it.

## Location
`workspaces/<id>/workspace.json`

## Schema

```jsonc
{
  "id": "fatletic",                 // lowercase, filesystem-safe, must match containing folder name
  "name": "Fatletic",
  "type": "brand",                  // "brand" | "personal_vault" | other registered types
  "status": "active",
  "created": "2024-09",
  "primaryUseCase": "trademark_evidence_and_brand_archive",
  "modules": {                       // single source of truth for plugin + widget activation
    "assetManagement": true,
    "trademark": true,
    "copyright": true,
    "obsidian": true,
    "instagram": true,
    "printful": true,
    "caseBuilder": true,
    "priorityOfUseDossier": true,
    "trademarkReadinessReport": true
  },
  "paths": {                         // optional; defaults shown
    "obsidianVault": "06_Obsidian",
    "exports": ".brandos/exports",
    "reviewQueue": ".brandos/review-queue"
  },
  "importantMarks": {                 // only present for brand-type workspaces
    "primaryMark": "FATLETIC",
    "relatedOrConflictingMarks": ["FATLETE"]
  },
  "evidenceTypes": ["logos", "design_source_files", "..."],
  "caseTypes": [                      // optional; core falls back to "General Case" if omitted
    "trademark_registration",
    "trademark_opposition",
    "copyright_registration",
    "investor_due_diligence",
    "brand_acquisition",
    "media_kit",
    "product_launch",
    "historical_timeline"
  ]
}
```

## Field Rules
- `id`: lowercase, filesystem-safe, must match the containing folder name under `workspaces/`.
- `type`: determines which optional schema blocks (e.g. `importantMarks`) are expected. A `personal_vault` workspace, for example, has no `importantMarks` block.
- `modules`: object of boolean flags. Each flag is the single source of truth for whether a plugin or dashboard widget gated on that flag is active for this workspace (see `19_PLUGIN_ARCHITECTURE.md`, `11_DASHBOARD.md`).
- `paths`: optional overrides for generated-output locations. Defaults apply if a key is omitted.
- `caseTypes`: default case types offered by the Case Builder for this workspace (see `17_CASE_BUILDER.md`).

## Validation
- Loaded and validated against `workspace.schema.json` (JSON Schema) at platform startup and whenever a workspace is opened.
- A workspace that fails validation must not silently start with partial config — the platform must surface the specific validation error to the user rather than proceeding with `undefined` fields.

## Rule
No core service may read a brand name, mark, or module-specific literal from anywhere except a loaded, validated `workspace.json` (or data derived from it) for the workspace currently being operated on. Hardcoding a workspace's values into core code is a spec violation (see `01_ARCHITECTURE.md` — Core Rule: No Hardcoding).
