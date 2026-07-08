# Export System

## Export Packages
The export mechanism is generic; the specific package list is driven by a workspace's active `caseTypes` and modules, not hardcoded by the engine. Illustrative, from Fatletic:
- Attorney Review Package
- Trademark Filing Prep Package
- Priority of Use Package
- Brand History Package
- Investor Due Diligence Package
- Media Kit
- Full Archive ZIP

## Formats
- PDF
- Markdown
- CSV
- JSON
- ZIP

## Export Rules
- Every exported claim must link back to source files and hash records.
- Every exported document must reference source files by safe asset ID and hash, never by raw original filename — see `21_FILENAME_SANITIZATION.md`. This applies to every export, not only ones a user has flagged as sensitive.
- Export packages are the only point at which original file bytes are copied out of the workspace's evidence tree (see `17_CASE_BUILDER.md`). The copies are new files; originals are never moved, renamed, or modified by the export process.
