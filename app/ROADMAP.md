# BrandOS Roadmap

BrandOS started as a single-workspace, Fatletic-only build. It is now a reusable, multi-workspace evidence and brand-archive platform — Fatletic is its first real workspace, not its scope. This roadmap is organized the way a platform's roadmap should be: around **version milestones**, not an ever-growing list of numbered phases. Full detail for any individual phase still lives in `app/docs/CHANGELOG.md` (what shipped), `app/docs/IMPLEMENTATION_PLAN.md` (phase-by-phase plan), `app/docs/ARCHITECTURE_REVIEW.md` (retrospective), and `app/docs/ARCHITECTURE_DECISIONS.md` (why). This file is the one-page orientation.

---

## Version Milestones

| Milestone | Definition | Status |
|---|---|---|
| **BrandOS v1.0** | A complete, local-first evidence management platform — every core engine, Mission Control, Obsidian integration, and professional reporting, hardened and release-ready. | In progress — Phase 10 is the last mile. |
| **BrandOS v2.0** | Platform expansion, built *on top of* a stable v1.0 core: AI, visualization, cloud, collaboration, a public plugin ecosystem. | In progress ahead of v1.0's completion, by explicit user direction — two items (Visual Knowledge Graph, Timeline Explorer) already shipped in Phase 9. Nothing in v2.0 blocks v1.0; v1.0 does not need to anticipate the rest of v2.0's specifics beyond staying extensible (see Platform Evolution, below). |

---

## BrandOS v1.0 — Platform Scope

Everything required for BrandOS to be a complete, self-contained, local-first evidence platform. Once every item below is checked, v1.0 is feature complete.

| Capability | Status | Shipped |
|---|---|---|
| Core Engine (scan/hash/metadata/asset IDs) | ✓ Complete | Phase 2 |
| Multi-workspace architecture (ADR-001) | ✓ Complete | Phase 2 |
| Relationship Engine | ✓ Complete | Phase 2 |
| Knowledge Layer (classification, tags, evidence, query/graph/provenance engines) | ✓ Complete | Phase 3 |
| Case Builder | ✓ Complete | Phase 3 |
| Evidence Engine | ✓ Complete | Phase 3 |
| Timeline Intelligence (multi-candidate resolved dates, ADR-010) | ✓ Complete | Phase 3.5 |
| Validation Engine (Knowledge Validation) | ✓ Complete | Phase 3.5 |
| Mission Control (dashboard) | ✓ Complete | Phase 4 / 4.5 |
| Search | ✓ Complete | Phase 4 |
| Shared Type System | ✓ Complete | Phase 5 |
| Platform Validation (multi-workspace isolation proof) | ✓ Complete | Phase 5 |
| Obsidian Integration | ✓ Complete | Phase 6 |
| Plugin Runtime | ✓ Complete | Phase 7 |
| Shared Import Pipeline | ✓ Complete | Phase 7 |
| Generic Folder Importer | ✓ Complete | Phase 7 |
| ZIP Importer | ✓ Complete | Phase 7 |
| Golden Dataset (permanent regression baseline) | ✓ Complete | Phase 7 |
| Professional Reports (9 types, 4 formats) | ✓ Complete | Phase 8 |
| ADR-007 Safe Citation Mode | ✓ Complete | Phase 9 |
| Security | ○ Not started | Phase 10 |
| Backup Strategy | ○ Not started | Phase 10 |
| Final Verification & Release Readiness | ○ Not started | Phase 10 |

21 of 24 capabilities complete. The remaining 3 are exactly Phase 10's scope — nothing else stands between the current codebase and a declared v1.0.

---

## BrandOS v1 Release Criteria

BrandOS v1.0 can be declared complete only when **all** of the following are true:

