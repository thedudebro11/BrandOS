# Architecture Decision Records

Format: Status / Context / Decision / Consequences. All decisions below are proposed pending approval — none are implemented yet.

---

## ADR-001: One SQLite database per workspace

**Status:** Approved (Phase 1, 2026-07-07)

**Context:** The archive DB needs to store files, classifications, relationships, timelines, cases, and reports for every workspace. Two options: a single shared SQLite/Postgres database with a `workspace_id` column on every table, or one independent SQLite file per workspace.

**Decision:** One SQLite database per workspace, at `workspaces/<id>/.brandos/archive.db`, all workspaces sharing an identical schema (no `workspace_id` column needed since the file boundary *is* the workspace boundary).

**Consequences:**
- A workspace folder is fully self-contained — it can be zipped, moved, backed up, or handed to an attorney's IT department without extracting rows from a shared store.
- Structurally impossible to leak one brand's evidence into another brand's report by a bad `WHERE` clause.
- Cross-workspace portfolio views (e.g. "show me all workspaces' trademark readiness scores") require fan-out queries across N files instead of one query — acceptable given N is small (single digits to low tens of workspaces, not thousands) and this is a locally-run tool, not a multi-tenant server.
- Schema migrations must run per-workspace-DB (a migration runner needs to iterate `workspaces/*/.brandos/archive.db`), not once.

---

## ADR-002: Plugin architecture via typed interfaces + declarative manifests, activated by workspace module flags

**Status:** Approved (Phase 1, 2026-07-07) — formalized as `app/specs/19_PLUGIN_ARCHITECTURE.md`

**Context:** `01_ARCHITECTURE.md` lists services as a flat numbered list with no extension mechanism. The task requires that Instagram/Printful importing, apparel classification, and trademark-specific report templates NOT be core-platform code, since a future workspace (e.g. Sales Pro, Safe Steps) won't need any of them.

**Decision:** Four plugin contracts (`Importer`, `Classifier`, `ReportTemplate`, `VaultTemplate`) defined as TypeScript interfaces in `app/src/core/plugin-api/`. Each plugin under `app/src/plugins/<name>/` ships a `plugin.json` manifest naming its contract type and which `workspace.json` module flags activate it. The plugin loader activates plugins per-workspace based on that workspace's `modules` object.

**Consequences:**
- Adding a new brand-specific behavior never requires touching `app/src/core`.
- A workspace with `modules.instagram: false` gets zero Instagram code paths active, not an if-branch that silently no-ops.
- Requires discipline: every time a new "obviously Fatletic" feature is requested, it must be built as a plugin, which is more upfront ceremony than just writing a function in core. This is the direct cost of the "no hardcoding" mandate and should be treated as a deliberate tradeoff, not friction to route around.
- Dashboard widgets need their own lightweight version of this same activation mechanism (see `SYSTEM_ARCHITECTURE.md` §8) — the plugin contract set may need a 5th type (`DashboardWidget`) once UI work starts, or widgets may simply be paired 1:1 with the plugin that produces their data. Left open for the implementation phase.

---

## ADR-003: Case Builder stores references only; files are copied only at export time

**Status:** Approved (Phase 1, 2026-07-07) — formalized as `app/specs/17_CASE_BUILDER.md`

**Decision:** `case_links` rows store `(case_id, linked_type, linked_id)` pointers into existing tables (`files`, `timeline_events`, `reports`). No file bytes are duplicated when evidence is added to a case. The only point where a case's linked files are copied to a new location is `CaseBuilderService.buildExportPackage()`, which assembles a delivery bundle (ZIP/PDF) for an external recipient (attorney, investor).

**Consequences:**
- Directly satisfies the workspace README rule "Cases should reference files, not duplicate them."
- The same evidence file can support arbitrarily many cases with zero storage cost.
- Deleting a case is always safe — it can never delete or orphan an original file.
- Export packages are, by design, the one legitimate place original bytes get copied; this must be clearly distinguished in documentation and UI language from "duplicating," or it will read as contradicting the "never duplicate" rule when it doesn't.

---

## ADR-004: Specs are split into platform specs (generic) and workspace specs (brand-specific), replacing the current all-Fatletic spec set

**Status:** Proposed

**Decision:** See `IMPROVEMENT_PROPOSALS.md` for the full mapping. Summary: specs whose subject is a mechanism (scanning, hashing, classification scoring, review queue, relationships, timeline, exports, security) are generalized in place under `app/specs/` with Fatletic examples replaced by workspace-agnostic language. Specs whose subject is inherently brand/legal-specific (Priority of Use Dossier, Trademark Readiness Report, Instagram/Printful importers) are reframed as **plugin specs** and physically relocate to `app/specs/plugins/` rather than sitting in the numbered core sequence, signaling clearly that they are not core requirements for every future workspace.

**Status:** Approved and implemented in Phase 1 (2026-07-07). `00`–`21` generalized/added per the mapping in `IMPROVEMENT_PROPOSALS.md`; `09`, `10`, `12`, `13` are now redirect stubs pointing to `app/specs/plugins/`.

**Consequences:**
- A future contributor scanning `app/specs/` sees, structurally, which specs are "always true" vs. "true for brand-type/trademark-focused workspaces."
- Required a one-time rewrite pass over the existing files rather than leaving them as-is — completed in Phase 1.

