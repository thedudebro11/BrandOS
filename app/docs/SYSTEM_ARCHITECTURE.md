# System Architecture

Target architecture for BrandOS as a reusable, multi-workspace platform. This document describes the *design*, not an implementation status — nothing here has been built yet (see `IMPLEMENTATION_PLAN.md`).

## 1. Principles

1. **Core has zero brand knowledge.** Nothing under `app/src/core` may reference "Fatletic," "FATLETE," apparel, Class 25, Printful, or Instagram by name. If a core file needs a brand name, product category, or mark, that value must come from `workspace.json` or a plugin, never be a literal.
2. **A workspace is a self-contained folder.** Everything about one brand/vault — its config, its generated data, its Obsidian vault, its reports — lives under `workspaces/<id>/`. Deleting or moving that folder should not corrupt any other workspace.
3. **Plugins are how brand-specific or source-specific logic enters the system.** Importers (Instagram, Printful), report templates (Priority of Use, Trademark Readiness), and vault generators (Obsidian) are all plugins, not core services, even though the first release ships with only a Fatletic-shaped set of them.
4. **Originals are immutable.** Every service reads from the raw evidence tree and writes only to `workspaces/<id>/.brandos/` (generated data) or export destinations. No service ever writes into the raw evidence tree.
5. **Every derived claim is traceable to a hash-verified source file.** This is a legal-evidence system as much as a DAM; traceability is not optional polish.

## 2. Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React + Tailwind)                                 │
│  Dashboard shell, workspace switcher, widget registry         │
└───────────────────────────────┬───────────────────────────────┘
                                  │ IPC / local HTTP
┌───────────────────────────────▼───────────────────────────────┐
│  Application/API Layer (Node.js)                              │
│  workspace router · REST/IPC handlers · job queue              │
└───────────────────────────────┬───────────────────────────────┘
                                  │
┌───────────────────────────────▼───────────────────────────────┐
│  Core Platform Services (workspace-agnostic, no brand logic)  │
│  FileScanner · HashingEngine · MetadataExtractor               │
│  ClassificationEngine · RelationshipEngine · TimelineEngine    │
│  ReviewQueueService · CaseBuilderService · ExportEngine         │
│  DashboardDataProvider · VaultGenerator (generic)               │
└───────────────────────────────┬───────────────────────────────┘
                                  │ plugin contracts (interfaces)
┌───────────────────────────────▼───────────────────────────────┐
│  Plugin Layer (brand/source-specific, swappable per workspace) │
│  Importers: instagram, printful, ...                           │
│  Classifiers: apparel-brand-classifier, ...                    │
│  Report Templates: priority-of-use, trademark-readiness, ...   │
│  Vault Templates: obsidian-note-templates                      │
└───────────────────────────────┬───────────────────────────────┘
                                  │
┌───────────────────────────────▼───────────────────────────────┐
│  Data Layer (per-workspace, see §5)                            │
│  workspaces/<id>/.brandos/archive.db (SQLite)                  │
│  workspaces/<id>/.brandos/manifests/, cache/                   │
│  workspaces/<id>/06_Obsidian/ (or configured vault path)       │
└─────────────────────────────────────────────────────────────┘
```

## 3. Target Directory Layout

```
BrandOS/
  app/
    src/
      core/
        db/                    # schema.sql, migrations/, workspace-scoped connection factory
        workspace/              # WorkspaceRegistry, WorkspaceConfig loader + validator
        services/
          file-scanner/
          hashing-engine/
          metadata-engine/
          classification-engine/
          relationship-engine/
          timeline-engine/
          review-queue/
          case-builder/
          report-generator/
          export-engine/
          vault-generator/       # generic Obsidian note emitter
          dashboard-provider/     # aggregates widget data per workspace
        plugin-api/                # TypeScript interfaces: Importer, Classifier,
                                    # ReportTemplate, VaultTemplate, DashboardWidget
      plugins/
        importer-instagram/
        importer-printful/
        classifier-apparel-brand/
        report-priority-of-use/
        report-trademark-readiness/
        vault-templates-brand-archive/
        <plugin>/plugin.json        # manifest: id, type, targets, enabledByModule
      ui/
        shell/                     # workspace switcher, nav, layout
        widgets/                   # one component per DashboardWidget contract
        pages/
      cli/                          # `brandos scan`, `brandos import`, `brandos report`
    specs/                          # PLATFORM specs (generalized, see IMPROVEMENT_PROPOSALS)
    docs/
    prompts/
  workspaces/
    Fatletic/
      workspace.json
      README.md
      .brandos/
        archive.db
        manifests/                  # FILE_MANIFEST.json/csv, hash records
        cache/
      06_Obsidian/                  # generated vault, path from workspace.json
      <raw evidence, untouched>
    <NextWorkspace>/
      workspace.json
      README.md
      .brandos/
      ...
  installer/
  backups/
  exports/
