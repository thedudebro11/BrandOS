# Case Builder

## Purpose
Let a workspace assemble named cases without duplicating files. A case is a container of references to evidence, files, timeline events, and reports already known to the workspace.

## Data Model
- `cases` — id, title, case_type, purpose, status, confidence_notes, created_at, updated_at
- `case_links` — case_id, linked_type (`file` | `timeline_event` | `report` | `note`), linked_id, relation_note
- `case_missing_evidence` — case_id, description, priority

## Rule
Cases reference files, not duplicate them (ADR-003). The only operation that copies file bytes is export package generation. Deleting a case never deletes or modifies evidence — it deletes rows in `case_links`, never rows in `files`.

## Case Fields
- case title
- purpose
- related workspace
- linked evidence
- linked files
- linked timeline events
- linked reports
- confidence notes
- missing evidence
- export package
- PDF report
- Obsidian case note

## Initial Case Types
Default set (a workspace's `workspace.json` → `caseTypes` may declare a different set; core falls back to "General Case" if omitted):
- Trademark Registration
- Trademark Opposition
- Copyright Registration
- Investor Due Diligence
- Brand Acquisition
- Media Kit
- Product Launch
- Historical Timeline

## Rules
- Never delete originals.
- Never overwrite originals.
- Never permanently rename originals without approval.
- Never silently guess classifications.
- Confidence below 70 routes to the Human Review Queue, not directly into a case as settled evidence.
- Every claim in a case's generated report must cite source files by safe asset ID and hash — never a raw filename. See `21_FILENAME_SANITIZATION.md`.
- Use objective language: supports, indicates, appears to show. Do not say "proves" unless evidence directly proves the claim.

## Export Package
`buildExportPackage(caseId)` assembles a ZIP/PDF from the case's currently linked files. This is the one operation that copies file bytes; copies go to `.brandos/exports/` or a user-chosen destination. Originals are read-only throughout. The package includes a generated PDF report and an Obsidian case note (see `20_OBSIDIAN_INTEGRATION.md`).

## Fatletic Initial Cases
Workspace-level seed data, not platform defaults:
- FATLETIC Trademark Registration
- Priority of Use Dossier
- FATLETE Comparison
- Brand History Archive
- Media Kit