---

## ADR-005: Obsidian vault output is generated content, tracked on disk but not in git, unless the user opts in per-workspace

**Status:** Default implemented in Phase 1b's generalized `.gitignore` (the `workspaces/*/*` ignore-all-except-config pattern covers `.brandos/`, `<id>_Archive/`, and any Obsidian vault folder by default). Not yet explicitly re-confirmed by the user as final — see `QUESTIONS.md` Q7. If the user wants a workspace's Obsidian vault tracked, a `!workspaces/<id>/<vault-path>/` negation can be added per-workspace without changing this default for others.

**Context:** The current root `.gitignore` excludes everything under `workspaces/Fatletic/` except `README.md` and `workspace.json`. A generated `06_Obsidian/` vault would fall under that exclusion today, meaning it's real, useful, user-facing output that never gets backed up via git.

**Decision (proposed):** Generated artifacts (`06_Obsidian/`, `.brandos/`, exports) are excluded from git by default, matching how raw evidence is already treated, since they are regenerable from the DB + originals and can be large/binary-heavy. Backup responsibility for generated output shifts to the existing `16_SECURITY_AND_BACKUPS.md` 3-2-1 strategy (external drive / cloud), not git. This should be stated explicitly in the workspace README so "why isn't my Obsidian vault in git" is never a surprise.

**Consequences:** If the user actually wants the Obsidian vault version-controlled (e.g. to track how brand history notes evolve over time, independent of a full backup), this decision needs to be overridden per-workspace via an explicit `.gitignore` negation — flagged as a question rather than assumed.

---

## ADR-006: Stack carries over from the existing spec, generalized