```

Key point: nothing in `app/src/plugins/*` is off-limits to being Fatletic-shaped in its first version (an apparel classifier, Instagram/Printful importers, trademark report templates *are* legitimately Fatletic-flavored plugins) — the architecture rule is that `app/src/core` never contains that logic, and every plugin declares which workspace modules activate it.

## 4. Workspace Configuration Schema

`workspace.json` is already close to right. Proposed formalized schema (superset of the current file):

```jsonc
{
  "id": "fatletic",
  "name": "Fatletic",
  "type": "brand",                 // brand | personal_vault | future types
  "status": "active",
  "created": "2024-09",
  "primaryUseCase": "trademark_evidence_and_brand_archive",
  "modules": {                      // controls which plugins + dashboard widgets activate
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
  "paths": {                        // NEW — makes generated-output locations explicit and workspace-owned
    "obsidianVault": "06_Obsidian",
    "exports": ".brandos/exports",
    "reviewQueue": ".brandos/review-queue"
  },
  "importantMarks": {                // brand-type-specific block; other workspace types omit this
    "primaryMark": "FATLETIC",
    "relatedOrConflictingMarks": ["FATLETE"]
  },
  "evidenceTypes": ["logos", "design_source_files", "..."],
  "caseTypes": [                     // NEW — declares which Case Builder templates apply
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

The `WorkspaceConfig` loader validates this against a JSON Schema at `app/src/core/workspace/workspace.schema.json`, so a malformed or incomplete `workspace.json` fails loudly at startup instead of causing silent per-field `undefined` bugs downstream — important once there's more than one workspace and they can't all be hand-verified by inspection.

## 5. Data Layer

**Decision: one SQLite database per workspace** (`workspaces/<id>/.brandos/archive.db`), all workspaces sharing the identical schema. Rationale in `ARCHITECTURE_DECISIONS.md` ADR-001; the short version is that a workspace folder should be a self-contained, movable, zippable unit (matches how the raw evidence itself already behaves), and it hard-prevents any cross-brand data leakage between, say, Fatletic and Precision Workz.

Core tables (all scoped implicitly by which workspace's DB file they live in — no `workspace_id` column needed):

- `files` — id, original_path, filename, extension, size, created_at, modified_at, accessed_at, sha256, is_hidden, is_broken_shortcut
- `file_metadata` — file_id, key, value, source (`extracted` | `inferred`), confidence
- `classifications` — file_id, category, confidence, method, needs_review (bool)
- `relationships` — from_file_id, to_file_id, relationship_type, confidence, evidence_note
- `timeline_events` — id, date, title, description, event_type, confidence, verified_status, timeline_name
- `timeline_event_files` — event_id, file_id (supporting files, many-to-many)
- `review_queue` — id, file_id (nullable — can also flag a relationship/event), reason, suggested_classifications, questions, status (`open`|`resolved`), resolution
- `duplicate_groups` / `duplicate_group_members` — for exact + near-duplicate clustering
- `cases` — id, title, case_type, purpose, status, confidence_notes, created_at, updated_at
- `case_links` — case_id, linked_type (`file`|`timeline_event`|`report`|`note`), linked_id, relation_note
- `case_missing_evidence` — case_id, description, priority
- `reports` — id, report_type, case_id (nullable), generated_at, output_paths (json), source_file_ids (json, for citation index)
- `obsidian_notes` — id, entity_type, entity_id, vault_path, last_generated_at, content_hash (to support idempotent regeneration)

`file_metadata` and `classifications` deliberately separate *extracted* fact from *inferred* judgment (per spec `03`'s confidence rule) at the schema level, not just convention — a query for "give me only what the file itself proves" should not require reading application code to know which rows are safe to cite in a legal report.

## 6. Plugin System

Four plugin contracts, each a TypeScript interface in `app/src/core/plugin-api/`:

- **Importer** — `parse(sourcePath) -> { events, files, metadata }`. Implementations: `importer-instagram`, `importer-printful`. A future workspace with no social/Printful presence simply has zero importer plugins active.
- **Classifier** — `classify(file, metadata) -> { category, confidence, reasons }`. The generic core ships a baseline (file-type/EXIF-based) classifier; `classifier-apparel-brand` adds brand-mark and product-category detection layered on top, active only when `modules.assetManagement` + a brand-type workspace.
- **ReportTemplate** — `generate(workspaceData, caseId?) -> { markdown, pdf, citations }`. Implementations: `report-priority-of-use`, `report-trademark-readiness`. A non-brand workspace (e.g. a personal knowledge vault) would have none of these active and instead use a generic "Summary Report" template that ships in core.
- **VaultTemplate** — `renderNote(entity) -> markdown`. Supplies the Obsidian frontmatter/body shape per entity type; core's `VaultGenerator` service handles file writing, backlink indexing, and idempotency, the template only owns note *content*.

Each plugin ships a `plugin.json` manifest declaring its `id`, `type` (one of the four contracts above), and `activatesOn` (which `workspace.json` module flags turn it on). The platform's plugin loader reads every `plugin.json` under `app/src/plugins/*` at startup and, per active workspace, activates only the plugins whose `activatesOn` flags match that workspace's `modules`. This is what makes "toggle `printful: false` in a future workspace and the Printful importer, its dashboard widget, and its timeline simply don't appear" true by construction rather than by if-statements scattered through the UI.

## 7. Case Builder Module

Addresses the feature explicitly required by this task.

**Data model:** `cases` + `case_links` + `case_missing_evidence` (§5). A case is a named container of *references* — `case_links` rows pointing at `file_id`, `timeline_event_id`, or `report_id` — never a copy of the underlying file. This is what "cases reference files, not duplicate them" means concretely: deleting a case deletes rows, never evidence; the same file can belong to any number of cases simultaneously (e.g. the same logo file supports both the Trademark Registration case and the Media Kit case).

**Service surface (`CaseBuilderService`):**
- `createCase(workspaceId, caseType, title, purpose)`
- `linkEvidence(caseId, linkedType, linkedId, note)` / `unlinkEvidence(...)`
- `addConfidenceNote(caseId, note)`
- `flagMissingEvidence(caseId, description, priority)`
- `buildExportPackage(caseId)` → assembles a ZIP/PDF by **copying** the currently-linked files into an export folder (this is the one place copies are made — deliberately, and only at export time, never in the working data model) plus a generated `Case_Report.pdf`/`.md` and an Obsidian case note.

**Initial case types** (from `workspace.json.caseTypes` and this task): Trademark Registration, Trademark Opposition, Copyright Registration, Investor Due Diligence, Brand Acquisition, Media Kit, Product Launch, Historical Timeline. These are *seed data* for the Fatletic workspace, not hardcoded case types in core — a future workspace's `caseTypes` array can list a different set entirely (or none).

**Fatletic's initial cases** (to be created once implementation starts, not now): FATLETIC Trademark Registration, Priority of Use Dossier, FATLETE Comparison, Brand History Archive, Media Kit.

**Rules enforced by the service layer, not just documentation:** confidence < 70 is force-routed to `review_queue` rather than linked directly (mirrors spec `05`); report generation refuses to emit a sentence containing "proves" (a lint pass over template output, plus a house style guide the report templates must follow — "supports," "indicates," "appears to show"); every generated report line that states a fact must carry at least one `source_file_id` citation, enforced by the `ReportTemplate` contract requiring a citations array to be non-empty for any factual claim.

## 8. Dashboard Architecture — Mission Control

The dashboard is a **widget registry**, not a fixed page list, so it scales to workspaces with different active modules without per-workspace UI branching.

`DashboardDataProvider` (core) exposes one query method per widget type; `DashboardWidget` (plugin contract) pairs a widget's UI component with the module flag(s) that activate it. The shell renders whichever widgets are active for the currently-selected workspace.

Widgets required by this task, each with its module-flag gate:

| Widget | Gated by | Data source |
|---|---|---|
| Workspace Overview | always on | file counts, module summary |
| Asset Library | `assetManagement` | `files` + `classifications` |
| Timeline | `assetManagement` | `timeline_events` |
| Knowledge Graph | `assetManagement` | `relationships` |
| Trademark Readiness | `trademarkReadinessReport` | `reports` (latest of that type) |
| Priority of Use | `priorityOfUseDossier` | `reports` |
| Case Builder | `caseBuilder` | `cases`, `case_links` |
| Evidence Gaps | `caseBuilder` or report-driven | `case_missing_evidence` + report gap sections |
| Needs Review | always on if `review_queue` non-empty | `review_queue` |
| Logo Evolution | `assetManagement` + brand-type workspace | `relationships` filtered to logo category |
| Customer Timeline | `assetManagement` | `timeline_events` filtered by type |
| Product Timeline | `assetManagement` | `timeline_events` filtered by type |
| Instagram Timeline | `instagram` | importer-populated `timeline_events` |
| Printful Timeline | `printful` | importer-populated `timeline_events` |
| Reports | always on | `reports` |
| Exports | always on | export job history |
| Duplicate Detection | always on | `duplicate_groups` |
| Hash Verification | always on | re-hash-on-demand job status |
| Plugin Status | always on | plugin loader's active-plugin list |
| Obsidian Vault Status | `obsidian` | `obsidian_notes` (count, last generated, drift check) |

## 9. Obsidian Vault Generation

Generic `VaultGenerator` core service + per-workspace `VaultTemplate` plugin, activated by `modules.obsidian`. Output path comes from `workspace.json.paths.obsidianVault` (defaults to `06_Obsidian/` if unset, matching the Fatletic instruction). Behavior:

- One note per entity that has an id in the DB: file/asset, case, report, timeline event, milestone.
- Notes use YAML frontmatter (entity type, id, confidence, dates, source file hash) plus a Markdown body, and link to related entities via `[[Obsidian wikilinks]]` — e.g. a Case note backlinks to every linked evidence file's note, a Timeline Event note backlinks to its supporting files.
- Generation is idempotent: `obsidian_notes.content_hash` lets regeneration skip unchanged notes and only rewrite what actually changed, so re-running vault generation doesn't create noisy diffs or clobber any manual edits a user made in Obsidian without at least warning them (open question — see `QUESTIONS.md`).
- The vault folder itself is *generated output*, not raw evidence — it should not live under the same gitignore treatment as raw evidence necessarily; this needs an explicit decision (see `QUESTIONS.md` and `ARCHITECTURE_DECISIONS.md` ADR-005).

## 10. Evidence Integrity Model

Unchanged from the existing specs, restated as a cross-cutting architecture constraint rather than a single spec's concern: every service in the Core Platform layer (§2) may open raw evidence files for reading (to hash, extract metadata, generate a thumbnail) but the file-system write path for any service other than `ExportEngine` and `VaultGenerator` is restricted to `workspaces/<id>/.brandos/`. This should be enforced structurally (a single shared `WorkspaceFs` wrapper that raw evidence access goes through, which exposes `read()` but no `write()`/`rename()`/`delete()` for paths outside `.brandos/`), not just by convention — convention is exactly what got the current specs into "Fatletic-only" trouble in the first place.
