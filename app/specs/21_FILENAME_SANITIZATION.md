# Filename Sanitization (Reports & Exports)

## Purpose
Ensure generated reports, exhibits, and export packages never expose raw original filenames that could be unprofessional, offensive, or irrelevant to the evidentiary claim being made — while preserving full internal chain-of-custody traceability.

## Scope
Applies only to generated output intended for external or formal viewing: reports (Markdown/PDF), export packages, and any UI view explicitly marked "export preview." Does **not** apply to the internal dashboard, file explorer, or review queue, where the user is expected to see real filenames while working day to day.

## Rule
- Original files and their filenames are never renamed, modified, or altered on disk by this spec. This governs only what appears in *generated* documents.
- Every file cited in a generated report or export is referenced by a safe asset ID (e.g. `Asset #0142`) or exhibit label (e.g. `Exhibit A-14`) plus its SHA-256 hash — never by its raw original filename.
- A private, non-exported citation index (e.g. `Supporting_Evidence_Index.csv`, kept inside the workspace's `.brandos/` folder, or included only in an attorney-only export bundle) maps each safe asset ID back to its original path, filename, and hash — full traceability is preserved for anyone with legitimate access.
- The user may optionally set a `display_name` per file (stored in the database, additive only) to use in place of the generated label in reports. Setting a `display_name` never renames or touches the original file.
- This applies uniformly to every cited file, not only ones a human has manually flagged as sensitive — behavior must be predictable and must not depend on someone remembering to flag a file first.

## Where Enforced
- **`ReportTemplate` plugin contract:** templates receive only safe asset IDs/hashes for citation from the Report Generator core service — raw filenames are never passed into template rendering.
- **`CaseBuilderService.buildExportPackage()`** (see `17_CASE_BUILDER.md`): files copied into an export bundle are renamed to their safe asset ID in the bundle's file listing. The citation index travels separately from the client-facing PDF, and only to audiences the user explicitly approves (e.g. an attorney), never embedded in a document meant for broader circulation (e.g. an investor deck or media kit).

## Non-Goals
This spec does not classify or judge file content — it is a uniform citation mechanism, not a content moderation system.