**Status:** Proposed (low-risk — the existing spec's stack choice is sound and not Fatletic-specific)

**Decision:** Keep `01_ARCHITECTURE.md`'s stack: React + TypeScript + Tailwind frontend, Node.js backend, SQLite storage (per-workspace, ADR-001), Markdown/PDF/CSV/JSON/ZIP exports. **Tauri is the preferred shell; Electron is the fallback only if Tauri creates major implementation blockers** (answer to `QUESTIONS.md` Q1).

**Status:** Approved with the above conditional (Phase 1, 2026-07-07).

**Consequences:** None of the plugin/case-builder/dashboard design in `SYSTEM_ARCHITECTURE.md` depends on which of the two is chosen — the decision only affects packaging and the native/plugin bridge implementation detail. The Tauri-vs-Electron call should be made concretely at the start of Phase 2 (core platform skeleton), the first phase that actually needs a shell — if Tauri's Rust-sidecar model makes the plugin loader (ADR-002) significantly harder to implement than Electron's Node-native `require()`-based loading, that's the trigger condition for falling back to Electron.

---

## ADR-007: Sensitive raw filenames are hash-referenced, never echoed verbatim, in generated legal/export documents

**Status:** Approved (Phase 1, 2026-07-07), implemented (Phase 9, 2026-07-08) as Safe Citation Mode — scope confirmed as generated reports/exports only; originals remain unchanged on disk. Formalized as `app/specs/21_FILENAME_SANITIZATION.md`.

**Context:** Multiple raw evidence filenames in `workspaces/Fatletic/Fatletic Offical Logos/` and `workspaces/Fatletic/Variations of Offical Logo/` contain profanity/slurs (informal internal nicknames from early development). Spec rules forbid renaming originals without approval, but a generated Trademark Readiness Report or Priority of Use Dossier that's meant for an attorney or the USPTO must never surface those raw filenames verbatim in a formal exhibit. Phase 8 shipped all 9 report types without this protection — flagged there as the single most significant open gap, and named explicitly as a gating "Special Requirement" in Phase 9's own spec ("before any third-party report is considered production-ready... before AI or public-facing exports build on the report system").

**Decision, as implemented (Phase 9):** Every report gets a `citationMode: "safe" | "full"` (default `"safe"`) applied once, centrally, in `report-generator.ts`, by `safe-citation.ts` — never inside an individual report generator. In safe mode: every real filename/path is replaced with a sequential `Exhibit A-N` label everywhere it would otherwise appear in narrative text; Asset IDs (`AST-########`) are never redacted, since ADR-007 asks that they be the default reference, not hidden too; a clearly-marked "Supporting Evidence Index (Internal — Do Not Distribute)" section, appended to the same document, maps every exhibit label back to its real filename/path/SHA-256 — preserving full internal traceability within the artifact rather than as ADR-007's originally-proposed separate `Supporting_Evidence_Index.csv` file. `citationMode: "full"` (CLI: `--full`) opts out explicitly for internal-only use.

**Why one central function, not per-report-template logic (as ADR-007's original Phase 1 text assumed):** Phase 8 had already shipped 9 report generators as plain functions, not `ReportTemplate` plugins (see `IMPLEMENTATION_PLAN.md` Phase 8's architecture-divergence note) — retrofitting redaction into each one individually would mean 9 places to get it right and 9 places a 10th report type could forget it. Instead, `safe-citation.ts` operates on the already-assembled `ReportContent` (sections + citations), scanning every active asset's real filename/path against the report's actual rendered text and substituting — mechanical, generator-agnostic, and automatically applied to any future report type with zero additional code.

**A real gap found during implementation, not assumed away:** the first version scoped the redaction dictionary to a report's own `citationIndex`, and testing against real Fatletic output found this missed Evidence Binder's Chain of Custody section — `traceResolvedDateProvenance()`'s "Cross-Referenced Source Asset" line can name a *different* asset than the one being traced, one that was never independently added as a `Citation`. Fixed by scanning every active asset's real filename/path against the report's actual text rather than trusting the citation list to be complete.

**Consequences:**
- Verified against real Fatletic data: zero filename/path leakage in any narrative section across all 9 report types (`tests/core/safe-citation.test.ts`, 7 tests); deterministic (identical content hash and identical exhibit numbering on regeneration); fully reproducible (every exhibit-labeled citation still resolves to a real Asset ID).
- Known limitation, stated rather than hidden: redaction is exact-substring replacement, not semantic — a filename that happens to be a substring of unrelated text would also be redacted. Not observed in any of the 9 report types' real output against Fatletic's real filenames; a real edge case for very short/generic filenames, worth knowing rather than assuming away.
- The `display_name` column and the separate CSV file, both floated in ADR-007's original Phase 1 text, were not built — the in-document Supporting Evidence Index section satisfies the same traceability requirement with less new surface area (no new schema column, no second file per report to keep in sync).

---

## ADR-008: Obsidian vault regeneration preserves manual user edits via content-hash drift detection

**Status:** Approved and implemented (Phase 1 decision, 2026-07-07; implemented Phase 6, 2026-07-08) — answers `QUESTIONS.md` Q4

**Context:** ADR-005 covers whether generated output is tracked in git; it does not address a separate, confirmed-real scenario: the user intends to hand-edit generated Obsidian notes directly in Obsidian. A naive vault generator that always overwrites on regeneration would silently destroy those edits (Risk R11).

**Decision:** Every generated note's content hash is tracked in `obsidian_notes.content_hash`. On regeneration: if the note on disk still matches the last tracked generated hash, it is safely rewritten. If it no longer matches (user has edited it), the generator does not overwrite. **The open choice between "sibling file" and "delimited block" is now resolved: delimited block.** All generated content lives between `<!-- brandos:generated:start -->` and `<!-- brandos:generated:end -->` markers; anything a user writes below the end marker is preserved verbatim across regenerations, and the content hash covers only the generated block (not the whole file), so a user's own additions never themselves count as "drift." If the generated block itself no longer matches its last known hash (the user edited inside the markers), the writer refuses to overwrite and reports `skipped_manual_edit` rather than silently clobbering the edit. Formalized as `app/specs/20_OBSIDIAN_INTEGRATION.md`; implemented in `app/src/core/services/vault-generator/edit-preservation.ts`.

**Why delimited block over sibling file:** a sibling `.generated.md` file would have split one conceptual note into two files a user has to know to look at, and doesn't compose with Obsidian's own backlink graph (links would need to target whichever file, ambiguous). A single file with an internal boundary keeps the note atomic from the user's perspective — open one file, generated content up top, your notes below — while still being a precise, mechanically-checkable boundary for the generator.

**Consequences:**
- Verified with real hand-edit scenarios, not just designed on paper: `tests/core/vault-generator.test.ts` covers both content-below-the-marker (preserved across regeneration) and hand-edits-inside-the-generated-block (detected, refused, reported as `skipped_manual_edit`) — also exercised live against a real Fatletic asset note (`Assets/AST-00000114.md`) during Phase 6 development.
- The Obsidian Vault Status dashboard widget (diff/merge surfacing for detected drift) was deferred out of Phase 6's scope — Phase 6 was scoped to the knowledge layer and vault generator themselves, not Mission Control UI — and is now tracked as a Phase 7 item in `IMPLEMENTATION_PLAN.md`. The `obsidian_notes.has_manual_edits` column already records the state that widget would surface; only the UI is missing.
- Slightly more implementation complexity in `VaultGenerator` than a naive overwrite-always approach — accepted as a direct requirement, not optional polish, given the user confirmed they intend to hand-edit notes.

---

## ADR-009: sql.js (WASM SQLite) instead of better-sqlite3

**Status:** Approved and implemented (Phase 2, 2026-07-07)

**Context:** ADR-001/ADR-006 assumed a native SQLite driver (`better-sqlite3`). This development environment (WSL, no `gcc`/`make`) cannot compile native Node addons, and the Node version here (v20.20.2) predates the built-in `node:sqlite` module (requires Node 22.5+). `better-sqlite3` install was attempted and failed with a `node-gyp` "not found: make" error.

**Decision:** Use `sql.js` (SQLite compiled to WebAssembly) instead. No native compilation, works identically across platforms Node runs on. Implemented as a `WorkspaceDatabase` wrapper (`app/src/core/db/connection.ts`) providing `run`/`get`/`all`/`exec`/`transaction` methods with an explicit `save()` that exports the in-memory database and writes it to `<workspace>/.brandos/archive.db`.

**Consequences:**
- **Trade-off accepted:** sql.js has no live file-backed mode — the whole database lives in memory and must be explicitly exported+written to persist. The engine handles this by saving once at the end of a scan (in a `finally` block, so partial progress persists even if a scan errors partway through) rather than per-write, which is fine at the file counts a single workspace scan involves (tested against Fatletic's real ~199-file evidence set) but would need revisiting if a workspace's file count grew by orders of magnitude.
- If this code ever runs in an environment with a working C++ toolchain (or Node 22.5+), switching to `better-sqlite3` or `node:sqlite` would only require reimplementing `WorkspaceDatabase`'s internals — every call site uses the same `run`/`get`/`all` interface, not sql.js-specific API, precisely to keep this swap cheap later.
- All Phase 2 tests and the real Fatletic/PrecisionWorkz scans (see `CHANGELOG.md`) ran successfully against sql.js with no functional gaps found.

---

## Housekeeping Finding: `app/.claude` (resolved)

**Status:** Deleted (Phase 2, 2026-07-07), per explicit user confirmation.

**Finding (Phase 1b):** `app/.claude` is a git-tracked, 0-byte regular file (not a directory), committed in the repository's initial commit. It is unrelated to the untracked root-level `.claude/` directory, which is confirmed to be the Claude Mind local memory store (`mind.mv2` + `mind.mv2.lock`) — a different, legitimate, machine-local artifact now covered by the Phase 1b `.gitignore` update. No spec, doc, or config anywhere in the repository references `app/.claude` for any purpose.

**Correction applied:** Deleted via `git rm app/.claude`, confirmed as an unused 0-byte file with no references anywhere in the repo. It appears to have been a stray artifact from initial repo setup (e.g. a `touch` or a failed `mkdir`) rather than an intentional directory placeholder.

---

## Phase 3 Consistency Review

Reviewed against every ADR above and against `ARCHITECTURE_PRINCIPLES.md` before writing any Phase 3 code. No new ADR was required — Phase 3 introduced no new datastore, driver, stack, or workspace-boundary decision; it only added tables and services within the architecture ADR-001 through ADR-009 already established.

- **ADR-001 (per-workspace SQLite):** held — all 9 new tables live in the same per-workspace `archive.db`, no cross-workspace table introduced.
- **ADR-002 (config-driven plugin activation):** held — none of the 10 knowledge-layer engines are workspace-specific; all live in `app/src/core`, none reference "Fatletic" or any brand literal. (Confirmed by grep before finalizing — see `ARCHITECTURE_REVIEW.md` §18.)
- **ADR-003 (cases reference, exports copy):** held and now implemented — `CaseBuilderService` link/unlink methods only ever write/delete `case_links` rows; no code path in the Case Builder copies asset bytes.
- **ADR-009 (sql.js):** held — the knowledge-layer repository layer uses the same `WorkspaceDatabase` wrapper, no new driver.
- **New pattern this phase, consistent with Principle #6 (config over customization):** case templates are seeded data (`case_templates` table) rather than a hardcoded TypeScript enum, so a workspace can gain a custom case type with an `INSERT`, not a code change.

---

## ADR-010: Multi-candidate date model — filesystem timestamps become one candidate evidence source among many, never assumed true

**Status:** Approved and implemented (Phase 3.5, 2026-07-07)

**Context:** Phase 3's real-data run found that 100% of Fatletic's timeline events carried a `file_created` date of Unix epoch (1970-01-01), because WSL's `drvfs` mount doesn't reliably populate filesystem birthtime. The Phase 2/3 design treated `assets.created_at` as a single, trusted `file_created` timeline event with `confidence: 100, verifiedStatus: 'verified'` — directly false on this environment, and risky for any environment, given a system whose purpose includes Priority of Use dating. Phase 3.5 was explicitly scoped to fix this architecturally, not patch around it.

**Decision:** Replace "one date per asset, trusted at face value" with three new tables and a resolution pipeline:
- `candidate_dates` — every date found, from every source (filesystem, EXIF, PDF/PSD/XCF metadata, filename/folder patterns, relationship inference, and future commercial/social importers), stored permanently and never overwritten. Each candidate is checked for plausibility (epoch-proximity, pre-1990, future) and marked accordingly — implausible candidates are *kept*, not deleted, just excluded from winning.
- `date_source_priorities` — a workspace-configurable table ranking source types by trust (Verified Commercial Record > Verified Social Platform > Embedded Metadata > EXIF > Git History > Filesystem Modified > Filesystem Created > Filename Pattern > Folder Context > Relationship Inference > User Confirmed, per the exact order specified), each with an independent `reliability_score` used for confidence math.
- `resolved_dates` — one row per asset, the single answer every other engine should read, carrying the winning date, its confidence, full reasoning, every rejected alternative and why, and a corroborating-candidate count.

Filesystem-created dates specifically get the lowest default `reliability_score` (25) of any active source, reflecting the Phase 3 finding directly in the data, not just in a code comment.

**Consequences:**
- Proven working against real data, not just designed on paper: the Phase 3.5 real run against Fatletic shows all 199 `filesystem_created` candidates correctly excluded as implausible, with the system falling through to `filesystem_modified` (185), real embedded PDF metadata (11), and EXIF (3) — see `PHASE_3_5_VALIDATION_REPORT.md`.
- Average resolved-date confidence dropped to an honest 52/100 on real data, down from Phase 2/3's false 100/verified — a deliberately worse-looking number that is actually more correct, exactly the trade-off Principle #4 ("never overstate confidence") calls for.
- **Known tension, not smoothed over:** the specified default priority order ranks "User Confirmed" *last* (lowest priority_rank, 110) even though a human-confirmed date is intuitively highly reliable — it's given a high `reliability_score` (90) instead, so if/when user confirmation is implemented, a workspace can simply update its `priority_rank` row rather than requiring a code change. Flagged in the migration file and here rather than silently "fixed" by reordering the spec's explicit list.
- New technical debt this decision introduces: `resolved_dates` is single-snapshot (delete-then-insert per asset), not versioned — see `ARCHITECTURE_REVIEW.md` Phase 3.5 section and `PHASE_3_5_VALIDATION_REPORT.md` for the concrete follow-on finding that `filesystem_modified`, while *plausible*, is not yet independently verified as *accurate* for continuous-use purposes.

---

## ADR-011: Local Web App Now, Desktop Shell Later

**Status:** Approved and implemented (Phase 4, 2026-07-07)

**Context:** ADR-006 preferred Tauri, with Electron as fallback "only if Tauri creates major implementation blockers." Phase 4 (Mission Control dashboard) is the first phase needing an actual UI shell. Environment check confirmed no Rust/cargo toolchain exists in this environment — Tauri cannot compile here, the same class of blocker that forced ADR-009's sql.js substitution for `better-sqlite3`. This is exactly the condition ADR-006 anticipated.

**Decision (explicit user approval):** Serve Mission Control as a local web app — a small Node/Express API (`app/src/api/`) exposing the existing Query Engine / Knowledge Layer as JSON endpoints, and a separate Vite + React frontend (`app/web/`) that only calls that API. Frontend and backend are two independently-installed, independently-built packages (`app/package.json` for the engine+API, `app/web/package.json` for the UI) — not a monorepo workspace — so the separation is structural, not just a convention.

**Hard rule enforced, not just stated:** the dashboard contains no business logic. Every API route handler in `app/src/api/routes.ts` is a thin pass-through: parse request params, call an existing engine function (`QueryEngine`, `CaseBuilderService`, `AssetIntelligence`, `EvidenceEngine`, `computeEvidenceQualityMetrics`, `search`), shape the response. The one new computation this phase added (`bandLabel()`, a High/Medium/Low threshold on a 0-100 score) was deliberately placed in `evidence-quality-metrics.ts` (the engine layer), not in a route handler or a React component, specifically so it's reusable by any future consumer, not dashboard-only.

**Consequences:**
- Fully buildable and testable in this environment today: `npm install` (both packages), `tsc --noEmit`, and `vite build` all succeed cleanly; verified end-to-end via real HTTP calls through both the raw API and the Vite dev proxy, including a live case-link mutation that correctly re-triggered `EvidenceEngine.assessCaseEvidence()` with no new logic written to make that happen.
- Portable by design: because the frontend only ever talks to the API over HTTP/JSON, wrapping this exact frontend in Tauri or Electron later (once a toolchain exists) requires no frontend rewrite — only a shell that either proxies to the same Express server or embeds it.
- sql.js's in-memory-per-process model (ADR-009) now also governs the API server: one `WorkspaceDatabase` connection is opened per workspace and cached for the server's lifetime (`app/src/api/db-cache.ts`), with `save()` called explicitly after each mutating request — the same explicit-save discipline as the CLI, extended to a long-running process.
- Also closed a piece of Phase 3.5's own documented technical debt while building this: the health-score formula flagged as "measurably broken" in `PHASE_3_5_VALIDATION_REPORT.md` was recalibrated (percentage-of-assets-affected instead of flat finding-count subtraction, blended with Knowledge Validation pass rate) before being surfaced as Mission Control's headline metric — verified against real Fatletic data going from a nonsensical 0/100 to a defensible 99/100.

---

## Phase 4.5 Consistency Review

No new ADR required — Phase 4.5 extended ADR-011's architecture (local web app, thin API, no frontend business logic) rather than changing it, and re-verified the hard rule under more surface area rather than assuming it still held.

- **The "dashboard has zero business logic" rule was re-checked, not just re-asserted:** every one of the 5 new/changed API routes in this phase composes existing engine functions (`getActivityFeed`, `QueryEngine.listAssetsFiltered`, `CaseBuilderService.suggestUnlinkedEvidence`, `computeEvidenceQualityMetrics`) — the three genuinely new computations (activity aggregation, asset filtering, evidence suggestion) were all written as engine-layer functions before any route touched them, not the other way around.
- **The type-duplication risk flagged in Phase 4's review (§4/§9) materialized exactly as predicted** — a frontend build failure when `SearchResult.stringId` existed on the backend type but not the hand-duplicated frontend one. Fixed by hand this time (both sides updated), but this is now a confirmed, recurring cost, not a hypothetical one; strengthens the case for addressing it directly in Phase 5 rather than deferring again.
- Confirmed structurally, not just by absence of complaints: no workspace/brand literal was introduced in any new engine or API file this phase (all new code takes a `workspaceId` param like everything before it).

---

## Phase 5 Consistency Review

No new ADR — Phase 5 was scoped as platform consolidation, not a new architectural decision. It closed a debt item ADR-011's own review had flagged (type duplication) rather than introducing new architecture.

- **ADR-001 (per-workspace SQLite):** re-verified, not just re-asserted — `tests/core/multi-workspace-isolation.test.ts` proves two workspaces never share a database file or leak a row, and PrecisionWorkz was exercised through the real API server alongside Fatletic in the same process for the first time, confirming `db-cache`'s per-workspace connection map holds under real concurrent use, not just in theory.
- **The type-duplication risk (flagged in Phase 4 §4/§9, confirmed as an incident in Phase 4.5) is now closed**, not just documented again: `app/shared-types/` is the single source of truth for every API contract, imported by both packages, verified via clean typecheck + unchanged build size on both sides.
- **Chose the minimal viable mechanism, not the most complete one:** a plain folder of type-only `.ts` files with relative imports, rather than a new npm package, npm workspaces, or a generated OpenAPI client. This matches the phase's explicit instruction not to spend effort on API client generation — the chosen approach solves the actual documented problem (silent drift) without the larger investment a full client-generation pipeline would require.

---

## Phase 6 Consistency Review

One new ADR-relevant decision this phase (ADR-008's open question, resolved above). Otherwise Phase 6 added a generator and a review engine on top of existing architecture rather than changing it.

- **ADR-001 (per-workspace SQLite):** re-verified under a new consumer — the vault generator was run against both Fatletic and PrecisionWorkz in the same process, producing 213 notes and 9 notes respectively with zero cross-contamination (PrecisionWorkz's vault contains only its own empty-workspace shell, no Fatletic entity ever appears in it).
- **ADR-002 (no business logic outside plugins/core):** held — `note-templates.ts` was deliberately kept to pure Markdown-formatting functions with no DB queries and no inference, so that if a `vault-templates-brand-archive` plugin is ever built (per the original Phase 8 placeholder this phase absorbed), swapping template sets doesn't require touching the generator's write/skip/preserve logic.
- **ADR-005 (generated output stays out of git by default):** held without change — `06_Obsidian/` falls under the same `workspaces/*/*` gitignore pattern as `.brandos/`; only `app/obsidian-template/` (the reusable, non-workspace-specific template) is git-tracked, consistent with the Phase 1b decision.
- **ADR-008 (edit preservation):** implemented this phase, resolved to delimited-block (see above).
- **"Delegate, don't duplicate" pattern (established Phase 3.5, reused Phase 4):** the Living Knowledge Review engine (`knowledge-review.ts`) calls the existing `validateKnowledge()` engine for reference-integrity findings rather than re-implementing that check, consistent with how the Phase 4 Data Health Engine delegates to the Phase 3 Integrity Engine.
- **Real-data verification surfaced a genuine cross-cutting bug, not a Phase 6-local one:** building the vault's Timeline section against real `AssetIntelligenceView` data exposed that `getAssetIntelligence()` (Phase 3) had never been updated when `resolved_dates` (Phase 3.5) was introduced — so Mission Control's Asset Detail page (Phase 4.5) had been silently displaying raw epoch timestamps as fact since it shipped, with no test catching it because no existing test asserted on resolved-date content specifically. Fixed at the source (`asset-intelligence.ts`), not patched in the vault template — the fix automatically corrected both consumers. This is the second time real end-to-end verification against live data (not fixtures) has caught a bug unit tests missed (the first being Phase 3.5's epoch-date discovery itself), reinforcing that this project's testing discipline should keep treating "run it against real Fatletic/PrecisionWorkz data" as a required step, not an optional extra, after every phase.

---

## ADR-012: Plugin modules are loaded via dynamic `import()`, not `require()`

**Status:** Approved and implemented (Phase 7, 2026-07-08)

**Context:** The plugin loader needs to load a plugin's implementation module (`app/src/plugins/<id>/index.ts`) from a path computed at runtime — the whole point of a plugin system being that Core never has a static `import` statement naming a specific plugin. The natural first choice, `require(path.join(dir, "index"))`, works correctly under `tsx` (the CLI/API dev runtime) but throws `MODULE_NOT_FOUND` under `vitest` — confirmed by direct reproduction: a `require()` call for a real, existing, syntactically valid file fails inside Vite's own module graph, because Vite intercepts `require()` and does not resolve arbitrary absolute `.ts` paths outside files it has already discovered through its own transform pipeline.

**Decision:** Use dynamic `import()` instead (`await import(path.join(dir, "index"))`, with a `@vite-ignore` comment so Vite doesn't try to statically analyze the runtime-computed path). Confirmed working identically under `tsx`, the `tsc`-compiled build (TypeScript downlevels `import()` to a `require()`-based helper when `module: "commonjs"`, which resolves normally against compiled `.js` output), and `vitest`.

**Consequences:**
- Same category of decision as ADR-009 (sql.js over better-sqlite3) and ADR-011 (local web app over Tauri): a real, confirmed tooling limitation in this environment/stack, worked around with the most portable available option and documented as a first-class decision rather than a silent patch.
- No behavior change for any plugin author — `ImporterPlugin` implementations still export a default plugin instance exactly as before; only the loader's internal module-resolution mechanism changed.
- This makes plugin modules require care around any Node built-in that behaves differently between `require()` and `import()` semantics (e.g. top-level side effects run at different times) — not an issue for any plugin built so far, since none has import-time side effects beyond exporting a plain object.

---

## Phase 7 Consistency Review

One new ADR this phase (ADR-012, a tooling substitution in the same family as ADR-009/ADR-011). Otherwise Phase 7 built new subsystems (plugin runtime, import pipeline) within the architecture ADR-001 through ADR-011 already established, and closed one Phase 5 audit finding along the way.

- **ADR-001 (per-workspace SQLite):** re-verified under a new consumer — `plugin_registrations`/`plugin_health`/`import_runs` are workspace-DB tables like everything else; the same real-scan proof used throughout this project (Fatletic active, PrecisionWorkz correctly showing `instagram`/`printful` as `disabled`) confirms plugin *state*, not just plugin *discovery*, respects the workspace boundary.
- **ADR-002 (plugin architecture via typed interfaces + declarative manifests):** this is the phase that finally implements the loader ADR-002 described in Phase 1 — five phases (2–6) of correctly waiting for a second real plugin to validate the mechanism against, resolved this phase with four real manifests (two with working `discover()`, two honestly blocked) exercising the exact same loader path.
- **"No importer bypasses the pipeline" is structurally true, not just documented:** the `ImporterPlugin` contract exposes only `discover()` — there is no method on the interface a plugin could use to write an asset, hash a file, or touch the database directly. Everything past discovery is the shared pipeline by construction, not by convention or code review.
- **"Delegate, don't duplicate" pattern (Phase 3.5, reused every phase since):** the new Validation pipeline stage calls the existing `validateKnowledge()` engine rather than re-implementing reference-integrity checks; the Golden Dataset's CLI runner reuses the same engine calls the vitest suite does rather than a separate re-implementation.
- **One Phase 5 audit finding closed, three still open:** `watchWorkspace()` (dead function, zero call sites, confirmed by grep before deletion) was removed while `import-engine.ts` was already being rewritten for this phase — the same "resolve while already touching the file" reasoning Phase 5 itself recommended. The row-mapper duplication and the remaining three scaffolding directories were not touched this phase (out of scope) and remain carried forward.
- **Checked, and corrected here rather than left as an unverified claim:** no *new* plugin-specific literal was introduced under `app/src/core/` by this phase's own code — every Phase 7 occurrence of `"instagram"`/`"printful"` is inside that plugin's own manifest or implementation file, and `ImportSourceRef`'s `"zip"` union member is a generic source *kind* Core would need regardless of which plugin implements it, not a plugin id. However, a grep run while writing this review found this was already **not fully true before Phase 7**: `classification-engine/rules.ts` has pre-existing (Phase 3) hardcoded `pathContains(path, "instagram")`/`pathContains(path, "printful")` checks, and `types.ts`/migration `0003` have pre-existing `DateSourceType` literals (`printful_order`, `instagram_publish`, etc.) seeded in `date_source_priorities`. These predate Phase 7, are unrelated to this phase's own scope, and are flagged here as a real, previously-unexamined gap against ADR-002's "Core may depend on a contract, never a specific plugin" rule — worth a real cleanup pass in a future phase, not silently corrected as part of this one.

---

## Phase 8 Consistency Review

No new ADR — the report engine (registry, generator, renderers, validation) is a new subsystem built entirely within the architecture ADR-001 through ADR-012 already established; no new datastore, driver, stack, or workspace-boundary decision was needed. One deliberate architectural choice worth recording here even though it didn't rise to ADR status: reports are plain registry entries, not `ReportTemplate` plugins (see `IMPLEMENTATION_PLAN.md`'s Phase 8 note) — the user's direct instruction for this phase, not a gap.

- **ADR-001 (per-workspace SQLite):** re-verified under a sixth consumer type (after scan, DB rows, API responses, vault files, plugin state) — `reports` is a workspace-DB table like everything else; real generation against both Fatletic and PrecisionWorkz in the same session, with zero asset-string leakage checked directly by grep against PrecisionWorkz's exports, confirms report generation respects the same boundary.
- **ADR-002 (Core depends on contracts, never implementations):** held — `report-generator.ts` never branches on `ReportType`; it only calls `definition.generate()`. The same discipline Phase 7 established for `ImporterPlugin.discover()` (a contract with no way to bypass the shared pipeline) is reproduced here for reports.
- **ADR-003 (cases reference, exports copy):** extended, not violated — `CaseBuilderService.linkReport()` stores a `case_links` row pointing at a `reports.id`, never a report's content. The report's own 4 output files are the actual "export" in ADR-003's sense — real bytes written once, at generation time, to `.brandos/exports/`, not duplicated anywhere else.
- **ADR-007 (sensitive filenames hash-referenced, never echoed verbatim, in generated legal/export documents):** **partially unaddressed, flagged honestly.** Every report's citations reference asset IDs and, in several sections (chain of custody, hash references), original filenames/paths directly — the citation-index/exhibit-labeling scheme ADR-007 specifies (`Exhibit A-14` style neutral labels plus a private `Supporting_Evidence_Index.csv`) was not built this phase. This matters in practice for Fatletic specifically, since ADR-007's own context notes real filenames in the evidence tree contain profanity/slurs. Not silently accepted: this is a real gap between ADR-007's requirement and what Phase 8 shipped, worth closing before any report generated by this system is actually handed to an attorney or third party (see `PHASE_8_REPORTS_VALIDATION_REPORT.md`'s legal-risk section).
- **"Delegate, don't duplicate" pattern (Phase 3.5, reused every phase since):** applied to the API layer itself this time, not just within the engine — `findConflictingAssets()` and `composeCaseDetail()` were extracted out of the Phase 4.5 API route so the route and the new Case Summary Report/Evidence Binder share one implementation, closing a duplication risk before it could accumulate a second and third copy the way earlier phases' reviews warned about.
- **A second instance of the Phase 6/7 "aggregator-adjacent staleness" risk pattern, caught before shipping this time:** building real reports against real gap data immediately surfaced that `recordEvidenceGap()` (Phase 3) had never received the delete-then-insert treatment ADR-010 gave `resolved_dates` — an append-only table silently accumulating duplicates every time `assessWorkspaceEvidence()` ran. Unlike Phase 6's resolvedDate gap (which shipped for a full phase before being caught) and Phase 7's `require()`/`vitest` gap (caught mid-development), this one was caught and fixed within the same phase that exposed it, before any doc or CLI output was finalized — the fastest turnaround yet of this recurring pattern.

---

## ADR-013: Cytoscape.js for Knowledge Graph rendering

**Status:** Approved and implemented (Phase 9, 2026-07-08)

**Context:** Phase 9 needed the project's first graph-visualization UI. No graph-rendering library existed in `app/web/` before this phase (dependencies were limited to React/React Router). The spec required zoom/pan/expand/collapse/filter/search/path-highlighting over a graph that, against real Fatletic data, has 1,061 nodes and 1,274 edges.

**Decision:** `cytoscape` (canvas-rendered, pure JavaScript, no native compilation) over alternatives considered (`d3-force` + hand-rolled SVG rendering: more flexible but meaningfully more code to reach the same interaction set; `reactflow`: optimized for flow-chart/node-editor UIs, not general graph exploration; `vis-network`: a reasonable alternative, less actively maintained). Same "no native compilation" constraint check every dependency choice in this project has gone through since ADR-009 (sql.js) and Phase 7's `adm-zip` — confirmed before adding it, not after something failed to install.

**Consequences:**
- `GraphCanvas.tsx` is a thin, controlled wrapper: it renders whatever nodes/edges it's given and reports clicks back up; all decisions about what's visible (filtering, expansion, path highlighting) live in `KnowledgeGraph.tsx`, keeping the hard "visual layer never implements its own logic" rule structurally true for the rendering library boundary too, not just the data boundary.
- Frontend bundle grew from ~198KB to ~660KB gzipped-relevant size (208KB gzipped) — a real, measured cost of adding the project's first non-trivial UI dependency, stated plainly in `PHASE_9_GRAPH_VALIDATION_REPORT.md` rather than left for someone else to notice.
- Canvas rendering (not SVG/DOM) is what makes the default hub-only view plus on-demand expansion (Section 7's "lazy loading") viable at real data scale without a dedicated virtualization layer being built this phase — Cytoscape's own rendering already handles the node counts a fully-expanded Fatletic graph would produce.

---

## Phase 9 Consistency Review

One new ADR this phase (ADR-013, a dependency choice in the same family as ADR-009/adm-zip). ADR-007 moved from "approved, not implemented" to "approved and implemented" — the first ADR in this project's history to close that gap after standing open across three prior phase reviews (6, 7, 8) naming it.

- **ADR-001 (per-workspace SQLite):** held — every new table this phase's own code reads (`evidence_assessments`, `reports`, `obsidian_notes`, `plugin_registrations`) is queried per-workspace exactly as before; no new cross-workspace table introduced. Real proof, not assumed: Fatletic's real graph (1,061 nodes) was built and inspected in the same session as PrecisionWorkz's, with zero cross-contamination.
- **ADR-002 (Core depends on contracts, never implementations):** held for a new subsystem — `report-generator.ts`'s new `applySafeCitationMode()` call site takes a `ReportContent` and a mode flag; it has no knowledge of which of the 9 report types produced its input, the same discipline already established for the generator's rendering/writing steps.
- **The "visual layer must expose existing engine data, never implement its own logic" rule (Phase 9's own hard requirement) was checked structurally, not just asserted:** every new API route (`/graph`, `/graph/node/:type/:id`, `/graph/path`, `/graph/evidence-path/:type/:id`, `/timeline`) is a direct pass-through to a core service function, mirroring the exact discipline ADR-011 established for Mission Control's original routes in Phase 4 and re-verified in Phase 4.5. Path Discovery's 6 "kinds" are one BFS function parameterized by a structural edge filter — not 6 independent implementations that could drift from each other.
- **"Delegate, don't duplicate" pattern, held again:** `evidence-path.ts`'s full-reachability trace reuses the same edge-filter concept as `path-discovery.ts`'s `evidence` kind rather than defining a third, subtly-different notion of "evidence-relevant edges."
- **A third consecutive phase where building a real second consumer of existing data caught a genuine gap** (Phase 6: `getAssetIntelligence()` missing resolvedDate; Phase 7: `require()` vs. vitest; Phase 8: `evidence_gaps` never cleared; Phase 9: Safe Citation Mode's redaction dictionary missing cross-referenced assets) — now four occurrences across four consecutive phases. This project's Architecture Review has called this pattern out as "the single most important process lesson" as of Phase 8's review; Phase 9 is further confirmation, not a new finding.
- Confirmed structurally: no new workspace/brand-specific literal was introduced in any Phase 9 file — every new engine function takes a `WorkspaceDatabase`/`WorkspaceFs` parameter exactly like every function before it.