- [x] Architecture complete — no undecided fundamental structural questions remain (workspace boundary, plugin contracts, import pipeline, report pipeline all settled and implemented).
- [x] All core engines complete (Core, Relationship, Knowledge, Evidence, Timeline Intelligence, Validation).
- [x] Reports complete (9 types × 4 formats, citation-backed, delegate-don't-duplicate against existing engines).
- [x] Knowledge Layer complete.
- [x] Mission Control complete.
- [x] Plugin Runtime complete (for the one contract type with real implementations — `Importer`).
- [x] Import Framework complete.
- [ ] Security complete.
- [ ] Backup Strategy complete.
- [x] ADR-007 implemented (Safe Citation Mode — no sensitive filename ever echoed verbatim in an external-facing report by default; Phase 9).
- [x] Regression suite passing (178 tests, both packages typecheck and build clean as of Phase 9).
- [x] Golden Dataset passing (both as automated tests and as a standalone CLI gate).
- [x] Multi-workspace verification passing (Fatletic + PrecisionWorkz, isolation checked directly, not assumed).
- [ ] No unresolved *critical* architectural risks — see Deferred Work. With ADR-007 closed, no remaining item carries the same real, not just theoretical, consequence.
- [ ] Documentation complete — this roadmap, `IMPLEMENTATION_CHECKLIST.md` (still written in pre-Phase-1, Fatletic-only language) regeneralized, and every phase's validation report current.

**11 of 14 criteria met. The remaining 3 are all Phase 10's direct responsibility.** This list — not a vibe, not "it feels done" — is what "declare v1.0" will be checked against.

---

## Phase 10 — Platform Hardening & Release Readiness

The final checkpoint before BrandOS v1.0 is declared complete. Renamed from its original working title ("Security, Backups, Polish"), and renumbered from "Phase 9" once Phase 9 became real work (Visual Knowledge Graph & Timeline Explorer, including ADR-007 as a gating special requirement — see below). What remains is smaller than originally framed, since ADR-007 is now closed.

**Status: scoped, not started.** Waiting for explicit approval to begin, per this session's own stop-and-wait protocol.

Scope:
1. **Security** — no known vulnerabilities in the write-guarded filesystem surfaces, request handling, or dependency tree carried into v1.0 unresolved.
2. **Backup Strategy** — encrypted archive copy option, backup reminders per `app/specs/16_SECURITY_AND_BACKUPS.md`'s 3-2-1 strategy.
3. **Verification & Integrity** — a re-hash-on-demand verification job and a Hash Verification widget for Mission Control; a full pass against `IMPLEMENTATION_CHECKLIST.md` (itself regeneralized first, since it still reads as Fatletic-only).
4. **Architecture Validation & Final Quality Review** — a closing pass against every carried-forward item in Deferred Work below to decide, explicitly, what ships in v1.0 vs. what's formally punted to v2.0 — not left ambiguous.

---

## How We Got Here — Completed Phases (0–9)

| Phase | Name | Shipped |
|---|---|---|
| 0 | Architecture & Analysis | 2026-07-07 |
| 1 | Spec Generalization | 2026-07-07 |
| 1b | Foundation Cleanup | 2026-07-07 |
| 2 | Core Engine | 2026-07-07 |
| 3 | Knowledge Layer | 2026-07-07 |
| 3.5 | Evidence Reliability & Knowledge Validation | 2026-07-07 |
| 4 | Mission Control | 2026-07-07 |
| 4.5 | Mission Control Evolution | 2026-07-08 |
| 5 | Platform Consolidation | 2026-07-08 |
| 6 | Knowledge Layer & Obsidian Integration | 2026-07-08 |
| 7 | Import Framework & Plugin Runtime | 2026-07-08 |
| 8 | Professional Reports & Evidence Binders | 2026-07-08 |
| 9 | Visual Knowledge Graph & Timeline Explorer | 2026-07-08 |

Two real workspaces exist: Fatletic (199 real assets, the actual proving ground for every phase) and PrecisionWorkz (an intentionally empty second workspace — the standing proof that nothing is Fatletic-specific). Every phase's own validation report is authoritative for exactly how mature that piece is: `PHASE_3_5_VALIDATION_REPORT.md`, `PHASE_4_5_VALIDATION_REPORT.md`, `PHASE_5_PLATFORM_VALIDATION_REPORT.md`, `PHASE_6_KNOWLEDGE_LAYER_VALIDATION_REPORT.md`, `PLUGIN_VALIDATION_REPORT.md` (Phase 7), `PHASE_8_REPORTS_VALIDATION_REPORT.md`, `PHASE_9_GRAPH_VALIDATION_REPORT.md`.

---

## BrandOS v2.0 — Platform Expansion

Everything beyond v1.0's core-platform scope. None of this blocks v1.0, and v1.0's architecture is deliberately shaped (see Platform Evolution below) so that all of it can arrive later as additions, not redesigns. Two items below are already delivered — shipped ahead of v1.0's own completion, by explicit user direction ("before introducing AI, I want BrandOS users to be able to see and explore the knowledge graph visually"), since version milestones are targets, not strict sequential gates.

- **Visual Knowledge Graph** — ✓ **Complete (Phase 9).** An interactive graph over all 9 real node types (workspace/asset/case/evidence/timeline_event/tag/report/obsidian_note/plugin) with zoom/pan/expand/collapse/filter/search/path-highlighting.
- **Timeline Explorer** — ✓ **Complete (Phase 9).** Chronological, filterable, year-grouped navigation over Timeline Intelligence's resolved dates.
- **Evidence Path Explorer** *(not originally listed here — delivered alongside the above in Phase 9)* — ✓ **Complete.** Full-reachability evidence tracing from any one asset.
- **AI Knowledge Assistant** — summarization/Q&A over the knowledge graph and generated reports. `ReportData` (Phase 8), the knowledge graph (Phase 3, visualized Phase 9), and Path Discovery (Phase 9) are all already reasonable retrieval/traversal surfaces for this once it's built.
- **Semantic Search** — beyond the exact/keyword search shipped in Phase 4.
- **Cloud Synchronization** — BrandOS remains local-first through v1.0 by design (ADR-001's per-workspace-file model), not because sync is hard.
- **Collaboration** — multi-user, real-time or otherwise.
- **Desktop Packaging** — ADR-011 chose a local web app over Tauri/Electron specifically because this environment lacks a Rust/native toolchain; revisit once that constraint no longer applies.
- **Public SDK** — `docs/PLUGIN_SDK.md` (Phase 7) documents the *internal* Importer plugin contract; a public-facing SDK for third-party developers is a further step.
- **Plugin Marketplace** — needs a Public SDK first, and real demand from more than one first-party plugin author.
- **Portfolio Dashboard** — a cross-workspace view (e.g. "show every workspace's trademark readiness at once"). ADR-001 explicitly accepted fan-out-query cost across workspace files as a fine tradeoff at "single digits to low tens of workspaces" scale; a portfolio view is the natural point to revisit that if the workspace count ever grows past it.
- **Advanced Analytics** — beyond the transparent, single-formula scores every v1.0 engine already computes (health scores, evidence assessments, readiness scores).
- **Enterprise Features** — anything assuming multi-tenant, multi-user, or server-hosted deployment, none of which v1.0 targets.

---

## Platform Evolution Philosophy

BrandOS grows by **adding capabilities, not redesigning the core.** This has been true in practice since Phase 5 ("new phases should primarily add capabilities rather than architectural infrastructure") and is now a stated principle, not an incidental pattern. Phase 9 is direct confirmation: a substantial new UI surface (the first since Phase 4) and a first-ever visualization dependency were added with zero changes to the workspace boundary, the plugin contracts, the import pipeline, or the report engine.

Future work should arrive primarily through:
- **Plugins** — new `Importer` implementations (and, once justified by a second real implementation each, `Classifier`/`ReportTemplate`/`VaultTemplate`), never a new `if` branch in `app/src/core/`.
- **Importers** — new data sources join the shared import pipeline (Phase 7) as a `discover()` implementation, not a parallel ingestion path.
- **Report templates** — new report types join the report registry (Phase 8) as one `ReportDefinition` entry, not a change to the generator, renderers, or validation engine.
- **Knowledge templates** — new Obsidian note types extend the vault generator (Phase 6) without touching edit-preservation or incremental-regeneration logic.
- **AI modules** — a future AI assistant consumes `ReportData`/the knowledge graph/Path Discovery as a new reader, not a new writer of facts.
- **Visualization modules** — proven in Phase 9: the Knowledge Graph, Timeline Explorer, and Evidence Path Explorer all read existing engine data as-is; visualization has never required new data-layer work in any phase so far.
- **Cloud modules** — sync/collaboration would be a new layer *above* the existing per-workspace-file model (ADR-001), not a replacement for it.

The core platform — the workspace boundary, the plugin contracts, the shared import pipeline, the report engine, the graph/path-discovery engines — is meant to still look like this after v2.0 ships. If a v2.0 feature turns out to need a core redesign rather than an addition, that itself is a signal to slow down and re-examine the plan, not a normal cost of growth.

---

## Deferred Work

Explicitly named, tracked technical debt — a first-class project artifact, not silently dropped and never silently resolved. Each item states its status, real-world impact, priority, and recommended resolution, so a future phase can act on this list directly rather than rediscovering it.

### 1. Phase 5 code-audit findings (3 of 4 remaining)
- **Status:** Found by a real audit (Phase 5), documented, deliberately not auto-fixed. One of four resolved since (`watchWorkspace()` deleted in Phase 7).
- **Impact:** Low — mechanical cleanup, no functional risk.
- **Priority:** Low.
- **Recommended resolution:** Consolidate `mapAssetRow()`/`mapAsset()`; decide fate of dead function `CaseBuilderService.createCustom()`; remove or populate `app/shared/`, `app/scripts/`, `app/obsidian-temple/` (misspelled, distinct from the real `app/obsidian-template/`).

### 2. Pre-existing Core literal-leakage
- **Status:** Predates Phase 7 (introduced Phase 3), surfaced — not introduced — by Phase 7's consistency review.
- **Impact:** Low-to-moderate — a real, minor violation of ADR-002 ("Core depends on a contract, never a specific plugin"), not a functional bug. `classification-engine/rules.ts` hardcodes `"instagram"`/`"printful"` path checks; `types.ts`/migration `0003` seed brand-adjacent `DateSourceType` literals.
- **Priority:** Low, but worth a dedicated pass rather than a drive-by inside a larger feature phase (per Phase 7's own recommendation).
- **Recommended resolution:** A focused cleanup phase, isolated enough to be fully tested on its own.

### 3. Fatletic's remaining case evidence linking
- **Status:** Only case #1 has real evidence linked (as a live proof of `linkReport()`, Phase 8). The other 4 seeded cases remain empty shells.
- **Impact:** Low from a platform-architecture standpoint (this is data population, not a code gap) — but real from a "is Fatletic's own use case actually done" standpoint.
- **Priority:** Medium — a human/Mission-Control-UI task, unchanged in framing since Phase 4.
- **Recommended resolution:** Manual linking through Mission Control, or report-generation-assisted candidate surfacing (already partially supported by `CaseBuilderService`'s evidence-suggestion methods).

### 4. Import cancellation/resume/rollback
- **Status:** Not built. Both real importers (Generic Folder, ZIP Archive) complete synchronously in seconds against real data.
- **Impact:** None currently — no real workload has needed this.
- **Priority:** Low, correctly deferred rather than built speculatively.
- **Recommended resolution:** Build only once a real import workload is slow/large enough to need mid-run control — likely alongside real Instagram/Printful data volume, not before.

### 5. Report caching / skip-if-unchanged
- **Status:** Not built. Every report-generation call fully recomputes and rewrites, unlike Phase 6's vault notes.
- **Impact:** None currently — reports are explicitly user/CLI-triggered, not scheduled.
- **Priority:** Low.
- **Recommended resolution:** Revisit only if reports become scheduled/automatic.

### 6. Semantic citation-quality checking
- **Status:** Not built. The Phase 8 validation engine confirms citations structurally exist and reference real assets, not that their description text matches their section's claim.
- **Impact:** None known (checked by direct code review of all 9 generators at ship time) — a category of error the validation layer can't catch if introduced later.
- **Priority:** Low, worth building once there's a second report author (human or AI) whose mistakes would motivate it — see v2.0's AI Knowledge Assistant.
- **Recommended resolution:** A future validation-engine enhancement, not urgent for v1.0.

### 7. Real Instagram/Printful extraction
- **Status:** `importer-instagram`/`importer-printful` (Phase 7) are fully registered, activated, and error-isolated; `discover()`'s actual parsing logic is the only missing piece, deliberately, since no real export data exists anywhere in this repository to validate a parser against.
- **Impact:** None currently — both plugins fail loudly and honestly rather than fabricating data (see each plugin's own `BLOCKED.md`).
- **Priority:** Medium, blocked on external data availability, not engineering effort.
- **Recommended resolution:** Build once a real export (or a documented sample) exists. Also unblocks broader relationship detection and the filesystem-mtime accuracy fix, both of which need real commerce/social data to meaningfully exercise.

### 8. Export packages (ZIP bundles)
- **Status:** Not built. Phase 8 shipped 4 output formats per report; bundling several reports/exhibits into one delivery package is a distinct capability.
- **Impact:** None currently.
- **Priority:** Low-to-medium, likely v2.0-adjacent rather than a v1.0 blocker.
- **Recommended resolution:** Build once there's a concrete delivery use case (e.g. a real attorney review package requested).

### 9. Obsidian Vault Status widget
- **Status:** Not built. The data it needs (`obsidian_notes.has_manual_edits`) has existed since Phase 6; deferred from Phase 6, 7, and 8 as dashboard-scope work.
- **Impact:** Low — a user hand-editing a vault note currently has no in-dashboard confirmation BrandOS preserved it, though the underlying preservation mechanism itself is tested and working.
- **Priority:** Low.
- **Recommended resolution:** A small, self-contained Mission Control widget whenever dashboard work is next picked up.

### 10. Real, instrumented performance/load benchmark
- **Status:** Not built. Recommended in six consecutive phase reviews (5, 6, 7, 8, 9, and implicitly 4.5) without being done.
- **Impact:** Unknown by definition — every "sub-100ms"/"well under a second" claim so far is real but anecdotal, observed at Fatletic's actual real-data scale (~200 assets, ~1,000 graph nodes), never tested at the "100+ workspaces / millions of assets" scale named in the platform's original success criteria.
- **Priority:** Medium — this is the item most likely to surprise a future phase if left unaddressed indefinitely.
- **Recommended resolution:** Either schedule it explicitly in Phase 10 or make an explicit, reasoned decision that it's not worth doing yet — stop repeating the same unaddressed recommendation a seventh time.

### 11. Plugin loader support for Classifier/ReportTemplate/VaultTemplate
- **Status:** Interface-only since Phase 1. Only `Importer` has a working runtime (Phase 7).
- **Impact:** None — correctly deferred, since no second real implementation of any of the other three contract types exists yet to validate a loader against.
- **Priority:** Low until a second real implementation of one of these contract types is actually needed.
- **Recommended resolution:** Build loader support for a given contract type only when building the second real plugin of that type — the same rule that correctly governed the `Importer` loader's five-phase deferral before Phase 7.

### 12. No canvas-level viewport virtualization for the Knowledge Graph
- **Status:** Not built. Phase 9 shipped progressive disclosure (hub-only default view, on-demand neighbor expansion) as the real, working mitigation at Fatletic's actual scale (1,061 nodes) — not a placeholder, but not the same guarantee true virtualization would provide at a materially larger scale.
- **Impact:** None currently — Cytoscape's canvas rendering handled every real subset exercised during Phase 9 testing without perceptible delay.
- **Priority:** Low until a workspace's real graph size is known to exceed what progressive disclosure comfortably handles.
- **Recommended resolution:** Revisit only once a real (not hypothetical) workspace demonstrates the need — consistent with this project's "don't build for a scale that doesn't exist yet" discipline.

### 13. No browser-based visual/UI test coverage
- **Status:** Not built, for any Mission Control page since Phase 4 — not new to Phase 9, but Phase 9 is the third UI-heavy phase to ship without closing it.
- **Impact:** Real verification for UI phases has consistently been typecheck + production build + live API/module-transform checks against real data, never a rendered-pixel or interaction check.
- **Priority:** Medium — growing more overdue with each additional UI-heavy phase.
- **Recommended resolution:** Add at least a minimal automated smoke test (e.g. "does each page render without throwing") before a fourth UI-heavy phase ships with zero visual verification coverage.

---

## Explicit Non-Goals

Not on this roadmap at all, at any version — distinct from v2.0 (which is unscheduled but plausible future work):

- No multi-user or server mode — BrandOS remains local-first, single user per workspace owner, through v1.0 and v2.0 alike unless a future decision explicitly revisits this.
- No second workspace (PrecisionWorkz) getting *real* evidence populated — it exists purely as a structural genericity proof, not a second real build-out.
