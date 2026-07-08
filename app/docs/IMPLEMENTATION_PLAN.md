# Implementation Plan

Phased plan from the current Phase 0 (analysis, this document set) through v1. No phase past Phase 0 begins without explicit approval. This plan supersedes `app/MASTER_PLAN.md` and `app/ROADMAP.md`, which described a Fatletic-only build order — see `IMPROVEMENT_PROPOSALS.md` for how those files should be updated or retired.

## Phase 0 — Architecture & Analysis (this deliverable)

- [x] Read every spec, every markdown doc, `workspace.json`, workspace README.
- [x] Analyze repository structure and Fatletic workspace contents.
- [x] Identify architecture conflicts, missing files/folders, risks.
- [x] Produce `PROJECT_ANALYSIS.md`, `SYSTEM_ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `RISKS.md`, `QUESTIONS.md`, `ARCHITECTURE_DECISIONS.md`, `IMPROVEMENT_PROPOSALS.md`.
- [x] **Approved 2026-07-07.** ADR-001, ADR-002, ADR-003, ADR-006 (conditional), ADR-007 approved; ADR-008 added and approved (Obsidian edit preservation, answering Q4). See `ARCHITECTURE_DECISIONS.md`.

## Phase 1 — Spec Generalization (COMPLETE, 2026-07-07)

Scoped narrowly to specs + this plan + the ADR log, per explicit approval. Top-level doc rewrites (`app/README.md`, `PROJECT_OVERVIEW.md`, `MASTER_PLAN.md`, `ROADMAP.md`, `CLAUDE_MASTER_PROMPT.md`, root `README.md`) and repo hygiene (`.gitignore` generalization, `app/.claude` cleanup, second-workspace stub) were **deferred**, not done in this phase — they remain open items for a future approved phase, listed under "Deferred from Phase 1" below.

Completed:
- [x] Rewrote `00_VISION.md`, `01_ARCHITECTURE.md` — platform-generic, no Fatletic hardcoding, plugin/workspace concepts formalized.
- [x] Light-edited `02_FILE_SCANNER.md`, `05_CLASSIFICATION_ENGINE.md`, `07_RELATIONSHIP_ENGINE.md`, `08_TIMELINE_ENGINE.md`, `15_EXPORTS.md` — Fatletic-only language replaced with generic language, Fatletic examples kept as illustrations, minimal diffs.
- [x] Rewrote `11_DASHBOARD.md` as the Mission Control widget-registry spec (satisfies the "Dashboard Mission Control" deliverable — implemented in place rather than as a separate numbered file, since `11` already owned this subject).
- [x] Rewrote `14_ORGANIZED_DIRECTORY_SCHEMA.md` — workspace-templated root folder, module-conditional subfolders.
- [x] Relocated `09_PRIORITY_OF_USE_DOSSIER.md`, `10_TRADEMARK_READINESS_REPORT.md`, `12_INSTAGRAM_ARCHIVE.md`, `13_PRINTFUL_IMPORTER.md` to `app/specs/plugins/` as plugin specs; left short redirect stubs at their original numbers so the numbered sequence has no unexplained gaps.
- [x] Extracted the apparel/brand category list from `05_CLASSIFICATION_ENGINE.md` into a new `app/specs/plugins/classifier-apparel-brand.md` plugin spec.
- [x] Added `app/specs/plugins/README.md` indexing all five plugin specs.
- [x] Added `17_CASE_BUILDER.md`, `18_WORKSPACE_CONFIG_SCHEMA.md`, `19_PLUGIN_ARCHITECTURE.md`, `20_OBSIDIAN_INTEGRATION.md`, `21_FILENAME_SANITIZATION.md`.
- [x] `03_METADATA_ENGINE.md`, `04_HASHING_AND_CHAIN_OF_CUSTODY.md`, `06_HUMAN_REVIEW_QUEUE.md`, `16_SECURITY_AND_BACKUPS.md` left untouched — already fully workspace-generic.
- [x] Updated `ARCHITECTURE_DECISIONS.md` — ADR-001, 002, 003, 004, 006, 007 marked Approved; ADR-008 added (Obsidian edit preservation).
- [x] No original Fatletic evidence files touched, moved, renamed, or deleted. No application code written (specs only, as scoped).

### Deferred from Phase 1 — resolved in Phase 1b, except where noted
- `app/docs/DASHBOARD_WIREFRAME.md` and `app/docs/IMPLEMENTATION_CHECKLIST.md` still reflect the old Fatletic-only page list / checklist — remain deferred, not in scope of Phase 1b either.

## Phase 1b — Foundation Cleanup (COMPLETE, 2026-07-07)

Approved as a follow-up to close out the items Phase 1 deliberately deferred. Still no application code written; no Fatletic evidence touched.

- [x] Rewrote root `README.md` (new file — didn't exist before), `app/README.md`, `app/PROJECT_OVERVIEW.md` to describe BrandOS the platform, with Fatletic named as the first workspace rather than the product itself.
- [x] Replaced `app/MASTER_PLAN.md` and `app/ROADMAP.md` with short pointers to `IMPLEMENTATION_PLAN.md`, removing the outdated "multi-brand support" v2 item (multi-workspace is now Day 1 core architecture, not a future enhancement).
- [x] Rewrote `app/prompts/CLAUDE_MASTER_PROMPT.md` to target platform-first, plugin-aware implementation instead of a Fatletic-only build.
- [x] Generalized root `.gitignore`: `workspaces/Fatletic/*` → `workspaces/*/*` pattern (with `!README.md`/`!workspace.json` negations) so every current and future workspace is covered by one rule; added `.claude/` (Claude Mind local memory store), `tmp/`, and root-level `/backups/*`, `/exports/*` (with `.gitkeep` placeholders) to ignore rules. `app/.gitignore` left untouched — still correctly scoped to app-level build artifacts.
- [x] Investigated `app/.claude`: confirmed it is a git-tracked, 0-byte file (committed in the initial commit), unrelated to the untracked root `.claude/` directory (which is the Claude Mind memory store — `mind.mv2` + lock file, now gitignored per above). No spec or doc references `app/.claude` anywhere. **Not changed** — documented as a likely accidental artifact with a proposed correction (delete it), pending explicit confirmation. See `CHANGELOG.md` and `ARCHITECTURE_DECISIONS.md`.
- [x] Added `workspaces/PrecisionWorkz/` as a configuration-only stub (`workspace.json` with all modules `false`, `status: "planned"`; `README.md` explaining its purpose) — no evidence files, proves the platform's genericity structurally per Risk R1's mitigation.
- [x] Updated `ARCHITECTURE_DECISIONS.md` and this file; added `app/docs/CHANGELOG.md`.

## Phase 2 — Core Engine (COMPLETE, 2026-07-07)

Approved scope: read-only engine only — no UI, no Obsidian generation, no report generation, no AI classification, no evidence reorganization. This phase absorbed what the original plan sketch split across "Phase 2 skeleton" and "Phase 3 safe inventory," since in practice the scanner/hasher/metadata/DB pieces only make sense built and tested together. See `CHANGELOG.md` for the full file-by-file record and real-scan results against Fatletic (199 real files) and PrecisionWorkz (0 files, config-only stub).

Delivered:
- `WorkspaceRegistry` + `WorkspaceConfig` loader/validator, backed by a real `workspace.schema.json` (JSON Schema, via ajv) — validates both real workspace.json files.
- Per-workspace SQLite database (`sql.js` — see ADR-009, a substitution for the originally-planned `better-sqlite3` forced by this environment lacking a C++ toolchain) with a migration runner and 14 tables (workspace, assets, hash_checks, duplicate_groups/members, metadata, relationships, timeline_events, cases, case_links, case_missing_evidence, plugins, scan_runs, logs, plus the internal `_migrations` tracker).
- `WorkspaceFs` — structurally read-only outside `.brandos/`; `writeGenerated()` throws if asked to write anywhere else.
- `FileScanner`: recursive, ignore-rule-aware, skips BrandOS-generated paths and platform config files (`workspace.json`, root `README.md`) so they're never mistaken for evidence.
- `HashingEngine`: streaming SHA-256, duplicate-group detection, `FILE_MANIFEST.json`/`.csv` + `CHAIN_OF_CUSTODY.md` generation, on-demand hash verification (`verify` CLI command).
- `MetadataEngine`: image (EXIF/IPTC/XMP via `exifr`), PDF (`pdf-parse`), PSD and XCF (hand-rolled fixed-header binary parsers — no dependency), SVG, AI (PDF-compatible fallback), JSON, Markdown, plain text; video best-effort via `ffprobe` if present, graceful fallback if not.
- Asset IDs: permanent `AST-00000001`-style IDs assigned once, never reassigned even when a file goes missing (row is marked `status: 'missing'`, never deleted).
- `RelationshipEngine`: one basic, well-justified heuristic (same-directory, matching-filename-stem source→export pairing across psd/xcf/ai → png/jpg/svg/etc.), confidence 90, evidence-noted.
- `TimelineEngine`: file_created/file_modified/imported events always; a `content_date` event when metadata yields a plausible in-file date (EXIF DateTimeOriginal, PDF CreationDate).
- `ImportEngine`: read-only orchestrator wiring all of the above, incremental (unchanged files skip re-hash/re-extract), never touches the evidence tree.
- Event bus with the full planned event vocabulary (including foundation-only events for cases/dashboard/Obsidian that Phase 2 doesn't yet produce or consume).
- `Logger`: every scan/hash/write/skip/error logged to the `logs` table and echoed to console.
- CLI: `npm run scan -- <workspaceId>`, `npm run verify -- <workspaceId> [assetId]`, `npm run list-workspaces`.
- 33 passing tests (vitest) covering config loading, hashing, scanning/ignore rules, all metadata extractors (including synthetic-binary PSD/XCF fixtures), migrations, the event bus, and 7 full import-engine integration scenarios (creation, incremental no-op, content-change re-hash, missing-file handling, duplicate detection, relationship detection, timeline event recording).
- Real end-to-end run against `workspaces/Fatletic/`: 199 files cataloged, 11 duplicate groups found, 3 source→export relationships detected, 0 errors, original evidence tree verified byte-for-byte untouched.

Deliberately not built (per explicit Phase 2 exclusions — deferred to their originally-planned phases): dashboard/UI, Obsidian note generation, report generation, AI-assisted classification, Case Builder logic (schema only), plugin *loading* (schema/manifests defined in specs, no loader implemented yet — Phase 2's classifier/importer work was all built directly rather than through a plugin-loading mechanism, since no non-Fatletic plugin exists yet to prove the loader against; building a loader for a single implementation would be premature abstraction per this project's own stated engineering values).

## Phase 3 — Knowledge Layer (COMPLETE, 2026-07-07)

Approved scope: transform the read-only asset engine into an intelligent knowledge system — no UI, no dashboard, no Obsidian generation, no report generation, no AI classification, no evidence reorganization. See `CHANGELOG.md` for the full file-by-file record and real-scan results, and the new `ARCHITECTURE_REVIEW.md` (created this phase, cumulative from here on) for the detailed retrospective.

Delivered — all ten required systems: rule-based Classification Engine (deterministic, no AI; path-context rules before extension rules; confidence reflects real signal strength), Tag Engine (deterministic suggestions from category + path, every tag carries a reason), Evidence Engine (completeness/continuous-use/priority-of-use scores from documented formulas, gap detection), Case Builder Engine (full service, 8 seeded templates, reference-only linking), Query Engine (discrete typed methods, not a NL parser), Graph Engine (read-time view, no duplicate storage), Provenance Engine (cycle-safe chain traversal), Integrity Verification (broken references, hash mismatches, missing/duplicate/orphaned assets, circular relationships), Search Foundation (unified LIKE-based search, swappable for FTS5/semantic later), and Asset Intelligence (the aggregator composing all of the above by Asset ID). Classification and tagging are wired directly into the scan pipeline (`import-engine.ts`); the other seven engines are on-demand analytical layers over the data the pipeline produces, exercised via `npm run analyze` and 42 new tests.

Also delivered per explicit instruction: `app/docs/ARCHITECTURE_PRINCIPLES.md` (the project's constitution — 10 non-negotiable principles) and `app/docs/ARCHITECTURE_REVIEW.md` (cumulative, to be updated after every future phase too).

Real run against Fatletic surfaced a genuine finding, not a code bug: 100% of timeline events came back with an epoch (1970-01-01) `file_created` date, because WSL's `drvfs` mount doesn't reliably populate filesystem birthtime. Documented in full in `ARCHITECTURE_REVIEW.md` with a recommended fix for a future phase (not fixed in Phase 3, since it's a Phase 2 ingestion concern, not a knowledge-layer one).

## Phase 3.5 — Evidence Reliability & Knowledge Validation (COMPLETE, 2026-07-07)

Approved scope: fix the Phase 3 epoch-timestamp finding architecturally (not a patch), and maximize correctness/trustworthiness/explainability/auditability of everything already built, before any dashboard/Obsidian/reports/AI/exports. No user-facing features. See `CHANGELOG.md` for the full record, `ARCHITECTURE_DECISIONS.md` ADR-010 for the core design, and `PHASE_3_5_VALIDATION_REPORT.md` for real-data validation numbers.

Delivered — all 12 required systems: Timeline Intelligence (multi-candidate date collection from filesystem/EXIF/PDF/PSD/XCF/filename/folder/relationship sources, nothing ever discarded), Timeline Resolution Engine (priority-based winner selection with full reasoning + rejected alternatives, never a silent choice), Date Source Priority (configurable, seeded with the specified default order), Evidence Provenance Engine (traces a resolved date to a hash-verified original asset), Explainable Confidence (classification now carries supporting/missing/conflicting evidence text), Rule-Based Classification Improvements (sibling-majority context boost, known-product-folder-structure rule — no AI), Needs Review Intelligence (every review item now has a suggested action, estimated effort, potential impact), Data Health Engine (epoch/implausible-date detection, broken candidate-date provenance, duplicate metadata — delegates to Phase 3's Integrity Engine for overlapping checks rather than duplicating logic), Evidence Quality Metrics (11 named, formula-documented metrics), Knowledge Validation Engine (9-point pass/fail checklist), Timeline Explanation (built into `resolved_dates.reasoning`), and Future Readiness (every engine designed for reuse by the dashboard/reports/AI phases still ahead).

Also delivered per explicit instruction: `app/docs/PHASE_3_5_VALIDATION_REPORT.md` (real, computed — not hand-written — validation numbers from a full Fatletic scan) and a new `ARCHITECTURE_PRINCIPLES.md`-consistent ADR-010.

**The special requirement was met and proven, not just designed:** the real Fatletic run confirms all 199 `filesystem_created` candidates were correctly detected as epoch and excluded, with the system falling through to `filesystem_modified` (185), real PDF metadata (11), and EXIF (3) — average resolved confidence 52/100, an honest number, not the false 100/verified Phase 2/3 previously assumed.

**New finding surfaced by fixing the old one:** continuous-use score is still weak (1/100) even at 100% timeline completeness, because `filesystem_modified` — while *plausible* — isn't yet independently verified as *accurate* for continuous-use purposes. Documented as a remaining risk, not fixed this phase (needs real commercial/social import data to out-rank it in practice, not just in config).

**Technical debt surfaced, not hidden:** the health-score formula (flat per-issue-count subtraction) hit 0/100 on real data purely from volume of low-severity findings, despite only one real warning-level issue existing. Documented in the validation report as unfit to surface to a dashboard unchanged.

## Phase 4 — Mission Control (COMPLETE, 2026-07-07)

Approved scope, named and sequenced by explicit user direction ahead of the originally-planned Importers/Plugin-Loader phase: a visualization-and-interaction-only dashboard, strictly forbidden from containing business logic (`Dashboard → Query Engine → Knowledge Layer → Database → Core Engine`, never a side path). See `CHANGELOG.md` and `ARCHITECTURE_DECISIONS.md` ADR-011 for the full record.

Delivered: a Node/Express API (`app/src/api/`) exposing the existing engine as thin JSON endpoints (zero new business logic — one small, deliberately engine-layer-placed exception, `bandLabel()`, documented in ADR-011), and a Vite + React frontend (`app/web/`) — Overview (the exact metrics layout specified), Cases (list + detail with all 10 required sections, plus live create/link interactivity), and Priority of Use (the full evidence chain view). Fatletic's 5 named cases seeded as honest empty shells — no assets auto-linked, since that would be inventing an evidence claim no human has curated yet. Also closed out the Phase 3.5-documented health-score formula flaw before it became Mission Control's headline number.

**Architecture decision, explicitly approved:** "Local Web App Now, Desktop Shell Later" (ADR-011) — Tauri (ADR-006's preference) cannot compile in this environment (no Rust toolchain), so the dashboard ships as a local web app now, structured so a desktop shell can wrap it later without a frontend rewrite.

## Phase 4.5 — Mission Control Evolution (COMPLETE, 2026-07-08)

Approved scope: evolve Mission Control from a dashboard into an operational interface, still under the same hard no-business-logic-in-the-frontend rule, re-verified rather than assumed to still hold. See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 4.5 section, and `PHASE_4_5_VALIDATION_REPORT.md` for the full record.

Delivered: three new small engine-layer capabilities (activity feed aggregator, flexible asset filtering, case evidence suggestions), five new/rewritten API routes, a redesigned Overview with real visual hierarchy (hero/mid/low tiers) plus a live Action Center and Activity Feed, four new pages (Asset Detail — closing the Phase 4-flagged gap — Needs Review drill-down, Duplicate Groups drill-down, Evidence Explorer), Case Workspace enrichment (readiness, honest empty-state evidence suggestions, honest Notes/Exports placeholders — no fabricated features), and grouped Cmd+K search results. Two real bugs found and fixed via live testing against real data (a missing string-Asset-ID field in search results, a SQL join edge case in the new filtered-asset query).

## Phase 5 — Platform Consolidation (COMPLETE, 2026-07-08)

Approved scope, explicitly trimmed by the user to four objectives ahead of the originally-planned Importers/Plugin-Loader phase: an engineering-quality phase, not a feature phase. See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 5 section, and `PHASE_5_PLATFORM_VALIDATION_REPORT.md` for the full record.

Delivered: a shared type system (`app/shared-types/`) eliminating the frontend/backend duplication that caused a real Phase 4.5 incident; genuine multi-workspace isolation verification (5 new automated tests plus, for the first time, PrecisionWorkz exercised through the real running API server alongside Fatletic in the same process — not just fixtures); an honest architecture/code audit that found and documented (without auto-fixing) duplicated row-mapping logic, two dead functions, and four scaffolding directories empty since Phase 0/1b; and the platform validation report. Explicitly deferred, per the trimmed scope: API client generation, developer-doc expansion, lint/format tooling, cosmetic refactors, speculative optimization — all noted as future work, not silently dropped.

## Phase 6 — Importers, Fuller Relationships & Plugin Loader

- Basic `RelationshipEngine` (same-directory/matching-stem) already shipped in Phase 2; the Provenance/Graph Engines (Phase 3) can already traverse whatever relationships exist. This phase adds real data sources, not new traversal logic.
- Real plugin loader (`app/specs/19_PLUGIN_ARCHITECTURE.md`) reading `plugin.json` manifests and activating by module flag — deferred four times now (Phase 2, 3, 4, 5) since there was still no second plugin to prove the mechanism against; building it alongside the first two real plugins (`importer-instagram`, `importer-printful`) so the loader is validated against real cases, not a guess.
- `importer-instagram`, `importer-printful` plugins; broaden relationship detection beyond the single stem-matching heuristic as real import data creates more relationship types to detect (e.g. mockup → Printful order → shipment, per the Phase 3 spec's example provenance chain).
- Recommended fix for the epoch-birthtime/mtime-accuracy finding (see Phase 3/3.5 above) belongs here, since accurate dates matter more once real commerce/social import data starts feeding Priority of Use — and Mission Control now has a live view (Priority of Use page) that will visibly improve once this lands.
- Also a natural point to act on Phase 5's audit findings if desired (the duplicated row-mapper, the two dead functions, the four empty scaffolding directories) — documented, not fixed, in Phase 5, and not blocking, but cheap to fold in here.

## Phase 7 — Case Builder Reports & Report Templates

- `report-priority-of-use`, `report-trademark-readiness` plugin templates, with the citation/hash-labeling scheme from ADR-007 built in from the start (not retrofitted). These consume the Phase 3 Evidence Engine's scores and gap list rather than recomputing anything.
- Fatletic's 5 cases (seeded in Phase 4 as empty shells) get real evidence linked — either by hand through Mission Control's now-live linking UI, or assisted by this phase's report generation surfacing candidate evidence for human review.
- Export packages (Attorney Review, Trademark Filing Prep, Priority of Use, Brand History, Investor Due Diligence, Media Kit, Full Archive ZIP).

## Phase 8 — Obsidian Vault Generation

- `VaultGenerator` + `vault-templates-brand-archive` plugin, with the edit-preservation strategy from ADR-008 (content-hash drift detection, never silently overwrite a hand-edited note); first real generation targets `workspaces/Fatletic/06_Obsidian/`. Track only the reusable template at `app/obsidian-template/` in git — live per-workspace vaults stay gitignored (Phase 1b `.gitignore` decision).
- Obsidian Vault Status widget added to Mission Control (drift detection between DB and vault) — the dashboard's existing widget-registry pattern from Phase 4 extends here without new dashboard logic, per the same hard rule.

## Phase 9 — Security, Backups, Polish

- Encrypted archive copy option, backup reminders per spec `16`'s 3-2-1 strategy.
- Re-hash-on-demand verification job + Hash Verification widget.
- Full pass against `IMPLEMENTATION_CHECKLIST.md` (needs regeneralizing alongside the specs in Phase 1).

## Explicit Non-Goals for This Plan

- No OCR, AI-assisted descriptions, or near-duplicate image clustering beyond the basic perceptual-hash pass pulled into Phase 4 — the rest of `ROADMAP.md`'s v2 scope stays deferred.
- No multi-user/server mode — this remains a local-first, single-user tool per workspace owner.
- No second workspace gets *real* evidence populated during this plan — the second-workspace stub (deferred from Phase 1, see above) is a structural genericity test only, not a second full build-out.
