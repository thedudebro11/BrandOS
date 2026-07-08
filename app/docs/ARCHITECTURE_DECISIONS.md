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

**Status:** Approved (Phase 1, 2026-07-07) — scope confirmed as generated reports/exports only; originals remain unchanged on disk. Formalized as `app/specs/21_FILENAME_SANITIZATION.md`.

**Context:** Multiple raw evidence filenames in `workspaces/Fatletic/Fatletic Offical Logos/` and `workspaces/Fatletic/Variations of Offical Logo/` contain profanity/slurs (informal internal nicknames from early development). Spec rules forbid renaming originals without approval, but a generated Trademark Readiness Report or Priority of Use Dossier that's meant for an attorney or the USPTO must never surface those raw filenames verbatim in a formal exhibit.

**Decision (proposed):** `ReportTemplate` and `CaseBuilderService.buildExportPackage()` never print a file's original filename directly into report prose or exhibit labels. Instead, every cited file gets a system-generated neutral label (e.g. `Exhibit A-14`, or `Asset #0142 — Logo Revision`) plus its SHA-256 hash and original path recorded in a separate, non-public citation index (`Supporting_Evidence_Index.csv`, per spec `09`) that an attorney can cross-reference privately. The user can optionally supply a friendlier display name per file without touching the original on disk (a `display_name` column on `files`, purely additive, never overwriting `original_path`).

**Consequences:** Requires the citation/labeling scheme to be designed before any report template is built (affects `report-priority-of-use` / `report-trademark-readiness` plugin specs, relocated per ADR-004). Prevents an embarrassing or unprofessional filename from ever appearing in a document meant to be shown to a third party, while still preserving full chain-of-custody traceability internally.

---

## ADR-008: Obsidian vault regeneration preserves manual user edits via content-hash drift detection

**Status:** Approved (Phase 1, 2026-07-07) — answers `QUESTIONS.md` Q4

**Context:** ADR-005 covers whether generated output is tracked in git; it does not address a separate, confirmed-real scenario: the user intends to hand-edit generated Obsidian notes directly in Obsidian. A naive vault generator that always overwrites on regeneration would silently destroy those edits (Risk R11).

**Decision:** Every generated note's content hash is tracked in `obsidian_notes.content_hash`. On regeneration: if the note on disk still matches the last tracked generated hash, it is safely rewritten. If it no longer matches (user has edited it), the generator does not overwrite — it either writes new generated content to a sibling `.generated.md` file for manual merge, or confines all generated content to a delimited block within the note (`<!-- brandos:generated:start/end -->`) and only ever rewrites that block. Formalized as `app/specs/20_OBSIDIAN_INTEGRATION.md`.

**Consequences:**
- Requires the Obsidian Vault Status dashboard widget to surface a diff/merge view whenever drift is detected, so the user can see and accept/reject regenerated content rather than it happening invisibly.
- Slightly more implementation complexity in `VaultGenerator` than a naive overwrite-always approach — accepted as a direct requirement, not optional polish, given the user has confirmed they intend to hand-edit notes.
- The choice between "sibling file" and "delimited block" as the concrete conflict-resolution mechanism is deferred to Phase 7 implementation; both satisfy this ADR.

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
