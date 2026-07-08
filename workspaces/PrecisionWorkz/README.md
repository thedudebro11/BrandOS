# Precision Workz Workspace

This is a structural stub, not an active brand archive yet. It exists to prove that BrandOS's core platform, plugin activation, and dashboard require no per-workspace code changes: a second workspace with entirely different (currently all-inactive) modules should run against the exact same core services as Fatletic.

## Status
Planned. No evidence has been imported. No modules are active yet (see `workspace.json`).

## When This Workspace Becomes Active
1. Update `workspace.json`: set `status` to `active`, enable the relevant `modules`, and fill in `importantMarks` if this is a trademark-relevant brand.
2. Add raw evidence files directly under this folder, following the same evidence-handling rules as any BrandOS workspace (below).
3. Run a scan to generate `.brandos/` (per-workspace database, manifests, cache) and, once ready, the Obsidian vault.

## Evidence Handling
Identical rules to every BrandOS workspace:
- Never delete, overwrite, rename, or modify original evidence files without explicit approval.
- Original files are preserved, hashed, indexed, and referenced before any organized archive view is created.
- Cases reference files, not duplicate them.
