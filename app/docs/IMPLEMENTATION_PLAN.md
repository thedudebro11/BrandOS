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

## Phase 6 — Knowledge Layer & Obsidian Integration (COMPLETE, 2026-07-08)

Approved scope, sequenced ahead of the originally-planned Importers/Plugin-Loader phase by explicit user direction: expose the already-validated knowledge graph as a generated, human-readable Obsidian vault, with BrandOS remaining the sole source of truth. See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 6 section, and `PHASE_6_KNOWLEDGE_LAYER_VALIDATION_REPORT.md` for the full record.

Delivered: a vault generator built entirely on existing engine aggregators (no new data logic — only Markdown formatting), delimited-block edit preservation (resolving ADR-008's open question), content-hash incremental regeneration proven at real scale (213-note Fatletic vault regenerates only what actually changed), a Living Knowledge Review engine (real broken-link/orphan/staleness checks, delegating to Phase 3.5's validation engine rather than duplicating it), and real generation against both Fatletic (213 notes) and PrecisionWorkz (9 notes, fully isolated). Also fixed, at the source, a real bug this phase's own content surfaced: `AssetIntelligenceView` never included the Phase 3.5 resolved-date, meaning both the vault and Mission Control's Asset Detail page were silently showing raw (in Fatletic's case, epoch) timestamps as fact — fixed once, benefiting both surfaces.

Section 10's 100,000-note/millions-of-links performance target was addressed architecturally (the incremental hash-skip mechanism is the right shape for that scale) but not empirically load-tested with synthetic data — stated plainly, not implied to be proven, since fabricating fake notes to produce an impressive benchmark would contradict the phase's own "never invent facts" principle.

## Phase 7 — Import Framework & Plugin Runtime (COMPLETE, 2026-07-08)

Approved scope, explicitly trimmed by the user ahead of implementation: "Build what can be validated. Document what cannot. Do not fabricate integrations simply to satisfy the specification." See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 7 section, and `PLUGIN_VALIDATION_REPORT.md` for the full record.

Delivered: a production plugin runtime (`core/plugin-runtime/`) with real manifest validation, engine/dependency compatibility checking, per-workspace activation off `modules` flags, and one error-isolation choke point every plugin call goes through (a plugin failure never crashes another plugin or another workspace — verified, not just designed); a shared import pipeline (`services/import-pipeline/`) that `runScan()` itself now runs through, making "no importer bypasses the pipeline" a structural fact rather than a convention; two fully real, tested Importer plugins (Generic Folder — the reference implementation — and ZIP Archive, with a real `<zipRelPath>::<entryName>` provenance convention and idempotency proof); Instagram and Printful plugins with real registration/activation/compatibility-checking but explicitly no fabricated extraction logic, each documented in its own `BLOCKED.md`; a permanent Golden Dataset regression baseline (`tests/golden-dataset/`), runnable both under vitest and as a standalone CLI gate; and `docs/PLUGIN_SDK.md`. One real environment-driven discovery along the way — `require()` cannot load an arbitrary plugin module under vitest's module graph — resolved via dynamic `import()` and documented as ADR-012, the same pattern as ADR-009/ADR-011's prior tooling substitutions.

Explicitly deferred, per the trimmed scope's own "if a plugin cannot be validated today, implement only the runtime and document the remaining work" instruction, and carried forward rather than silently dropped:
- Broadening relationship detection beyond the single stem-matching heuristic, and the recommended mtime-accuracy fix (both from the original pre-trim Phase 7 draft) — real Instagram/Printful data would be needed to meaningfully exercise either, so both wait on the same blocker as the two plugins' extraction logic.
- The Obsidian Vault Status dashboard widget (drift detection using `obsidian_notes.has_manual_edits`, already tracked by Phase 6) — dashboard work, out of this phase's knowledge-layer-adjacent scope.
- Phase 5's 3 audit findings (duplicated row-mapper, 2 dead functions, `app/shared/`/`app/scripts/`/`app/obsidian-temple/` scaffolding directories) — `app/src/plugins/`, the one of the four with a real near-term purpose, is now populated; the other three remain untouched.
- Import cancellation/resume/rollback — the two real importers complete synchronously in seconds against real data; a resumable-job state machine for that would be speculative infrastructure with no real case to validate it against yet.

## Phase 8 — Professional Reports & Evidence Binders (COMPLETE, 2026-07-08)

Approved in full (all 9 report types, all 4 output formats each) after a scoping check. See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 8 section, and `PHASE_8_REPORTS_VALIDATION_REPORT.md` for the full record.

**Note on architecture divergence from this plan's original placeholder (written before Phase 7 existed):** the original draft above assumed reports would be `ReportTemplate` *plugins* (per ADR-002/spec 19), with `report-priority-of-use`/`report-trademark-readiness` as plugin ids. The user's actual Phase 8 instructions specified a different, simpler architecture instead — a plain report registry + generator + validation engine, with report content generators as regular TypeScript modules, not plugins. This is a deliberate instruction from the user for this phase, not a missed requirement: `ReportTemplate` remains plugin-contract-only (unchanged since Phase 1, still no runtime support — see Phase 7's own note on this), and reports are their own first-class subsystem instead.

Delivered: 9 real report generators (Trademark Readiness, Priority of Use Dossier, Evidence Binder, Brand History, Case Summary, Missing Evidence, Needs Review, Duplicate Assets, Workspace Health), each composing only existing engines; 4 renderers (Markdown/HTML/PDF-ready-HTML/JSON) sharing one `ReportData` model; a validation engine that mechanically enforces "every claim must cite" and caught a real bug pattern across 6 of the 9 generators during development; deterministic content hashing, proven with real before/after data-change tests; `case_links` finally used for `linked_type = 'report'` (schema field has existed since Phase 3); and a real pre-existing evidence-engine bug (duplicate gap accumulation) found and fixed at the source. Verified against both real Fatletic data (up to 633 citations in one report) and PrecisionWorkz's empty evidence tree (zero crashes across all 8 workspace-scoped report types).

Explicitly not done this phase, carried forward:
- Fatletic's cases getting *systematically* linked with real evidence (one report was linked to one case as a live proof of the mechanism; the other 4 cases and broader evidence-linking work remain a human/Mission-Control-UI task, unchanged from Phase 4's original framing).
- Export packages (ZIP bundles: Attorney Review, Trademark Filing Prep, Media Kit, etc.) — the 4 per-report output formats satisfy this phase's actual spec; bundling multiple reports/assets into a single delivery package is a distinct, not-yet-requested capability.
- Report caching/skip-if-unchanged (unlike Phase 6's vault notes) — reports always fully regenerate on request; worth reconsidering only if reports become scheduled/automatic rather than explicitly triggered.
- Phase 7's own carried-forward items (relationship broadening, mtime fix, Vault Status widget, remaining Phase 5 audit findings) — untouched this phase, still blocked on the same items noted in Phase 7's entry above.

## Phase 9 — Visual Knowledge Graph & Timeline Explorer (COMPLETE, 2026-07-08)

Approved in full after a scoping check. Explicitly sequenced by the user ahead of AI: "Before introducing AI, I want BrandOS users to be able to see and explore the knowledge graph visually." See `CHANGELOG.md`, `ARCHITECTURE_REVIEW.md` Phase 9 section, and `PHASE_9_GRAPH_VALIDATION_REPORT.md` for the full record.

**Note on scope relative to `ROADMAP.md`:** Visual Knowledge Graph and Timeline Explorer were both listed as BrandOS v2.0 (platform expansion) examples in the roadmap refinement immediately preceding this phase. Building them now, ahead of the originally-next "Platform Hardening & Release Readiness" phase, was an explicit, direct user instruction, not a scope drift — `ROADMAP.md` has been updated accordingly (see below) to mark these two v2.0 items delivered while the hardening phase (Security, Backup Strategy, final Verification) is renumbered to Phase 10, since ADR-007 — the one hardening item this phase's spec explicitly folded in as a gating "Special Requirement" — is now genuinely complete.

Delivered: the Knowledge Graph extended from 4 to all 9 node types the spec named (workspace, evidence, report, obsidian_note, plugin joining the existing asset/case/tag/timeline_event), verified against real Fatletic data (1,061 nodes, 1,274 edges); one parameterized breadth-first Path Discovery engine covering all 6 requested kinds (shortest/evidence/relationship/timeline/case/dependency), including a real, tested directional-only `dependency` kind; a full-reachability Evidence Path Explorer; a Node Inspector composing every Section 5 field from existing engines; a filterable, year-grouped Timeline Explorer; and — the phase's gating special requirement — **ADR-007 Safe Citation Mode**, fully implemented as a single generator-agnostic layer in the report pipeline, default-on, with a real gap (an uncited cross-referenced asset filename leaking through Chain of Custody prose) found and fixed via real Fatletic report generation before the test suite was even written. Three new frontend pages (Knowledge Graph, Timeline Explorer, Evidence Path Explorer) added `cytoscape` as this project's first graph-visualization dependency. 22 new tests, 178 total, all passing; both packages typecheck and build clean; every new API endpoint verified live against real Fatletic data.

Explicitly not done this phase, carried forward:
- True canvas-level viewport virtualization for very large graphs — the real mitigation shipped is progressive disclosure (hub-only default view, on-demand neighbor expansion), sufficient at Fatletic's real ~1,000-node scale; a dedicated virtualization layer remains future work if a workspace's graph grows an order of magnitude larger.
- No browser-based visual/UI test exists for any of the 3 new pages (or any Mission Control page before them) — verification this phase was real but module/API-level (Vite dev-server transform checks, live curl against every new endpoint), not a rendered-pixel check, stated plainly rather than implied as complete.
- Phase 7's and Phase 8's own carried-forward items — untouched this phase, still open.

## Phase 10 — Platform Hardening & Release Readiness

Renumbered from this plan's earlier "Phase 9" placeholder now that Phase 9 is real work (Visual Knowledge Graph). ADR-007, this placeholder's single most load-bearing item, is now complete (Phase 9) — the remaining scope is real but smaller than originally framed.

- Encrypted archive copy option, backup reminders per spec `16`'s 3-2-1 strategy.
- Re-hash-on-demand verification job + Hash Verification widget.
- Full pass against `IMPLEMENTATION_CHECKLIST.md` (needs regeneralizing alongside the specs in Phase 1).
- Natural point to also pick up Phase 7's, 8's, and 9's carried-forward items above if still relevant — this is now the last item standing between BrandOS and a declared v1.0 per `ROADMAP.md`'s Release Criteria.

## Explicit Non-Goals for This Plan

- No OCR, AI-assisted descriptions, or near-duplicate image clustering beyond the basic perceptual-hash pass pulled into Phase 4 — the rest of `ROADMAP.md`'s v2 scope stays deferred.
- No multi-user/server mode — this remains a local-first, single-user tool per workspace owner.
- No second workspace gets *real* evidence populated during this plan — the second-workspace stub (deferred from Phase 1, see above) is a structural genericity test only, not a second full build-out.
