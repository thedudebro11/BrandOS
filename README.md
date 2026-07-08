# BrandOS

BrandOS is a local-first, multi-workspace platform for building evidence-backed brand and knowledge archives: it scans, hashes, classifies, and relates original files, builds timelines and cases, and generates reports and an Obsidian vault — without ever modifying the originals.

A **workspace** is one brand, business, or personal knowledge vault. Each workspace is self-contained under `workspaces/<id>/`, configured by its own `workspace.json`, and only activates the plugins and dashboard widgets relevant to it. The core platform has no knowledge of any specific workspace, brand, or mark — see `app/specs/01_ARCHITECTURE.md`.

## Workspaces
- **Fatletic** (`workspaces/Fatletic/`) — the first workspace: an active brand archive and trademark evidence vault. See `workspaces/Fatletic/README.md`.
- **Precision Workz** (`workspaces/PrecisionWorkz/`) — a configuration-only stub proving the platform generalizes beyond Fatletic. See `workspaces/PrecisionWorkz/README.md`.

## Repository Layout
- `app/specs/` — platform specs (numbered, core) and `app/specs/plugins/` (brand/source-specific plugin specs).
- `app/docs/` — architecture, implementation plan, risks, open questions, ADRs, changelog.
- `app/prompts/` — build prompts for AI-assisted implementation.
- `app/src/` — application source code (not yet written — platform is still in the spec/design phase).
- `workspaces/` — one folder per workspace; raw evidence stays untouched, generated data lives in `.brandos/` and `<id>_Archive/` (both gitignored by default).

## Status
Specs and architecture are approved through Phase 1b (foundation cleanup). No application code has been written yet. See `app/docs/IMPLEMENTATION_PLAN.md` for the phased build plan and `app/docs/CHANGELOG.md` for what's happened so far.

## Core Rules
- Original evidence files are never modified, moved, renamed, or deleted without explicit approval.
- Every claim in a generated report cites a source file by safe asset ID and hash — never a raw filename (see `app/specs/21_FILENAME_SANITIZATION.md`).
- Nothing in the core platform may hardcode a workspace, brand, or plugin name.
