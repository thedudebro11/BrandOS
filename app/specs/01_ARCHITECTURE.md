# Architecture

## Recommended Stack
- Desktop/local-first app: Tauri preferred; Electron only if Tauri creates major implementation blockers (see `ARCHITECTURE_DECISIONS.md` ADR-006).
- Frontend: React + TypeScript + Tailwind.
- Backend: Node.js (or a Rust sidecar under Tauri).
- Database: SQLite, one database per workspace (see ADR-001 and `18_WORKSPACE_CONFIG_SCHEMA.md`).
- Search: SQLite FTS5, or Meilisearch optional.
- Exports: Markdown, PDF, CSV, JSON, ZIP.

## Layers
1. **UI Layer** — dashboard shell, workspace switcher, widget registry (see `11_DASHBOARD.md`).
2. **Application/API Layer** — workspace router, request handlers, job queue.
3. **Core Platform Services** — workspace-agnostic. No workspace, brand, or plugin name may appear as a literal in this layer.
4. **Plugin Layer** — brand-specific or source-specific logic, activated per workspace by config (see `19_PLUGIN_ARCHITECTURE.md`).
5. **Data Layer** — per-workspace SQLite plus generated files (see `18_WORKSPACE_CONFIG_SCHEMA.md`).

## Core Services (Core Platform Layer)
1. File Scanner
2. Metadata Extractor
3. Hashing Engine
4. Classification Engine — baseline categories only; brand-specific classifiers are plugins
5. Human Review Queue
6. Relationship Engine
7. Timeline Engine
8. Evidence Scoring Engine
9. Case Builder (see `17_CASE_BUILDER.md`)
10. Report Generator — core mechanism; specific templates are plugins
11. Export Engine — includes filename sanitization (see `21_FILENAME_SANITIZATION.md`)
12. Vault Generator — core mechanism; note templates are plugins (see `20_OBSIDIAN_INTEGRATION.md`)
13. Dashboard Data Provider

## Plugin Layer (initial set, not exhaustive — see `app/specs/plugins/`)
- Importers: `importer-instagram`, `importer-printful`
- Classifiers: `classifier-apparel-brand`
- Report Templates: `report-priority-of-use`, `report-trademark-readiness`
- Vault Templates: brand-archive note templates

## Core Principle
Original files are sacred. The app may read originals but must never modify, move, rename, or delete them without explicit user approval. This applies identically to every workspace.

## Core Rule: No Hardcoding
No file under the Core Platform Layer may reference a specific workspace, brand name, trademark, or plugin by literal name. Brand-specific or source-specific values come from a workspace's `workspace.json` or from a plugin, never from a literal in core code.
