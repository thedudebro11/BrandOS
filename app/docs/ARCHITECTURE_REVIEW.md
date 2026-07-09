# Architecture Review

Living, cumulative document. A new dated section is appended after every completed phase — existing sections are never rewritten, only added to, so this stays a real history of how the architecture actually evolved rather than a polished retrospective written after the fact. Evaluate every entry against `ARCHITECTURE_PRINCIPLES.md`; that document is the constitution, this one is the record of how well the codebase has lived up to it.

---

## Phase 9 Review — Visual Knowledge Graph & Timeline Explorer (2026-07-08)

### 1. Phase Summary
The project's first substantial frontend build since Mission Control's original Phase 4, and the first phase to add a UI dependency (`cytoscape`). Explicitly sequenced by the user ahead of AI ("before introducing AI, I want BrandOS users to be able to see and explore the knowledge graph visually"), with ADR-007 Safe Citation Mode folded in as a gating special requirement rather than left for the next phase. Every new capability held to the same hard rule: the visual layer exposes existing engine data, never invents its own.

### 2. What Was Accomplished
`buildGraph()` extended from 4 to all 9 node types (workspace, evidence, report, obsidian_note, plugin added); one parameterized Path Discovery engine covering 6 kinds; a full-reachability Evidence Path Explorer; a Node Inspector composing every Section 5 field from existing engines; a filterable Timeline Explorer; ADR-007 fully implemented as Safe Citation Mode; three new Mission Control pages; 22 new tests (178 total). Verified against real Fatletic data throughout — 1,061 real nodes, 1,274 real edges, every new API endpoint exercised live.

### 3. Architectural Decisions Made
ADR-013 (Cytoscape.js for graph rendering) — the only new ADR. ADR-007 transitioned from "approved, not implemented" to "approved and implemented." See `ARCHITECTURE_DECISIONS.md` "Phase 9 Consistency Review" for the full account.

### 4. Technical Debt Introduced
- No canvas-level viewport virtualization for graphs materially larger than Fatletic's real ~1,000-node scale — progressive disclosure (hub-only default, on-demand expansion) is the real, working mitigation today, not a placeholder, but it is not the same thing as true virtualization and shouldn't be represented as such if a workspace's graph grows an order of magnitude.
- Knowledge Graph search filters/highlights only among currently-visible (already-expanded) nodes, not the full unexpanded graph — a real, named UX limitation, not a hidden one.
- No browser-based visual/UI test exists for any of the 3 new pages — consistent with every Mission Control page since Phase 4, not a regression introduced this phase, but also not yet closed.

### 5. Risks Discovered
- **Safe Citation Mode's redaction-completeness risk (§11 of this section) is the most consequential finding of this phase**, on the same order as Phase 8's own review flagging ADR-007 as unimplemented — a scoped-to-citationIndex redaction dictionary looked correct against 8 of 9 report types and silently under-redacted the ninth (Evidence Binder's Chain of Custody section) until checked against real generated output. Fixed within this phase, but the near-miss is worth naming precisely: "every citation is redacted" and "every real filename anywhere in the document is redacted" are different claims, and only real-data verification distinguished them.
- The `obsidian_notes` table on the live Fatletic database was found empty at the start of this phase's real-data testing — not a Phase 9 defect (nothing in Phase 9 touches vault generation), but a real, previously-unnoticed gap in this environment's own data hygiene, resolved by regenerating the vault. Worth a standing note: this project's "verify against real Fatletic data" discipline is only as good as that data actually being current, which this phase's own testing had to first confirm rather than assume.

### 6. Assumptions Validated
- **"The visual layer must expose existing engine data, never implement its own logic" held under real construction pressure, not just as a stated rule** — every one of the 5 new API routes is a direct pass-through, and Path Discovery's 6 "kinds" are genuinely one function with 6 edge filters, not 6 traversal implementations that happened to be built at the same time and could drift apart later.
- Cytoscape's canvas rendering handled real Fatletic-scale data (1,061 nodes) without a dedicated performance-engineering pass — the progressive-disclosure default (§4) is a UX choice for a legible default view, not a workaround for a rendering performance problem, confirmed by the full unexpanded graph never being rendered in a single view during testing but never observed to struggle when larger subsets were expanded.
- The report engine's "single generator-agnostic implementation point" design (Phase 8) paid off exactly as intended: ADR-007 was implemented as one new function called from one call site, and none of the 9 existing report generators needed to change.

### 7. Assumptions Invalidated
- The implicit assumption, carried from Phase 8's own citation-building helpers, that "every real filename a report displays has a corresponding Citation object" was wrong — see §5/§11. Corrected by redesigning Safe Citation Mode's redaction dictionary around the report's actual rendered text rather than its citation list.

### 8. Performance Observations
Not formally benchmarked (the now-six-consecutive-review gap). Anecdotally: fetching and building the full real Fatletic graph (1,061 nodes, 1,274 edges) completes well within interactive timeframes; the default hub-only rendered view (a small fraction of that) renders without perceptible delay; the 178-test suite runs in ~14 seconds. Frontend bundle size grew from ~198KB to ~660KB (208KB gzipped) with the addition of `cytoscape` — a real, measured, one-time cost stated in `PHASE_9_GRAPH_VALIDATION_REPORT.md` rather than left unmeasured.

### 9. Opportunities for Refactoring
- None new of significance. `path-discovery.ts` and `evidence-path.ts` share a similar BFS shape but were kept as two small, separate implementations rather than force-unified under time/cost pressure this phase — a candidate for consolidation later, not urgent.

### 10. Future Recommendations
1. Close the full-graph search limitation (§4) if real usage shows users frequently need to search for a node they haven't yet expanded into view.
2. Revisit true viewport virtualization once a workspace's real graph size is known to exceed what progressive disclosure comfortably handles — not before, per this project's standing "don't build for a scale that doesn't exist yet" discipline.
3. Get a real, instrumented performance baseline — now recommended in six consecutive phase reviews. This project should either schedule it concretely in Phase 10 or make a reasoned decision that it's genuinely not needed yet, rather than naming it a seventh time.
4. Add at least a minimal browser-based smoke test (even a single automated "does the graph page render without throwing" check) before a fourth UI-heavy phase ships with zero visual verification coverage.

### 11. Lessons Learned
- **Four consecutive phases (6, 7, 8, 9) have now each surfaced a genuine latent gap by building a second real consumer of existing data** — this is no longer an interesting coincidence, it is this project's most reliable verification method, more effective than any unit test written in isolation from real data. Phase 8's review named this the most important process lesson so far; Phase 9 is direct, repeated confirmation of the same finding, and future phases should treat "build against real data, then grep/inspect the actual output" as a required step during development, not just as a final check.
- Redaction/safety logic is a category where "looks correct" and "is correct" diverge easily — a citation-count-based validation check (Phase 8's `report-validation.ts`) proved every citation existed, but proving *coverage* of what needed hiding required inspecting real rendered text, not just structural properties of the data model. Worth remembering for any future safety/compliance-adjacent feature: structural validation and content verification are different questions.
- Closing a load-bearing ADR (ADR-007) that had stood open across three consecutive phase reviews, on the same phase that also shipped a large new UI surface, was possible because the special requirement was stated explicitly and first in the phase spec rather than left implicit — worth continuing as a pattern when a phase legitimately needs to bundle "the most important carried-forward debt" with new feature work.

### 12. Questions for Future Phases
- Should Path Discovery's and Evidence Path Explorer's near-duplicate BFS implementations (§9) be unified now, or is the current small duplication cheap enough to leave until a third caller makes the shared shape obvious? Leaning toward: leave until a third real need appears, consistent with this project's standing "don't abstract before a second real case, let alone a third, justifies it" discipline.
- Now that the Knowledge Graph and Timeline Explorer (both originally listed as `ROADMAP.md` v2.0 examples) are done, should the roadmap's v2.0 list be treated as an ordered backlog or a flat set of options the user picks from as priorities shift? This phase's own sequencing decision (graph/timeline before AI) suggests the latter — worth confirming explicitly rather than assuming either way.

### 13. Potential Simplifications
- Path Discovery's 6 edge filters could plausibly collapse `relationship` and `dependency` into one parameterized filter (structural asset↔asset detection) with a `directional: boolean` flag, rather than two separate filter functions with near-identical bodies. Not done this phase — a cheap, low-risk simplification for whoever next touches this file.

### 14. Potential Scalability Concerns
Carried from Phases 6/7/8 (§14 of each): no report generator or graph engine function has a "changed since last computation" skip mechanism — every graph fetch, path search, and report generation fully recomputes from current data. Fine at Fatletic's real scale (sub-second throughout this phase's testing); worth reconsidering only if a workspace's data volume grows by an order of magnitude, per this project's consistent "measure before optimizing" discipline.

### 15. Overall Architecture Health Score: 8.5/10
Held from Phase 8, not raised despite this phase closing ADR-007 (a load-bearing, three-phases-open item) and shipping the project's largest new UI surface since Phase 4 — held because a real safety-relevant gap (§5/§7/§11) was found *during* this same phase's own implementation, which is the right outcome of a good verification discipline but is still evidence the first design attempt at a compliance-adjacent feature was incomplete, not evidence of flawless execution. Held, not lowered, because the gap was caught and closed before shipping (unlike Phase 6's resolvedDate gap, which shipped for a full phase first), and because every claim in this review is independently checked against real generated output, not asserted from design intent.

### 16. Code Quality Assessment
Consistent with the project's established standard. `GraphCanvas.tsx`'s controlled-component design (renders what it's given, decides nothing) mirrors the same "thin presentation, all decisions upstream" discipline Mission Control's pages have followed since Phase 4. `safe-citation.ts`'s single-call-site design is a clean example of this project's "one generator-agnostic implementation point" pattern, now used twice (Phase 8's citation-building helpers, Phase 9's redaction layer) with the same shape.

### 17. Maintainability Assessment
High. A future contributor adding a 10th node type to the graph has an obvious, already-proven pattern (one query block in `buildGraph()`, one case in `getNodeDetail()`'s switch, one entry in the frontend's `NODE_COLORS`/`TYPE_COLORS` maps) to follow. The one real maintainability risk worth naming: the near-duplicate BFS in `path-discovery.ts`/`evidence-path.ts` (§9/§13) is a place a future edit could fix one and forget the other.

### 18. Plugin Architecture Assessment
Unaffected — no plugin-relevant code touched this phase. Plugin nodes/edges were added to the *graph visualization* of existing `plugin_registrations` data, not to the plugin runtime itself.

### 19. Workspace Architecture Assessment
Held and re-verified for a seventh consumer type (after scan, DB rows, API responses, vault files, plugin state, generated reports) — the Knowledge Graph, Path Discovery, Node Inspector, and Timeline Explorer were all built and tested against real Fatletic data with PrecisionWorkz available in the same session as a standing isolation check, consistent with every phase since 5.

### 20. Readiness for the Next Phase
Ready for Phase 10 (Platform Hardening & Release Readiness, renumbered — see `IMPLEMENTATION_PLAN.md`). With ADR-007 now closed, Phase 10's real remaining scope is genuinely smaller than originally framed: Security, Backup Strategy, and final Verification are what stand between the current codebase and a declared BrandOS v1.0 per `ROADMAP.md`'s Release Criteria. No newly-introduced blocker from this phase.

---

## Roadmap Reorganization — Version Milestones Replace Open-Ended Phase Numbering (2026-07-08)

Not a phase — no application code, engine, or UI changed. Recorded here because it's a real, deliberate shift in how this project represents its own maturity, and this document's job is to track exactly that kind of change, not only code.

### What changed
`ROADMAP.md` was rewritten around two version milestones, **BrandOS v1.0** (a complete, local-first evidence platform — everything through Phase 9) and **BrandOS v2.0** (platform expansion: AI, visualization, cloud, collaboration, a public plugin ecosystem), replacing its prior structure of "completed phases 1–8, current phase 9, planned phases 10+." A formal **BrandOS v1 Release Criteria** checklist was added (14 criteria, 7 currently met). Phase 9 was renamed from "Security, Backups, Polish" to **"Platform Hardening & Release Readiness"** to reflect that it is not general cleanup — it is the specific, closed set of items standing between the current codebase and a declared v1.0. A **Platform Evolution** section formalizes, as an explicit stated principle rather than an incidental pattern, that future capability should arrive through plugins/importers/report templates/knowledge templates/AI modules/visualization modules/cloud modules — additions to the core, never redesigns of it. The Deferred Work section was restructured so every item states Status / Impact / Priority / Recommended Resolution, rather than prose of varying shape, and grew from 7 to 12 items (folding in items that were previously scattered across "Planned / Likely Future Work" and various phase reviews' own "carried forward" lists) so there is exactly one place tracking open work, not three.

### Why this is the right structure now, not earlier
An open-ended numbered-phase list (Phase 1, 2, 3, ... N) is the right structure while a project is still discovering its own shape — each phase can be whatever the next most useful increment turns out to be, and "what's Phase 12?" doesn't need an answer until Phase 11 is done. That was true for BrandOS through Phase 8: Phase 6 (Obsidian) was inserted ahead of the originally-planned Phase 6 (Importers) by explicit user direction; Phase 5 was trimmed live during scoping; the "Reports" phase moved from a plugin-based design (in the original pre-Phase-7 `IMPLEMENTATION_PLAN.md` draft) to a plain-registry design by direct instruction once Phase 8 actually started. None of that was a problem — it's what discovering a platform's real shape looks like, and it's honestly recorded across `IMPLEMENTATION_PLAN.md`'s own phase-renumbering notes.

What changed is that BrandOS now has 20 of 24 v1.0-scope capabilities complete (see `ROADMAP.md`'s scope table) and a genuinely closed, nameable remainder (Security, Backup Strategy, ADR-007, final Verification — exactly Phase 9). At that point, "Phase 9, then presumably Phase 10, 11..." stops being an honest representation of the project's state: it implies more open-ended discovery remains when what actually remains is a short, closed checklist. A version-milestone structure says the true thing instead — v1.0 is a bounded, nameable target with a checklist, not the next stop on an indefinite numbered sequence — while v2.0 openly acknowledges that platform expansion is real, wanted, and intentionally *not* similarly bounded yet, since none of it has been scoped in the detail every v1.0 phase received.

### What this does and doesn't change
- Every existing phase number, date, and completion record is unchanged — this reorganizes how the roadmap is *presented*, not the historical record in `CHANGELOG.md`/`IMPLEMENTATION_PLAN.md`, which remain the authoritative phase-by-phase account.
- No architectural decision changed. ADR-001 through ADR-012 all hold exactly as before; nothing about the workspace boundary, plugin contracts, import pipeline, or report engine was touched.
- This does not commit the project to stopping at v1.0, nor to any specific v2.0 scope or order — v2.0's item list is deliberately presented as examples of platform expansion, not a committed roadmap of the same rigor as the v1.0 checklist.

---

## Phase 8 Review — Professional Reports & Evidence Binders (2026-07-08)

### 1. Phase Summary
The largest single-phase build in the project's history by file count (9 report generators, 4 renderers, a registry, a generator engine, a validation engine, 156 total tests) — approved in full after a scoping check, unlike Phases 5 and 7 which were trimmed. Every report is, by construction, a view over engines that already existed; no report-specific scoring formula was invented anywhere in the 9 generators.

### 2. What Was Accomplished
A `reports` table and guarded `WorkspaceFs.writeExport()` surface; a `ReportData`/`Citation`/`ReportSection` model shared by every report type and renderer; a report registry mapping 9 `ReportType`s to `ReportDefinition`s; a generator engine (compose → validate → render × 4 → write → persist) with deterministic, stable-stringify content hashing; a validation engine that mechanically enforces citation coverage and caught a real bug pattern across 6 of the 9 generators during development; 9 real report generators; `CaseBuilderService.linkReport()`, exercised live against a real Fatletic case; a `generate-report` CLI; and a real pre-existing evidence-engine bug (unbounded gap accumulation) found and fixed at the source.

### 3. Architectural Decisions Made
None new — see `ARCHITECTURE_DECISIONS.md` "Phase 8 Consistency Review." One deliberate, user-directed architecture choice recorded there rather than promoted to an ADR: reports are registry entries, not `ReportTemplate` plugins.

### 4. Technical Debt Introduced
- **A real, named gap against an existing ADR:** ADR-007 (sensitive filenames hash-referenced, never echoed verbatim, in generated legal/export documents) is not honored by any of the 9 reports — chain-of-custody and hash-reference sections print real filenames/paths directly. Not discovered after the fact; found and documented during this same phase's own consistency review, before being presented as complete.
- None else net-new. The evidence-gap accumulation bug (§11) was found and fixed within this same phase, so it never became carried debt the way Phase 6's resolvedDate gap did across a full phase boundary.

### 5. Risks Discovered
- **The ADR-007 gap (§4) is the phase's most significant finding.** Fatletic's real evidence tree has filenames ADR-007's own context notes contain profanity/slurs — a report handed to an attorney today with a Hash References or Chain of Custody section could surface one of those filenames verbatim. This is a real, not hypothetical, risk given the actual data in this workspace, and it should block treating any Phase 8 report as attorney-ready until closed.
- The report validation engine's citation-coverage check is structural (does every non-exempt section have ≥1 citation) but not semantic (it cannot detect a citation whose description doesn't actually match its body text) — a report generator could still technically satisfy validation while citing the wrong thing. No evidence this happened (every generator's citations were built from the same data the body text was built from, checked by direct code review), but it's a real category of error this validation layer cannot catch.

### 6. Assumptions Validated
- **"Reports must consume existing engines only" held under real pressure across all 9 report types**, including the two hardest cases: Priority of Use Dossier's "earliest by category" (correctly composed from QueryEngine + resolved-dates rather than reaching for the tempting-but-wrong `firstAssetByCategory()`) and Trademark Readiness's composite score (a plain average of 3 existing assessments, not a new formula).
- **The "single data model, multiple renderers" design worked as intended** — all 4 output formats for all 9 report types were produced by exactly 3 renderer files (~250 lines total) with zero report-type-specific rendering code anywhere.
- Multi-workspace isolation held for a sixth consumer type (§6 of Phase 7's review had it at five) — real reports generated against real PrecisionWorkz data with zero crashes and zero Fatletic-string leakage, checked by direct grep, not assumed.

### 7. Assumptions Invalidated
- The implicit assumption that `evidence_gaps` behaved like `resolved_dates` (delete-then-insert per re-assessment) was wrong — it was pure-append since Phase 3, invisible until a phase called `assessWorkspaceEvidence()` repeatedly enough in one session to make the duplication visible in real output. See §11.

### 8. Performance Observations
Not formally benchmarked (the now-five-consecutive-review gap, first named in Phase 5). Anecdotally: generating all 9 report types against real Fatletic data (199 assets, up to 633 citations in the largest report) completes well within interactive CLI timeframes; the 156-test suite runs in ~12 seconds.

### 9. Opportunities for Refactoring
- Close the ADR-007 gap (§4/§5) — the citation/hash-labeling scheme it specifies would slot cleanly into the existing `Citation` type (an additional `exhibitLabel` field, populated at render time) without touching any report generator's own logic.
- Carried from Phase 7 §9: the pre-existing `classification-engine`/`DateSourceType` literal-leakage finding, and Phase 5's remaining 2 audit findings — both still untouched, both still low-urgency.

### 10. Future Recommendations
1. Close the ADR-007 gap before any Phase 8 report is used for its actual stated purpose (attorney review, trademark filing prep) — this is the one finding from this phase that has real-world consequence if skipped, not just architectural tidiness.
2. Build export packages (ZIP bundles combining multiple reports/exhibits) as a distinct future capability — Phase 8 satisfies "generate one report in 4 formats," not "assemble a delivery package," and the two are legitimately different scopes.
3. Get a real performance baseline once there's a concrete trigger — now recommended in five consecutive phase reviews without being done; this project should stop treating it as perpetually deferrable and either schedule it or explicitly decide it's not worth doing yet, rather than repeating the same unaddressed recommendation a sixth time.
4. Consider a semantic citation-quality check (§5) as a future validation-engine enhancement, once there's a second report author (human or otherwise) whose mistakes would actually motivate it.

### 11. Lessons Learned
- **This is the third phase in a row (6, 7, 8) where building a new real consumer against existing engine data surfaced a genuine latent bug in that data's own maintenance discipline** (Phase 6: `getAssetIntelligence()` missing resolvedDate; Phase 7: `require()` vs. vitest; Phase 8: `evidence_gaps` never cleared). This is no longer a coincidence worth re-discovering each time — it's this project's most reliable bug-finding mechanism, more effective across three consecutive phases than any unit test written in isolation. Treating "build a second real consumer of existing data" as a deliberate verification strategy, not just an incidental side effect of feature work, is the single most important process lesson of the project so far.
- Catching and fixing the evidence-gap bug within the same phase that exposed it (rather than documenting it as carried debt) was possible only because real-data verification happened *during* development, not just at the end — reinforcing, for the fourth time now, that "run it against real Fatletic/PrecisionWorkz data" belongs in the middle of a phase's work, not only as a final check.
- A validation engine that's actually exercised against real generator bugs during its own construction (§9 of the Changelog entry) is worth more than one that only ever sees clean input — this validation engine's citation check would have looked identical on paper whether or not it ever caught anything; it happened to catch something real because it was run early and often, not because it was designed better than a version that wasn't.

### 12. Questions for Future Phases
- Should ADR-007's exhibit-labeling scheme be built as a report-generator-layer concern (each report decides when to show a real filename vs. an exhibit label) or a renderer-layer concern (renderers always substitute labels, generators never see the distinction)? Leaning toward renderer-layer, since it would apply uniformly without every future report generator needing to remember to do it — worth deciding explicitly before implementing, not defaulting to whichever is easier in the moment.
- Now that `reports` and `case_links` connect for real, should Mission Control's Case Workspace page (Phase 4.5) surface linked reports the way it already surfaces linked assets? A natural, cheap dashboard extension once someone picks up dashboard work again.

### 13. Potential Simplifications
- None new. The report engine's file count is large, but each file is small and single-purpose (one report type, or one renderer, or one concern) — this is scope width, not accidental complexity.

### 14. Potential Scalability Concerns
Carried from Phase 6/7 (§14 of both): no report generator has a "changed since last generation" skip mechanism (§9 of the Changelog entry) — every generation call fully recomputes and rewrites. Fine for explicitly-triggered document generation at today's scale (sub-second for Fatletic's real 199 assets); would need reconsidering if reports were ever generated on an automatic schedule rather than on request.

### 15. Overall Architecture Health Score: 8.5/10
Held from Phase 7, not raised despite this being the largest and most thoroughly-tested phase yet, because of §4/§5's real finding: a report system that's architecturally excellent but doesn't yet honor an existing ADR governing exactly the kind of document it produces is a genuine, not cosmetic, gap. Held, not lowered, because the gap was found and documented by this phase's own review discipline rather than surfaced later by someone else, and because everything else this phase claims is backed by real, verified, cited evidence — including the phase's own limitations.

### 16. Code Quality Assessment
Consistent with the project's standard, at a larger scale than any prior phase has tested it against. The "single data model, multiple renderers" split held up cleanly — no renderer ever needed report-type-specific logic, no report generator ever needed to know about output format. The repeated citation-building bug (§11 of the Changelog) was caught by the validation engine precisely because report generators and the validation engine were built as genuinely independent checks on each other, not by the same pass of reasoning.

### 17. Maintainability Assessment
High. A tenth report type requires one registry entry and one generator file, per the design's own stated goal — verified structurally (the generator and renderers never branch on `ReportType`), not just claimed. The `report-helpers.ts` citation-building functions (`citeAsset`/`citeGap`/`citeIntegrityIssue`) are now the obvious place any future report generator should start, closing off the exact bug class §11 found before a tenth report type could reintroduce it.

### 18. Plugin Architecture Assessment
Unaffected by design — this phase deliberately did not route reports through Phase 7's plugin runtime (see `ARCHITECTURE_DECISIONS.md` Phase 8 Consistency Review). `ReportTemplate` remains contract-only, unchanged since Phase 1, still with no second real implementation to validate a loader against.

### 19. Workspace Architecture Assessment
Held and re-verified for a sixth consumer type (§6) — real report generation against both Fatletic and PrecisionWorkz in the same session, with cross-workspace leakage checked directly via grep against generated output, not inferred from architecture alone.

### 20. Readiness for the Next Phase
Ready for Phase 9, with one item that should be treated as a near-term priority rather than a routine carry-forward: the ADR-007 gap (§4/§5/§10.1) has real consequence for this specific workspace's real data and should be closed before Phase 8's reports are presented as legal-review-ready, independent of whatever Phase 9 itself ends up covering.

---

## Phase 7 Review — Import Framework & Plugin Runtime (2026-07-08)

### 1. Phase Summary
The phase that finally implements what ADR-002 described in Phase 1 and five subsequent phases correctly deferred: a real plugin loader, validated against real plugins rather than a guess. Explicitly trimmed by the user before implementation to "build what can be validated, document what cannot" — so this phase shipped a production-quality runtime and two fully real importers, alongside two honestly-incomplete plugins that register and activate correctly but throw a clear error instead of fabricating extraction logic for formats with no real sample data anywhere in this repository.

### 2. What Was Accomplished
A plugin runtime (`core/plugin-runtime/`: manifest schema, loader, compatibility checking, per-workspace activation, one error-isolation choke point every plugin call goes through); a shared import pipeline that `runScan()` itself now runs through (no parallel code path); the Generic Folder Importer (the reference implementation) and a fully working ZIP Archive Importer (real extraction, real zip-provenance citation paths, real idempotency); Instagram/Printful plugins that are real up to the exact boundary of needing data that doesn't exist yet; a permanent Golden Dataset regression baseline runnable both under vitest and standalone; `docs/PLUGIN_SDK.md`; 20 new tests (141 total).

### 3. Architectural Decisions Made
ADR-012 (dynamic `import()` over `require()` for plugin loading, forced by a real vitest module-resolution limitation discovered mid-phase) — see `ARCHITECTURE_DECISIONS.md` "Phase 7 Consistency Review" for the full account, including a correction: a review-time grep found this phase's "no plugin literal in Core" claim didn't hold for two pieces of pre-existing Phase 3 code, flagged honestly rather than smoothed over.

### 4. Technical Debt Introduced
- None new from this phase's own code. One piece of debt closed while already touching the relevant file (`watchWorkspace()`, Phase 5 audit finding #2, deleted after confirming zero call sites).
- One piece of *pre-existing* debt newly surfaced, not introduced: `classification-engine/rules.ts`'s hardcoded `"instagram"`/`"printful"` path checks and `DateSourceType`'s `printful_order`/`instagram_publish` literals (both Phase 3) are a real, if minor, violation of ADR-002's "Core depends on a contract, never a specific plugin" rule. Left as a documented finding, not fixed here — fixing classification/date-source literals was not this phase's scope and doing it as a drive-by would risk under-testing a change to code this phase didn't otherwise touch.

### 5. Risks Discovered
- **The `require()`-under-vitest failure (§3) is a real, non-obvious environment trap** worth remembering explicitly: it doesn't fail at `tsc --noEmit` (types are fine), doesn't fail under `tsx` (works perfectly in the CLI), and only surfaces the moment a test exercises the loader — exactly the kind of gap that "typecheck plus manual CLI testing" alone would have shipped without ever catching. This is the fourth time this project's discipline of testing under every real runtime the code will actually execute under (not just the one most convenient to check) has paid off directly (after ADR-009's better-sqlite3 failure, ADR-011's Tauri failure, and Phase 6's resolvedDate gap).
- **Newly named this phase:** a single-aggregator pattern (`getAssetIntelligence()`, flagged as a systemic risk in Phase 6 §5/§11) has a sibling risk in the plugin runtime — `loadPluginsForWorkspace()` is now the one place every future importer's activation logic flows through. Phase 6's lesson (check the aggregator whenever a new knowledge-layer system ships) generalizes here: check the loader whenever a new plugin *type* gains runtime support, not just when a new plugin instance is added.

### 6. Assumptions Validated
- **ADR-002's core bet — that a plugin loader could be built later without having guessed wrong about the contract shape in Phase 1 — held.** The `ImporterPlugin` interface defined in Phase 1's spec (`parse(sourcePath) -> {events, files, metadata}`) evolved into `discover(ctx, source) -> DiscoverResult` by Phase 7, a natural refinement rather than a rewrite, because the underlying idea (a plugin's only job is producing discoverable files; everything else is core pipeline) was right from the start.
- **"No importer bypasses the pipeline" holds structurally, not just by discipline** — verified by construction: the `ImporterPlugin` contract has no method a plugin could use to write to the database directly, so there is no code path to audit for compliance; there is only one code path.
- Multi-workspace isolation held for a fifth consumer type (after scan, DB rows, API responses, generated vault files, now plugin state) — real, not assumed: Fatletic shows all 4 plugins active, PrecisionWorkz correctly shows Instagram/Printful `disabled` with a specific per-flag reason.

### 7. Assumptions Invalidated
- The implicit assumption that `require()` would work the same way in every JS execution context this project uses (`tsx`, `vitest`, compiled `tsc` output) was wrong — see §5. Corrected via ADR-012 before it could ship as a latent test-environment-only gap.

### 8. Performance Observations
Not formally benchmarked (consistent with every prior phase's honest gap — no dedicated performance/load testing exists anywhere in this project yet, first named in the Phase 5 validation report). Anecdotally: the full 141-test suite runs in ~10 seconds; a real Fatletic scan through the new plugin-runtime-mediated path completes in well under a second more than the pre-Phase-7 code did (imperceptible, not measured precisely).

### 9. Opportunities for Refactoring
- The pre-existing `classification-engine`/`DateSourceType` literals (§4) are the clearest concrete item — not urgent, but now explicitly on the record rather than silently living outside ADR-002's stated rule.
- Phase 5's remaining 2 audit findings (row-mapper duplication, 3 scaffolding directories) — still untouched, still low-urgency, still cheap.

### 10. Future Recommendations
1. Once real Instagram/Printful export data exists, implement the two plugins' `discover()` for real against real fixture data (per each plugin's own `BLOCKED.md`) rather than letting the stub state age indefinitely.
2. Build the Obsidian Vault Status widget in Phase 8 or alongside it — the data (`obsidian_notes.has_manual_edits`) has existed since Phase 6, the plugin-health data this phase added is a close sibling, and both are genuinely dashboard work rather than knowledge-layer or import-framework work.
3. Do the classification-engine/DateSourceType literal cleanup (§4/§9) as a small, focused pass rather than folding it into a larger feature phase where it would be easy to under-test.
4. Get a real, non-anecdotal performance baseline once Phase 8's real importer data (once unblocked) grows the dataset past today's ~200-asset scale — this has now been recommended in four consecutive phase reviews (5, 6, 7, and implicitly 4.5) without being done; worth treating as genuinely due rather than perpetually deferrable.

### 11. Lessons Learned
- Trimming a large spec down to "build what can be validated, document what cannot" produced a phase that is smaller in scope but not smaller in rigor — the runtime, pipeline, and two real importers are held to the same production-quality bar the full spec asked for; only the two data-source-dependent plugins were scoped down, and only because no real data exists to validate them against. This is a reusable template for future large specs: cut scope along "what can be proven," not along "what's less work."
- The `require()`/`import()` discovery (§3/§5/§7) reinforces a pattern now proven four separate times in this project: an environment/tooling assumption that seems safe because it works under one runtime (`tsx`) can fail silently under another (`vitest`) until a real test exercises it. "Typecheck plus one manual CLI run" is not sufficient verification for anything that touches module loading, process boundaries, or file I/O — this project's habit of also running the full test suite and a live CLI/API check after every meaningful change continues to be load-bearing, not ceremonial.
- Writing this review's §6/§10 claim ("no plugin literal in Core") and then actually grepping to check it — rather than asserting it from memory of what was written this phase — caught a real, if minor, factual error before it entered the permanent record. Worth continuing as standing practice: verify a documentation claim the same way a code claim would be verified, especially claims about the *absence* of something, which are exactly the kind an author's own memory is worst at policing.

### 12. Questions for Future Phases
- Should there be an automated lint/grep check (perhaps a `tests/core/architecture-boundaries.test.ts`) that fails CI if `app/src/core/` ever gains a new brand-specific string literal, rather than relying on a manual grep during each phase's own review? Given this phase found a real, previously-unnoticed violation via manual grep, an automated version seems genuinely warranted now — a candidate for Phase 8 rather than purely aspirational.
- Now that `plugin_health`/`plugin_health_events` exist, should Mission Control's existing Action Center (Phase 4.5) surface an unhealthy plugin as an action item, the same way it already surfaces review-queue and duplicate-group counts? Natural fit once the Vault Status widget work happens.

### 13. Potential Simplifications
- None new. The plugin contract and pipeline stage functions are already close to the minimum shape the "no importer bypasses the pipeline" guarantee requires.

### 14. Potential Scalability Concerns
Carried from Phase 6 §14 (vault generator iterates all entities per run) — the import pipeline has the same shape (iterates every discovered file per run, incremental-skip per file rather than a true delta-only discovery). Fine at today's scale; the same "get a real number once Phase 8's data grows the dataset" plan applies here too, not a new concern this phase introduced.

### 15. Overall Architecture Health Score: 8.5/10
Held from Phase 6. Held, not raised, despite this phase closing a five-phase-old deferred item (the plugin loader) cleanly and with real tests, because of two factors that keep this from being an unambiguous step up: the pre-existing Core literal-leakage finding (§4) is a real, if small, principle violation that had been sitting unnoticed since Phase 3, and the performance-baseline gap is now overdue across four consecutive reviews rather than merely noted. Held, not lowered, because both are honestly documented findings rather than hidden ones, and the phase's actual deliverables (runtime, pipeline, two real importers) are solid, tested, and verified against real data.

### 16. Code Quality Assessment
Consistent with the project's standard. The pipeline extraction from `import-engine.ts` was verified as a true mechanical reorganization, not a rewrite-in-disguise, by rerunning the full pre-existing test suite unchanged immediately after and confirming all 121 prior tests still passed before any new test was added. The `ImporterPlugin` contract is deliberately minimal — one required method — which is what makes "no importer bypasses the pipeline" a structural guarantee rather than an aspiration.

### 17. Maintainability Assessment
High for the new subsystem: a future importer author has the Generic Folder Importer (simplest) and ZIP Archive Importer (extraction + cleanup + provenance) as two worked examples spanning the real complexity range a third importer is likely to need. The one maintainability risk worth naming: `loadPluginsForWorkspace()` is now a second single-aggregation point (alongside `getAssetIntelligence()`) whose staleness would silently propagate to every plugin — see §5.

### 18. Plugin Architecture Assessment
**The most significant change of any review section since Phase 1.** Six phases (2 through 7) of correctly, patiently waiting for a second real plugin before building the loader ended this phase with four real manifests exercising the exact mechanism ADR-002 described — two proving the happy path (Generic Folder, ZIP Archive), two proving the honest-failure path (Instagram, Printful). This is meaningfully different from "the loader exists and passes tests with a toy plugin": it was validated against the actual planned first-party plugin set from `app/specs/19_PLUGIN_ARCHITECTURE.md`, including the two hardest cases (real external data formats that don't exist yet to build against).

### 19. Workspace Architecture Assessment
Held and re-verified for a fifth consumer type (§6) — plugin activation state joins scan results, DB rows, API responses, and generated vault files as a workspace-scoped fact proven, not assumed, to respect the workspace boundary.

### 20. Readiness for the Next Phase
Ready for Phase 8 (Case Builder Reports & Report Templates). No newly-introduced blocker. Two carried-forward items are now genuinely due rather than merely noted: a real performance baseline (four consecutive reviews) and the pre-existing Core literal-leakage finding (§4, new this phase but should not be allowed to age the way the performance gap has). Neither blocks starting Phase 8.

---

## Phase 6 Review — Knowledge Layer & Obsidian Integration (2026-07-08)

### 1. Phase Summary
The first phase whose deliverable is entirely a *view* over data every prior phase already built — no new facts, scores, or relationships were introduced; the vault generator only formats what the Knowledge Layer (Phase 3), Evidence Reliability system (Phase 3.5), and Asset Intelligence aggregator (Phase 3) already know. That framing was also this phase's biggest test: building a second real consumer of `getAssetIntelligence()` immediately exposed that the aggregator itself had a real gap.

### 2. What Was Accomplished
`obsidian_notes` tracking table; a guarded `WorkspaceFs.writeVaultFile()`/`readVaultFile()` write surface mirroring the existing `writeGenerated()` guard; delimited-block edit preservation resolving ADR-008's open question; a vault generator producing Asset/Case/Workspace notes plus 8 index pages (index-pages-not-duplicate-entities, so "Logo Evolution" and "Products" are filtered link lists, never a second copy of an Asset note); incremental regeneration via content-hash skip, proven at real scale; a Living Knowledge Review engine delegating reference-integrity checks to the existing `validateKnowledge()` engine; a CLI entry point; 10 new tests (121 total); real generation against both Fatletic (213 notes) and PrecisionWorkz (9 notes, isolated) — and, as a direct consequence of that real generation, discovery and fix of the `resolvedDate` gap in `getAssetIntelligence()` (see §4/§11).

### 3. Architectural Decisions Made
ADR-008 resolved (delimited-block over sibling-file) — see `ARCHITECTURE_DECISIONS.md` "Phase 6 Consistency Review." No other new ADRs; this phase built within ADR-001/002/005/009's existing boundaries.

### 4. Technical Debt Introduced
- None net-new by this phase's own code, but this phase found and closed a piece of *latent* debt that had existed silently since Phase 4.5: `getAssetIntelligence()` never surfaced `resolved_dates` (Phase 3.5's actual output), so both the new vault and the already-shipped Mission Control Asset Detail page had been showing raw, unfiltered — in Fatletic's case, epoch — timestamps as if they were fact. Fixed at the aggregator level, propagating correctly to both consumers with no template- or component-local patch. Zero new debt remains from this finding; it is fully closed, not deferred.
- The Obsidian Vault Status dashboard widget (diff/merge surfacing for `has_manual_edits`) was explicitly scoped out of this phase (Phase 6 was knowledge-layer work, not Mission Control UI) and is now a named Phase 7 item rather than a silent gap — the data it would need (`obsidian_notes.has_manual_edits`) already exists.
- Section 10's 100,000-note performance target was reasoned about architecturally (the hash-skip mechanism is the right shape) but not empirically load-tested — stated as an open item, not implied to be proven, per this phase's own "never invent facts" mandate applying equally to its own claims about itself.

### 5. Risks Discovered
- **The aggregator-gap pattern is the real finding of this phase, not just an incidental bug.** `getAssetIntelligence()` is explicitly the single composition point every consumer is supposed to call rather than re-querying (established Phase 3) — which is exactly why one field being stale silently propagated to two independent surfaces (dashboard, vault) built in two different phases by what were, functionally, two different pieces of work. The architecture's own strength (one aggregator, many consumers) is also its single point of failure for staleness: when the aggregator falls behind a newer engine capability, everything downstream inherits the gap invisibly. No test caught it because no test asserted on resolved-date *content*, only on resolved-date *existence* in isolation from the aggregator.
- Confirms a pattern first named in Phase 5 §5 (foundation-built-without-a-caller having a real cost) in a new form: here the cost wasn't dead code, it was a *live* aggregator quietly falling out of sync with a sibling system (Phase 3.5) added after it. Worth a standing check: whenever a new knowledge-layer table/system ships, grep whether `getAssetIntelligence()` needs an update, rather than assuming its shape is permanently complete.

### 6. Assumptions Validated
- The "index pages, not duplicate entities" design held cleanly in practice — all 8 index pages generated correctly as filtered wikilink lists against real data (e.g. Logo Evolution via `query.assetsByTag("Logo")`), with zero duplicate Asset notes created.
- Multi-workspace isolation held for a third consumer type (after DB rows in Phase 5, API responses in Phase 5): PrecisionWorkz's generated vault contains only its own workspace shell and empty indexes, never a Fatletic entity.
- The delimited-block mechanism worked exactly as designed against a real hand-edit, not just a test fixture — verified live on `Assets/AST-00000114.md`: content below the marker survived regeneration untouched; a simulated edit inside the generated block was correctly detected and refused.

### 7. Assumptions Invalidated
- The implicit assumption that `getAssetIntelligence()` was a stable, complete contract once Phase 3 shipped it was wrong — it was complete *as of Phase 3*, and nothing re-checked it against Phase 3.5's later addition until this phase's real vault content made the gap visually obvious. Recorded here rather than only in §4/§5 because it's a genuine invalidated assumption, not just a bug.

### 8. Performance Observations
Not formally benchmarked at scale (§4). Anecdotally: full generation of Fatletic's 213 notes plus the Living Knowledge Review completes well within interactive CLI timeframes on real hardware; the 121-test suite (10 new tests this phase) continues to run in single-digit seconds. No regressions observed in existing engine query performance, since this phase added zero new query patterns — every vault note is built from calls to functions that already existed.

### 9. Opportunities for Refactoring
- Nothing new introduced by this phase's own code that needs refactoring; `note-templates.ts` was deliberately kept free of DB access specifically to avoid creating a refactor debt later.
- Carried from Phase 5 §9: the 3 audit findings (row-mapper duplication, 2 dead functions, dead scaffolding directories) remain unresolved — this phase did not touch them, consistent with Phase 5's "Phase 6/7" recommendation now needing to point at Phase 7 instead, since this Phase 6 was inserted ahead of the originally-planned importer/plugin-loader phase.

### 10. Future Recommendations
1. Build the Obsidian Vault Status widget in Phase 7 (Mission Control now has a real data source for it: `obsidian_notes.has_manual_edits`) rather than letting the deferral compound the way the plugin loader's did.
2. When Phase 7 adds real importer data (Instagram/Printful), re-run the vault generator against the larger, richer dataset it produces — this is a natural, real (not synthetic) opportunity to get an actual empirical read on generation performance at higher note/relationship counts, closing §4's open item without fabricating test data.
3. Adopt a standing practice suggested by §5/§7: whenever a new knowledge-layer table or resolution system ships, explicitly check whether `getAssetIntelligence()` (or any other single-aggregator pattern) needs a corresponding update, rather than relying on a downstream consumer to eventually notice.

### 11. Lessons Learned
- Building a second real consumer against an existing aggregator is a legitimate, high-value way to pressure-test a "single source of truth" pattern — it did here what no amount of re-reading the Phase 3 code would have caught, because the bug was an *omission* (a field that was never added), not a visible error in code that existed.
- This is the third time in the project's history (after Phase 3.5's epoch-date discovery, Phase 4.5's stringId/SQL-join bugs) that real end-to-end verification against live data caught something unit tests and typechecking both missed. The pattern is now well-established enough to treat as a required step after every phase, not a nice-to-have.
- Fixing a cross-cutting bug at its actual source (the aggregator) rather than patching each downstream symptom (vault template, dashboard component) took the same amount of code and left zero duplicate fix logic — worth continuing as the default response whenever a bug is traced to a shared composition point.

### 12. Questions for Future Phases
- Should there be an automated check (a test, or a build-time assertion) that every field on `AssetIntelligenceView`/`AssetIntelligence` is actually rendered somewhere by at least one consumer, to catch the *next* aggregator-gap earlier than "someone happens to look at real generated output"? Worth considering once there's a third consumer to design the check against.
- Now that a second Obsidian-adjacent capability (vault generation) has shipped without needing the plugin loader, is `vault-templates-brand-archive` (the plugin originally planned for this in the old Phase 8 placeholder) still needed as a plugin, or does the core generator's brand-agnostic template set already cover what a future non-Fatletic workspace would need? Leaning toward: revisit only if/when a second workspace's vault needs meaningfully different note structure, not preemptively.

### 13. Potential Simplifications
- None new. The generator's template functions are already about as simple as the "format, don't compute" constraint allows.

### 14. Potential Scalability Concerns
Carried from Phase 5 §14, now with one addition: the vault generator currently regenerates by iterating all active assets/cases on every run rather than only entities changed since the last generation — the content-hash skip makes each individual note-write cheap, but the iteration itself is still O(all entities) per run. Fine at Fatletic's 199-asset scale; worth revisiting if a workspace's asset count grows by orders of magnitude, per §10.2's plan to get a real empirical read once Phase 7's importers land.

### 15. Overall Architecture Health Score: 8.5/10
Held from Phase 5, not raised and not lowered. Held, not raised, because this phase's main event was finding and fixing a real gap in existing architecture rather than adding new proven strength — a genuinely good outcome, but a maintenance correction, not a net-new capability demonstration. Held, not lowered, because the fix was immediate, at the source, fully propagated, and verified — exactly what should happen when the architecture's own consistency checks (real-data verification) work as intended.

### 16. Code Quality Assessment
Consistent with the project's established standard: the generator's core primitive (`writeNote()`) is a single well-scoped function handling incremental-skip and edit-preservation together, not two overlapping code paths; templates are pure functions with no hidden state. The `resolvedDate` fix itself is minimal and precise — one field added to one interface, one query call added to one function, no surrounding code disturbed.

### 17. Maintainability Assessment
High. A future contributor adding a new note type (e.g. a Timeline-event note, if ever needed) has a clear, already-proven pattern to follow: a pure template function plus one `generateXNote()` orchestrator calling `writeNote()`. The aggregator-gap risk named in §5 is the one maintainability concern worth carrying forward as a standing practice, not a code-quality issue in what was actually written.

### 18. Plugin Architecture Assessment
Unchanged — still no plugin loader, still five phases running (2, 3, 4, 5, 6) of deferral, still correctly waiting for a second real plugin rather than being built speculatively. This phase deliberately did not force vault generation through the plugin system (no `VaultTemplate` plugin was built) since doing so before Phase 7's real importer plugins exist would mean designing the loader against a single example again — the same anti-pattern the loader has correctly avoided since Phase 2.
- **`app/obsidian-temple/` is not the same directory as the git-tracked `app/obsidian-template/` this phase would use for a reusable template set** — that dead scaffolding directory (Phase 5 audit finding, misspelled) remains untouched and is now a candidate for deletion in Phase 7 given real vault generation exists and never used it.

### 19. Workspace Architecture Assessment
Held and re-verified for a fourth consumer type (after scan, DB rows, API responses, now generated files): every vault-generator function takes an explicit workspace context (`WorkspaceFs`, `WorkspaceDatabase`) with no shared state, and PrecisionWorkz's real, separate 9-note vault is direct proof, not just design intent.

### 20. Readiness for the Next Phase
Ready for Phase 7 (Importers, Fuller Relationships & Plugin Loader — reordered ahead of Reports per the original plan, since Phase 6 was inserted out of the originally-planned sequence at the user's explicit direction). One clear carry-forward: build the Vault Status widget alongside Phase 7's other Mission Control-adjacent work rather than letting it become a second multi-phase deferral like the plugin loader. The `getAssetIntelligence()` aggregator-gap pattern (§5/§11) is the single most important lesson to carry forward, more so than any specific code artifact from this phase.

---

## Phase 5 Review — Platform Consolidation (2026-07-08)

### 1. Phase Summary
An engineering-quality phase by design, deliberately trimmed by the user to four objectives: shared types, multi-workspace verification, an honest code audit, and a validation report. No features shipped. The point was to stop and check the platform's own health before Obsidian/AI/Reports/Exports, and that's exactly what happened.

### 2. What Was Accomplished
`app/shared-types/` closing a twice-documented, once-incident-confirmed risk; 5 new automated isolation tests plus the first-ever real API-layer exercise of PrecisionWorkz; a genuine audit yielding 3 concrete, prioritized findings (duplicated row-mapper, 2 dead functions, 4 dead scaffolding directories) plus 4 confirmed-clean checks (no unused deps, no circular deps, no brand leakage, all CLI scripts wired).

### 3. Architectural Decisions Made
None new — see `ARCHITECTURE_DECISIONS.md` "Phase 5 Consistency Review." This phase closed debt against existing decisions (ADR-001, the type-duplication risk) rather than making new ones.

### 4. Technical Debt Introduced
None. This is the first phase in the project's history with a net-negative technical debt delta — debt was closed (type duplication) and documented (the audit findings) but nothing new was added, consistent with the phase's explicit purpose.

### 5. Risks Discovered
- The audit's dead-code findings (`createCustom()`, `watchWorkspace()`) reveal a pattern worth naming: Phase 2/3's "build the foundation piece even without an immediate caller" approach (deliberate, and defensible at the time — see Phase 3's own review calling this out as a positive pattern for the event bus) has a real cost when the caller never materializes. Not a contradiction of that earlier judgment, but a reminder that "foundation for later" needs a follow-up check, which this audit was the first one to actually perform.
- The 4 empty scaffolding directories (`app/src/plugins/`, `app/shared/`, `app/scripts/`, `app/obsidian-temple/`) sitting untouched since Phase 0/1b are a small but real onboarding-confusion risk for anyone (including a future session) exploring the repo cold — they imply structure that doesn't exist yet.

### 6. Assumptions Validated
- **The core "no cross-workspace leakage" claim, made repeatedly since ADR-001 in Phase 2, is now proven, not assumed.** Five different subsystems (assets, cases, search, duplicate detection, review queue) were each independently tested for leakage and all passed, including the specifically adversarial case (byte-identical duplicate content seeded in both workspaces) most likely to expose a real bug if isolation were broken.
- The type-only shared-types mechanism works exactly as hoped: zero runtime cost (confirmed by identical build output size before/after), full compile-time enforcement on both sides, no new tooling investment required.

### 7. Assumptions Invalidated
- None this phase — everything tested confirmed what was expected, which is itself worth recording: not every phase surfaces a surprise, and that's a legitimate, positive outcome for a verification-focused phase.

### 8. Performance Observations
Not formally measured this phase (Section 6 of the original Phase 5 request was explicitly cut in the user's trimmed scope). Incidentally observed and worth recording: the isolation test suite (5 tests, 2 full scans + assorted queries each) completes in 336ms; the full 111-test suite completes in under 7 seconds; API responses against real Fatletic data remain sub-100ms as in every prior phase. No red flags, but this is anecdotal, not a measured baseline — a real performance review remains future work.

### 9. Opportunities for Refactoring
The 3 documented audit findings ARE the refactoring backlog for this area: consolidate `mapAssetRow`/`mapAsset` into one function (small, mechanical, low-risk), decide whether to remove or actually wire up `createCustom()` and `watchWorkspace()`, decide whether to populate or remove the 4 empty scaffolding directories. Deliberately not done this phase per explicit instruction ("do not fix everything automatically").

### 10. Future Recommendations
1. Resolve the 3 audit findings in Phase 6 (importers/plugin loader) rather than letting them age further — none are urgent, all are cheap now and will only get marginally more annoying to find again later.
2. Actually build the plugin loader in Phase 6 and, at that point, decide `app/src/plugins/`'s fate for real — it's the one empty scaffolding directory with a genuine near-term purpose, unlike the other three.
3. A real performance review (Section 6 of the original ask) is worth doing once Phase 6/7 add real data-volume growth (multiple importers, real commerce/social data) — premature at Fatletic's current 199-asset scale but worth planning for.

### 11. Lessons Learned
- A dedicated "stop and audit" phase, done for real rather than skipped in favor of more features, surfaced exactly the kind of small-but-real findings (dead code, duplicated logic) that accumulate silently across fast-moving feature phases and are cheap to catch early, expensive to discover later. Worth treating as a recurring practice, not a one-time event.
- Verification against real, live, concurrent multi-workspace usage (not just isolated fixtures) caught nothing broken here, but that's meaningfully different from "isolation was never actually tested against the real API" — the confidence gained is real, not assumed.

### 12. Questions for Future Phases
- Should "empty scaffolding directory audits" become a standing item in every future Living Architecture Review, or was this a one-time cleanup? Leaning toward: check whenever a new directory has existed unpopulated for 2+ phases, not every phase.
- Now that shared-types exists for API DTOs, should it also absorb the CLI's output shapes (currently ad hoc console.log formatting) if a future phase adds a JSON output mode to any CLI command? Not needed yet, worth remembering as the natural extension point.

### 13. Potential Simplifications
- `mapAssetRow`/`mapAsset` consolidation (§9) is the clearest, lowest-risk simplification on the table — same logic, same shape, purely a location decision.

### 14. Potential Scalability Concerns
Unchanged from Phase 4.5. Explicitly not addressed this phase (speculative optimization was out of scope by instruction) — still worth revisiting once real data volume grows.

### 15. Overall Architecture Health Score: 8.5/10
Up from 8/10. First phase to close more debt than it introduced, with a real (not just claimed) fix for the project's most-repeated documented risk, and a genuine, honest audit rather than a self-congratulatory one — the 3 findings are real code issues, not manufactured busywork to look thorough. Held below 9 because the findings, while documented, remain unfixed, and because a real performance review still hasn't happened at any point in the project.

### 16. Code Quality Assessment
The shared-types file is exactly as boring as it should be — plain interfaces, well-commented on scope and rationale, no cleverness. The audit itself models the kind of honest self-assessment the Living Architecture Review has aimed for since Phase 3: specific, falsifiable claims (exact function names, exact directory paths, exact grep results) rather than vague quality statements.

### 17. Maintainability Assessment
Improved, concretely: the type-duplication fix removes the single most error-prone maintenance surface identified across the last two phases. The 3 audit findings are all small, well-understood, low-risk cleanup items for whoever picks them up next — none require rediscovery work.

### 18. Plugin Architecture Assessment
Honestly assessed rather than glossed over, per the pre-phase discussion: there is still no plugin loader and no runtime plugins to audit, four phases running (2, 3, 4, 5) of the loader being deferred. The plugin *contracts* (Importer/Classifier/ReportTemplate/VaultTemplate, `app/specs/19_PLUGIN_ARCHITECTURE.md`) remain well-specified and unchanged; what's missing is purely the loading mechanism, and it continues to correctly wait for a second real plugin to validate against rather than being built speculatively.

### 19. Workspace Architecture Assessment
The strongest section this phase — genuinely re-verified rather than re-asserted for the first time since Phase 3.5 first raised it as an open item. Multi-workspace isolation is no longer a design intention backed by code review; it's a design intention backed by 5 passing automated tests plus a live real-server cross-workspace request sequence. This item is now closed, not carried forward again.

### 20. Readiness for the Next Phase
Ready for Phase 6. Unlike the last three reviews, there is no "this keeps getting deferred" item to flag as overdue — the type-duplication risk and the PrecisionWorkz verification, both carried across multiple phases, are both closed. The 3 audit findings are real but low-urgency and explicitly deferred by design, not by oversight.

---

## Phase 4.5 Review — Mission Control Evolution (2026-07-08)

### 1. Phase Summary
Evolved Mission Control from a functional-but-thin dashboard into a real operational interface — visual hierarchy, a living activity feed, an action-oriented "what needs attention" surface, drill-downs that don't dead-end at a number, and an Asset Detail page that closes the single clearest gap Phase 4's own review identified. The hard "no business logic in the frontend" rule was re-verified under real new pressure (5 new routes, 3 new engine functions), not just re-stated.

### 2. What Was Accomplished
3 new engine-layer functions (activity feed, flexible asset filtering, case evidence suggestions); 5 new/rewritten API routes; Overview redesigned with a real 3-tier visual hierarchy; a working Action Center wired to real gap/review/duplicate data; 4 new pages (Asset Detail, Needs Review, Duplicates, Evidence Explorer); Case Workspace enriched with honest empty states (suggestions framed as browse candidates, not claims) and honest placeholders (Notes, Exports) instead of fabricated features; grouped Cmd+K search with corrected asset navigation.

### 3. Architectural Decisions Made
None new — see `ARCHITECTURE_DECISIONS.md` "Phase 4.5 Consistency Review." This phase was a test of ADR-011 under load, not a reason to revise it.

### 4. Technical Debt Introduced
- The frontend/backend type-duplication gap (Phase 4 §4/§9) is no longer hypothetical — it caused a real build failure this phase (`SearchResult.stringId` added to the backend type, forgotten on the frontend, caught only by the frontend's own `tsc --noEmit`). Fixed, but the underlying gap is unchanged and now has one concrete incident against it.
- `Overview.tsx` now makes 3 separate API calls on mount (overview, action-center, activity) instead of 1 — acceptable at today's response times (all under 100ms against real data) but a candidate for a single composite endpoint if the page grows more sections.
- The Action Center's `href` values are hand-built relative path strings (`"review-queue"`, `"assets?filter=missing-metadata"`) constructed in the API layer — functional, but a small implicit contract between the API and the frontend's route table that isn't type-checked across the package boundary (same root cause as the type-duplication issue above, different symptom).

### 5. Risks Discovered
- The background-process lifecycle issue encountered repeatedly during this phase's live testing (a killed server process not always actually terminating, a new process sometimes failing to rebind while an old one kept serving stale code) is a real characteristic of this sandboxed environment worth remembering for future phases' verification steps — always re-check with a fresh `curl` after any fix that a running dev server needs to pick up, don't assume a restart succeeded.
- `listAssetsFiltered()`'s original join logic (Technical Debt candidate, now fixed) is exactly the kind of bug that's easy to reintroduce if another filter combination is added later without re-checking which SQL aliases need which joins — worth a comment trail, which the fixed version now has, but worth remembering as a pattern to watch when this function grows.

### 6. Assumptions Validated
- The engine work from Phases 2–4 really was sufficient for this UI expansion too: of 3 "new" capabilities needed, none required touching the ingestion pipeline or the knowledge-layer schema — everything was composable from data already being collected. Strong continued evidence the phase sequencing (engine before UI, UI before AI/reports) was correct.
- Real end-to-end testing against real data (not just typecheck+build) continues to catch real bugs Phase 3/3.5/4's equivalent checks would have missed — both bugs this phase (stringId, SQL join) were only visible via actual HTTP responses, not via `tsc` or `vitest` alone, since neither is unit-tested at the frontend layer yet (§4 of Phase 4's review, still open).

### 7. Assumptions Invalidated
- None new this phase.

### 8. Performance Observations
No regressions. All new endpoints tested against real Fatletic data (Action Center, Activity Feed, Review Queue with 53 real entries, Duplicates with 11 real groups, filtered Assets) returned in well under 100ms. Frontend production build: 47 modules (up from 43), ~61KB gzipped JS (up from ~58KB) — negligible growth for 4 new pages.

### 9. Opportunities for Refactoring
- Same top recommendation as Phase 4 §9, now with a real incident behind it: extract shared request/response types (or generate them) so `app/web/src/api.ts` can't drift from `app/src/api/routes.ts` silently.
- Consolidate Overview's 3 API calls (§4) into one composite `/overview` response once the page's data needs stabilize, to reduce round-trips without changing what's displayed.

### 10. Future Recommendations
1. Resolve the type-sharing gap before Phase 5 adds more API surface — this is now the single most concretely-justified piece of technical debt in the project (two real incidents: Phase 4.5's build failure, this phase's near-miss).
2. Add at least minimal frontend tests (component smoke tests, or integration tests against a running API) before the page count grows further — currently the *only* thing catching frontend bugs is manual `curl` verification plus TypeScript's structural checking, which caught both bugs this phase but only after the code was written, not before.
3. Consider whether Action Center `href`s should become typed route constants shared between the API and the router, closing the implicit-contract gap noted in §4.

### 11. Lessons Learned
- A phase that's "just" UI evolution over an already-built engine is not risk-free — both real bugs this phase were integration bugs at the frontend/backend seam, not logic bugs in the engine (which remains extensively tested and has had zero real bugs found in it since Phase 3.5). The seam is where the risk concentrates now.
- Framing empty states as invitations rather than dead ends (case evidence suggestions, honest Notes/Exports placeholders) was cheap to build once the underlying data access existed, and materially changes how "done" the product feels — worth continuing as a default pattern, not a one-off polish item.

### 12. Questions for Future Phases
- Same as Phase 4 §12 (type-sharing mechanism, real-time update needs) — neither has been resolved yet, both are more pressing now than they were.
- Should the Action Center's item list itself become data-driven/configurable (a table of "attention rules") rather than a fixed list assembled in the route handler? Not urgent at today's list size (8 items), worth watching if it grows.

### 13. Potential Simplifications
- None new beyond Phase 4 §13, still applicable if a shared-types package gets added.

### 14. Potential Scalability Concerns
Unchanged from Phase 4 at the data layer. The Evidence Explorer's facet-count queries (`GROUP BY category`, `GROUP BY tag`) run on every request rather than being cached — fine at Fatletic's 199-asset scale (sub-10ms), a real consideration if a workspace's asset count grows by orders of magnitude and this page is opened frequently.

### 15. Overall Architecture Health Score: 8/10
Held from Phase 4. The core architectural rule (no logic in the dashboard) survived a real stress test this phase and is more clearly true now than when first claimed, which is a genuine positive. Held at 8, not raised, because the type-duplication debt graduated from a documented risk to a documented *incident* without being fixed — a repeated pattern (flag it, don't fix it) that should not continue indefinitely without cost.

### 16. Code Quality Assessment
Consistent. New pages follow the same structure as Phase 4's (fetch-on-mount, thin render, no local computation beyond display formatting like relative-time strings). The one new piece of non-trivial frontend logic (`formatRelative()` in `widgets.tsx`) is presentation-only (turns an ISO timestamp into "3h ago"), not business logic, and is a reasonable line to draw.

### 17. Maintainability Assessment
High, with the caveat repeated in §4/§9/§10. Each new page and route is easy to locate and understand in isolation; the risk is exclusively at the cross-package boundary, not within either package.

### 18. Plugin Architecture Assessment
Unaffected, correctly. No plugin-relevant code touched this phase.

### 19. Workspace Architecture Assessment
Held — every new route and engine function takes a workspace/db parameter explicitly; nothing assumes a single workspace. Not re-tested against PrecisionWorkz specifically this phase either (same open item as Phase 3.5 §19/Phase 4 §19) — now three phases running without that confirmation, worth actually doing rather than continuing to note as deferred.

### 20. Readiness for the Next Phase
Ready for Phase 5. Two carried-forward recommendations are now overdue rather than merely advisable: the type-sharing mechanism (three phases of accumulating risk, one real incident) and the PrecisionWorkz re-verification (three phases of being noted, zero phases of being done). Neither blocks starting Phase 5, but both should not be deferred a fourth time.

---

## Phase 4 Review — Mission Control (2026-07-07)

### 1. Phase Summary
First UI phase, and the first code outside `app/src/core`. Built a local web app (Node/Express API + Vite/React frontend) under one hard rule: the dashboard visualizes and interacts, it never computes. Scoped by explicit user decision to Overview + Cases + Priority of Use, deferring the full case-type-specific templates and deeper widget registry.

### 2. What Was Accomplished
API layer exposing the existing engine as JSON; React frontend with a real design direction (not a generic template); Cmd+K search backed by the real Search Engine; live case creation and evidence linking that correctly triggers real engine recomputation; Fatletic's 5 cases seeded honestly empty; the Phase 3.5-documented health-score flaw fixed before shipping as a headline number.

### 3. Architectural Decisions Made
ADR-011 (Local Web App Now, Desktop Shell Later) — the only new ADR. Confirms and extends ADR-006/009's pattern: when a toolchain isn't available in this environment, substitute the most portable working alternative rather than block, and document the substitution as a first-class decision, not a workaround.

### 4. Technical Debt Introduced
- No automated frontend tests (component/integration tests for React code) — verification this phase relied on backend API tests, manual `curl` checks, and clean builds, not a frontend test suite. Real gap if the UI grows past this first pass.
- `app/web` and `app/` are two separately-installed npm packages with no shared type source — `web/src/api.ts`'s response interfaces are hand-duplicated from the backend's actual types rather than imported, so they can drift silently if a route's shape changes without updating both sides.
- Command palette's asset search results have no destination view yet (asset detail page wasn't in this pass's scope) — currently falls back to the Cases list, a placeholder acknowledged in the code comment, not hidden.
- No pagination anywhere (`assets` endpoint hard-caps at 500) — fine at Fatletic's real scale (199 assets), a real limit for a much larger workspace.

### 5. Risks Discovered
- Verification ceiling in this environment is real: no browser automation tool available, so visual/interaction correctness rests on build success + typecheck + API contract tests, not an actual rendered screenshot. Explicitly disclosed in `CHANGELOG.md` rather than implied to be fully verified.
- The frontend/backend type-duplication risk (§4) is exactly the kind of thing that stays invisible until a route changes and nothing catches the mismatch — worth a shared-types package or codegen step before the API surface grows much larger.

### 6. Assumptions Validated
- The engine work from Phases 2–3.5 was genuinely UI-ready: every Mission Control view was built without needing a single new query method beyond the two tiny, honest additions (`bandLabel`, `listRelatedCases`) — strong evidence the "build the knowledge layer before any visualization" sequencing (Phase 3's own stated goal) was the right call.
- The "dashboard as thin pass-through" rule held up under real implementation pressure, not just as a stated intention — every route handler in `routes.ts` is inspectable in a few lines and traces to a named engine function.
- sql.js's per-process caching pattern extends cleanly from a short-lived CLI invocation to a long-running server process with no architectural surprises.

### 7. Assumptions Invalidated
- None significant this phase — the main uncertainty going in (whether Tauri would be viable) was resolved quickly by direct environment testing rather than by building partway into a blocked path.

### 8. Performance Observations
Frontend production build: 43 modules, 867ms, ~58KB gzipped JS. API responses for all tested endpoints (overview, case detail with real linked evidence, priority-of-use with real supporting assets) returned in well under 100ms against Fatletic's real 199-asset database. No performance concerns at this scale.

### 9. Opportunities for Refactoring
- Extract shared request/response types into a package (or a generated client) consumed by both `app/src/api` and `app/web/src/api.ts` — the single highest-value refactor given §4/§5's type-drift risk, deferred rather than done speculatively before the API surface stabilizes further.
- `CaseDetail.tsx` and `PriorityOfUse.tsx` share a fair amount of row-list rendering pattern — worth a shared `<AssetRow>` component if a third view needs the same pattern.

### 10. Future Recommendations
1. Build the asset detail view next — the command-palette fallback (§4) is the clearest signal it's the next missing piece, not a hypothetical one.
2. Add a shared-types mechanism before Phase 5/6 add more API surface, per §9.
3. Get an actual pair of human eyes on the running app in a browser before treating the visual design direction as validated — this phase's design choices (graphite/amber, Plex Sans/Mono duality, confidence-bar signature) were built to a stated rationale but never visually confirmed end-to-end in this environment.

### 11. Lessons Learned
- Checking toolchain viability (Rust/cargo) before committing to an architecture, the same move that caught the sql.js issue in Phase 2, caught this one too in under a minute — worth continuing as standard practice at the start of any phase introducing new infra.
- Live-testing a mutation endpoint (the case-link POST) and then explicitly cleaning up the test artifact turned out to matter: it would have been easy to leave "AST-00000004 linked to FATLETIC Trademark Registration" sitting in real data as if a human had curated it.

### 12. Questions for Future Phases
- Should the frontend/backend type-sharing gap (§4/§9) be resolved via a shared TS package, or is generating an OpenAPI spec from the Express routes a better long-term investment given the API surface will keep growing through Phase 5–8?
- Does Mission Control need real-time updates (e.g. polling or SSE) once a second person or process might be scanning/mutating a workspace concurrently, or is manual refresh sufficient for a single-user tool?

### 13. Potential Simplifications
- The two-npm-package split (`app/` and `app/web/`) is the right call for the local-web-app architecture, but if a shared-types package gets added (§9/§12), reconsider whether a lightweight npm workspaces setup would simplify dependency management over two fully independent `node_modules` trees.

### 14. Potential Scalability Concerns
Unchanged from Phase 3.5 at the data layer. New, UI-specific: the `assets` endpoint's hard 500-row cap and lack of pagination anywhere is the first real ceiling introduced this phase — not a concern for Fatletic today, a real one for a much larger workspace or a longer-running multi-workspace deployment.

### 15. Overall Architecture Health Score: 8/10
Held from Phase 3.5. The hard "no business logic in the dashboard" rule was followed rigorously and is independently verifiable (every route handler is short and traceable), which is exactly the kind of principle-adherence this document exists to track. Held back from higher by the type-duplication risk (§4/§5) and the disclosed limits of what could be verified without a browser.

### 16. Code Quality Assessment
Consistent style continued into a new stack: components are small and single-purpose, CSS is token-based rather than ad hoc, and the design rationale is documented inline (e.g. the numbered-steps justification in `PriorityOfUse.tsx`). TypeScript strict mode clean on both packages.

### 17. Maintainability Assessment
High for the API layer (thin, traceable, easy to extend by adding another pass-through route). Frontend maintainability is good but has the one real gap noted in §4 — no component tests — worth addressing before the page count grows much further.

### 18. Plugin Architecture Assessment
Unaffected — Mission Control is core-adjacent infrastructure (API + UI), not a plugin, and correctly contains zero workspace-specific literals (verified: all workspace/case data flows through `:id` route params, nothing hardcoded to "fatletic").

### 19. Workspace Architecture Assessment
Held — every API route is workspace-scoped by `:id` param, the `db-cache` keys strictly by workspace id, and nothing assumes Fatletic is the only or the first workspace (confirmed structurally, not just by intent, since `/api/workspaces` already lists PrecisionWorkz correctly).

### 20. Readiness for the Next Phase
Ready for Phase 5 (Importers/Plugin Loader) or Phase 6 (Case Reports) in either order. The stronger recommendation is closing §9/§12's type-sharing gap early in whichever comes next, before more API surface makes the drift risk compound.

---

## Phase 3.5 Review — Evidence Reliability & Knowledge Validation (2026-07-07)

### 1. Phase Summary

Phase 3.5 was a correctness phase, not a feature phase: fix the Phase 3 epoch-timestamp finding architecturally, and make classification, timeline, provenance, and review-queue output explainable and auditable, before any dashboard/Obsidian/report/AI work begins. No new user-facing capability shipped — every deliverable is infrastructure the next phases are meant to consume rather than reimplement.

### 2. What Was Accomplished

All 12 required systems shipped and are tested (105 tests total, 30 new): Timeline Intelligence, Timeline Resolution Engine, Date Source Priority (configurable, seeded), Evidence Provenance Engine, Explainable Confidence (classification explainability columns), Rule-Based Classification Improvements (sibling context + product-structure rule), Needs Review Intelligence, Data Health Engine, Evidence Quality Metrics, Knowledge Validation Engine, Timeline Explanation, and Future Readiness (every engine built as a reusable function, none tied to a UI). Real validation against Fatletic's actual 199 files, documented in `PHASE_3_5_VALIDATION_REPORT.md`.

### 3. Architectural Decisions Made

One new ADR (ADR-010): the multi-candidate date model. Full rationale in `ARCHITECTURE_DECISIONS.md`. No other new ADRs — everything else extended existing patterns (per-workspace SQLite, delegate-don't-duplicate, config over hardcoding for the priority table).

### 4. Technical Debt Introduced

- **Health score formula is measurably broken**, not just theoretically imperfect: it returned 0/100 on real data with only one true warning-level issue present, because it subtracts a flat penalty per finding regardless of severity mix or workspace size. This is the most concrete, quantified technical debt item in the project so far — documented in the validation report rather than quietly recalibrated to produce a nicer-looking number.
- `resolved_dates` is single-snapshot (delete-then-insert), same pattern/limitation as Phase 3's `evidence_assessments` — still no history table, still not needed yet, still worth deciding before a dashboard tries to chart date-resolution changes over time.
- The relationship-derived candidate pass in `import-engine.ts` does one fixed pass over all relationships per scan, not a full fixpoint iteration — if a long chain of relationships existed (A→B→C→D), a date could take multiple scans to propagate all the way down rather than resolving fully in one run. Not a problem at current relationship density (6 of 199 real assets participate in any relationship), but a real limitation if Phase 4's importers create longer chains.

### 5. Risks Discovered

- **`filesystem_modified` is now trusted for 93% of a real workspace's resolved dates, and it has never been independently validated the way `filesystem_created` just was.** The continuous-use score (1/100 despite 100% timeline completeness) is the visible symptom — a ~55-year date span suggests `mtime` doesn't reliably track real business-activity dates either, at least for files that have been copied/re-saved/moved. This is a new risk this phase's own fix surfaced, not one it introduced.
- The classification rule additions (product-structure folder pattern) were again written by inspecting Fatletic's real folder names specifically — the same "tuned against one dataset" risk flagged in the Phase 3 review remains open, now with one more rule added to the pile that needs eventual validation against a second real workspace.

### 6. Assumptions Validated

- **The core hypothesis of this entire phase — that filesystem timestamps needed to become one candidate among many, not a trusted source — is now proven against real data, not just argued for.** 199/199 real epoch rejections, correct fallback chain, honest confidence drop to 52/100. This is the single most important validated assumption in the project so far.
- The "delegate, don't duplicate" instruction (System 12) held up cleanly in practice: Data Health Engine calling `runIntegrityCheck()` internally rather than re-querying for duplicates/orphans required zero awkward workarounds.
- Storing every candidate permanently (rather than only the winner) had negligible cost at real-workspace scale — 423 rows for 199 assets, sub-second to query.

### 7. Assumptions Invalidated

- We assumed (implicitly, by not checking) that once `filesystem_created` was excluded, the remaining fallback chain would produce reasonably tight, plausible dates. In practice `filesystem_modified` produced dates spanning ~55 years for one real workspace — plausible individually (none epoch, none future) but not necessarily *accurate* in aggregate. "Plausible" and "trustworthy" turned out to be different bars, and this phase only built the first one.

### 8. Performance Observations

Full test suite (105 tests, dozens of real `runScan()` calls): ~6 seconds. Real Fatletic scan with the full Phase 3.5 pipeline (candidate collection + resolution + relationship-derived second pass, on top of Phase 2/3's scan+hash+classify+tag): still a few seconds end to end, no perceptible slowdown from Phase 3's baseline despite 423 new candidate rows and 199 new resolved-date computations. No optimization needed at this scale.

### 9. Opportunities for Refactoring

- The health-score formula (§4) needs a real redesign, not a refactor — flagged for Phase 4/5 rather than done reactively here to avoid tuning it to look good on one dataset instead of being genuinely well-designed.
- `timeline-resolution-engine.ts`'s corroboration/conflict detection (linear scan over all plausible candidates per asset) is fine at 2–3 candidates/asset (today's real average) but would benefit from being written more declaratively if the candidate count per asset grows once more source types become active.

### 10. Future Recommendations

1. **Before leaning on `filesystem_modified` further, spend a small effort validating it against a source we can independently check** (e.g. compare a sample of real Fatletic files' `mtime` against what the user actually remembers about when they were created/edited) — this is now the load-bearing date source for the majority of the workspace and has had zero independent scrutiny.
2. **Recalibrate the health-score formula using percentage-of-assets-affected rather than flat issue counts** before any dashboard surfaces it.
3. **When Phase 4's importers land, prioritize wiring Printful/Instagram dates in** — they sit at the top of the configured priority table already (rank 10/20) but have zero real data feeding them yet; this is the most direct way to raise both the average resolved confidence and the continuous-use score with real, externally-verified dates instead of filesystem inference.

### 11. Lessons Learned

- Fixing one measured problem (epoch dates) surfaced a second, more subtle one (mtime's continuous-use accuracy) that wouldn't have been visible without also building the Evidence Quality Metrics engine in the same phase — confirms the value of shipping the measurement tools alongside the fix, not after it.
- The two real bugs caught by tests this phase (ambiguous SQL column, stale resolved-date cleanup) were both the kind that would have been silent/wrong-answer bugs in production rather than crashes — reinforces that "run the real test suite before declaring done" continues to be worth the time it costs, every phase, not just the first two.

### 12. Questions for Future Phases

- Should `date_source_priorities.priority_rank` for `filesystem_modified` be lowered (trusted less) now that its accuracy is in question, even though it's technically "plausible"? Or should a new intermediate plausibility tier be introduced ("plausible but unverified") distinct from today's binary plausible/implausible? Not decided — flagged for whoever next touches the priority table.
- Does the "User Confirmed" priority-rank-last decision (ADR-010) need revisiting before Phase 4, or is it fine to leave until a real user-confirmation UI exists to make the question concrete?

### 13. Potential Simplifications

- The Evidence Provenance Engine's chain currently only covers the asset→hash→workspace slice; once report generation exists (Phase 5) and genuinely needs the full Trademark-Readiness→...→Workspace chain, it may be simpler to extend this same function with optional upper layers than to build a separate "report provenance" engine — worth deciding at that point rather than speculatively building it now.

### 14. Potential Scalability Concerns

Unchanged from Phase 3 at current scale. One new note: `candidate_dates` grows faster than `assets` (423 rows for 199 assets this run, ~2.1x) — at a much larger workspace size this table would be the fastest-growing in the schema; still not a concern at hundreds-to-low-thousands of files, worth remembering if a workspace ever reaches tens of thousands.

### 15. Overall Architecture Health Score: 8/10

Up from Phase 3's 8/10 (held, not because nothing changed but because gains and new debt roughly offset). Strong: the phase's central goal — architecturally fixing, not patching, the timestamp problem — is genuinely done and genuinely proven against real data. Classification quality improved substantially and measurably. Held back from higher: the health-score formula is now a documented, quantified failure (not just a theoretical gap), and the mtime-accuracy risk (§5/§7) means the "evidence reliability" goal of this phase is meaningfully advanced but not fully closed — the system now knows when it doesn't know something, which is the harder and more important half of that goal, but a real remaining gap (mtime accuracy) is now visible precisely because this phase did its job.

### 16. Code Quality Assessment

Consistent with the established style. Every formula documented inline where computed (Evidence Quality Metrics, Timeline Resolution reasoning strings) rather than only in docs — meaning the explanation a user would eventually see and the code that produces it can't drift apart silently. TypeScript strict mode clean, 105/105 tests passing.

### 17. Maintainability Assessment

High, same assessment as Phase 3. The one new coordination point worth naming: `import-engine.ts` now orchestrates scan → hash → metadata → classify+tag → resolve dates → relationship-derived re-resolution, a longer pipeline than Phase 2/3's. Still readable top-to-bottom in one file, but it's the part of the codebase most likely to need splitting into an explicit pipeline/stage abstraction if 1-2 more stages get added in Phase 4/5.

### 18. Plugin Architecture Assessment

Unchanged and correctly untouched again — Phase 3.5 built core engines, verified against real data, still zero brand-specific literals in `app/src/core` (the product-structure classification rule is generic regex against folder-naming *patterns*, not a Fatletic literal — verified by re-reading the rule, not just by convention).

### 19. Workspace Architecture Assessment

Held. All Phase 3.5 tables are per-workspace, no cross-workspace concept introduced. Same open item as Phase 3: PrecisionWorkz (all-modules-inactive stub) hasn't been scan-tested against the new candidate-date/resolution pipeline specifically — still worth a quick confirmation pass before or during Phase 4, now covering more surface area than when it was last noted.

### 20. Readiness for the Next Phase

Ready, with the mtime-accuracy question (§5/§7/§10) as the one item worth resolving early in Phase 4 rather than letting it sit — not because it blocks starting, but because Phase 4's importers are the most direct, cheapest way to actually resolve it (real commercial/social dates displacing the untested mtime fallback), so sequencing them first is worth considering over strictly building the plugin loader first.

---

## Phase 3 Review — Knowledge Layer (2026-07-07)

### 1. Phase Summary

Phase 3 turned the Phase 2 read-only cataloging engine into a knowledge system: classification, tagging, evidence scoring, case management, querying, graph traversal, provenance chains, integrity checking, and search — all built as engines over the existing per-workspace SQLite schema, with no UI, dashboard, Obsidian generation, report generation, or AI. Classification and tagging are wired directly into the scan pipeline; the other seven engines are on-demand analytical layers. Real validation ran against Fatletic's actual 199-file evidence set, not synthetic data alone.

### 2. What Was Accomplished

All 10 required systems shipped and are tested: Asset Intelligence (aggregator), Case Builder Engine (full service, 8 seeded templates), Evidence Engine (3 scored dimensions + gap detection), Rule-Based Classification Engine (14 deterministic rules), Tag Engine (17-tag deterministic vocabulary), Query Engine (10 typed methods), Graph Engine (4 node types, 3 edge types), Provenance Engine (cycle-safe bidirectional chain walk), Integrity Verification (7 issue types), Search Foundation (unified LIKE-based lookup). Plus: `ARCHITECTURE_PRINCIPLES.md` (new), this document (new), migration `0002_knowledge_layer.sql` (9 tables), 42 new tests (75 total), and a new `analyze` CLI command. Full file list in `CHANGELOG.md`.

### 3. Architectural Decisions Made

No new ADR was required this phase — see `ARCHITECTURE_DECISIONS.md` → "Phase 3 Consistency Review" for the point-by-point check against ADR-001 through ADR-009. The one new *pattern* (not a numbered ADR, since it's an application of Principle #6, not a new principle): case templates are seeded data in a `case_templates` table rather than a hardcoded enum, so custom templates are a future `INSERT`, not a future code change.

### 4. Technical Debt Introduced

- **Classification and evidence scoring are single-snapshot, not versioned.** `classifications` and `evidence_assessments` keep only the current/latest values (delete-then-insert, or "latest per dimension" query logic). There's no way yet to see "how did our evidence completeness score change over the last 3 scans." Acceptable for now — nothing asked for trend history yet — but will need a decision (append-only with a `latest` view, vs. a separate history table) before a dashboard tries to chart evidence strength over time.
- **The rule-based classifier and tag engine are tuned against one real dataset (Fatletic).** The rules are extension/path-keyword-based and not workspace-specific in *code* (Principle #5 holds — no Fatletic literal anywhere), but they were *designed* by looking at Fatletic's real folder names. A second real workspace with very different naming conventions (see Risk below) may reveal the ruleset is narrower than it looks.
- **`QueryEngine.assetsSupportingDimension()` hardcodes a `categoriesByDimension` map in TypeScript** rather than deriving it from data. This is a small, direct violation of Principle #6 (config over customization) that was accepted for scope reasons — flagged here rather than hidden.

### 5. Risks Discovered

- **Critical, real, unrelated to this phase's code: filesystem birthtime is unreliable on this environment.** Every one of 199 real timeline events came back with `file_created = 1970-01-01` (Unix epoch). Root cause: WSL's `drvfs` mount (Windows drive mounted into Linux) doesn't populate `st_birthtime` reliably; Node's `fs.Stats.birthtime` silently falls back to epoch zero. This is the single most important finding of Phase 3 — a system whose stated purpose includes Priority of Use dating cannot currently trust its own "file created" signal on this setup. Not fixed in Phase 3 (it's a Phase 2 ingestion-layer concern, out of Phase 3's declared knowledge-layer scope) — flagged here and in `CHANGELOG.md`, with a concrete recommended fix in §10 below.
- **The generic "Image" classification bucket is large (128 of 199 real assets, 64%) and low-confidence (65, below the 70 Needs-Review threshold).** This is the classifier being honest rather than broken — but it means two-thirds of a real workspace currently sits in Needs Review, which will be a lot of manual triage once a review-queue UI exists. Worth knowing now, not discovering after the dashboard is built.
- **`ffprobe` dependency for video metadata (Phase 2) is silently absent in this environment** (never verified installed) — video assets get filesystem-only metadata. Not a Phase 3 finding specifically, but Phase 3's Historical Evidence classification for videos inherits this gap; worth a health-check surfaced somewhere before Phase 4's importers add more video-adjacent data.

### 6. Assumptions Validated

- **Per-workspace SQLite scales fine for real messy data.** 199 files, 9 new tables, full classification+tagging+evidence+integrity pass — sub-second in tests, a few seconds for the real scan. No performance concern at this scale.
- **The "graph as a read-time view, not a second store" design (Principle #8) works cleanly in practice.** `buildGraph()` composing 4 tables into a generic node/edge shape had no awkward edge cases building it against real data.
- **Confidence-based Needs Review routing (established in Phase 0's spec, finally implemented this phase) produces sensible, defensible results** — the real 71/199 confidently-classified split feels right for a hand-organized personal folder structure, not artificially inflated or deflated.
- **The event bus's "define foundation-only events before there's a producer" pattern (Phase 2) paid off** — adding `classification.assigned`, `tags.assigned`, `evidence.assessed`, `integrity.issue_found` required zero changes to the bus itself, only new entries in the existing type map.

### 7. Assumptions Invalidated

- **We implicitly assumed filesystem `created_at` was a reliable, high-confidence timeline signal** (Phase 2's `TimelineEngine` records it with `confidence: 100, verifiedStatus: 'verified'`). Phase 3's real-data run disproves this on at least this environment — see Risk above. The `confidence: 100` / `verified` labeling for `file_created` events is now known to be potentially wrong and should be revisited (see §10).
- **We assumed "Design Source" (PSD/XCF/AI) would be a small category.** In practice it's 25 of 199 (12.5%) real Fatletic assets — a meaningfully large fraction, not the rare "occasionally you'll have a source file" case the spec examples implied.

### 8. Performance Observations

Full test suite (75 tests, includes ~25 real `runScan()` invocations against temp fixture workspaces): under 5 seconds. Real Fatletic scan + classify + tag (199 files): a few seconds end to end. `analyze` command (evidence assessment + integrity check with cycle detection over the real relationship graph): sub-second. No optimization work needed at this data scale; the `sql.js` in-memory-then-export persistence model (ADR-009) has not shown any strain yet. Integrity engine's cycle detection is a plain DFS with no memoization beyond `visited`/`inStack` sets — fine at hundreds of relationships, would need revisiting in the tens-of-thousands range, which is not a realistic scope for a single workspace's asset relationships.

### 9. Opportunities for Refactoring

- `db/repositories.ts` (Phase 2) and `db/knowledge-repositories.ts` (Phase 3) both hand-write a snake_case→camelCase row mapper per table. A single generic `mapRow<T>(row, fieldMap)` helper would remove repetition — deferred rather than done now, to avoid touching working Phase 2 code mid-Phase-3 for a style improvement with no functional benefit.
- The classification rule list (`rules.ts`) and tag rule list (`tag-rules.ts`) are both ordered if/else chains. They work and are easy to read today at ~15 rules each; if the ruleset grows significantly (e.g. once Phase 4's importers add Instagram/Printful-specific signals), a declarative rule-table format (array of `{match, result}` evaluated in order) would make the growing list easier to audit and test in isolation — not needed yet at the current size.

### 10. Future Recommendations

1. **Fix the epoch-birthtime issue before Phase 4/5 lean further on dates for Priority of Use.** Concrete proposal: in `TimelineEngine.recordAssetTimelineEvents`, detect `createdAt` values at or near the Unix epoch (e.g. within a day of `1970-01-01`) and either (a) skip emitting a `file_created` event for that asset and log a warning, or (b) emit it with `confidence: 30, verifiedStatus: 'inferred'` instead of `100/verified`, and prefer `modified_at` as the primary date signal when this happens. This is a small, contained change to one function.
2. **Before Phase 4 broadens relationship types, add a lightweight "review these classification rules against workspace 2" checkpoint** once the PrecisionWorkz stub (or a real second workspace) gets actual evidence — confirms whether the current ruleset generalizes or was accidentally tuned to Fatletic's specific folder-naming habits.
3. **Consider surfacing `open_review_queue` count and the largest evidence gaps directly in `scan.completed` output**, not only via the separate `analyze` command — given how many real assets (64%) land in Needs Review, making that visible immediately after every scan (not just on request) would match Principle #4's spirit ("never silently treat something as settled") more directly.

### 11. Lessons Learned

- Testing against the real, messy Fatletic dataset (not just synthetic fixtures) caught a real, significant environmental issue (epoch birthtime) that no unit test against clean fixture data would ever have surfaced. The "always run a real scan as part of completion proof" habit established in Phase 2 paid for itself again in Phase 3 — worth keeping as standard practice for every future phase that touches ingestion or scoring.
- Building the Evidence Engine's scoring formulas with mandatory, specific `notes` text (not optional) made it easy to spot the epoch-date problem immediately from the CLI output ("largest single gap... 19975 day(s)") rather than needing to dig into the database — a direct, practical payoff of Principle #3 (traceability), not just a compliance checkbox.

### 12. Questions for Future Phases

- When Phase 4 adds real importer plugins (Instagram/Printful), should classification/tagging re-run automatically for assets those importers touch, using the same "reclassify if touched this run" logic already in `import-engine.ts`, or does importer-sourced data need its own classification pass? (Leaning toward: reuse the existing hook, no new mechanism — but not decided.)
- Should `evidence_assessments` move to an append-only history model before or after the dashboard phase? Doing it before means the dashboard can chart trends from day one; doing it after means not designing history storage speculatively. No strong recommendation yet.
- Does the epoch-birthtime issue also affect `modified_at`/`accessed_at` on this filesystem, or only `birthtime`? Not yet verified — worth a quick check before committing to "prefer modified_at" as the fix in §10.

### 13. Potential Simplifications

- `evidence_assessments`'s generic `scope_type`/`scope_id` design (asset | case | workspace in one table) added a small amount of query complexity (`scope_id IS NULL` handling in `knowledge-repositories.ts`) versus three separate tables. Kept because it avoided three near-identical tables (Principle #8 spirit) — worth revisiting only if a 4th scope type is ever needed and the generic design starts feeling forced rather than natural.
- The Search Engine's five near-identical `db.all(...).map(...)` blocks (one per entity type) could be collapsed into one parameterized helper. Not done — the current form is very easy to read and modify one entity type at a time, which mattered more than the minor duplication given how new and likely-to-change this engine is.

### 14. Potential Scalability Concerns

- None at current or realistically-near-future data scale (single workspace, hundreds to low thousands of files). The concerns worth naming for much later: (a) `sql.js`'s in-memory-then-export-on-save model (ADR-009) would need reconsidering if a workspace's database grew into the hundreds of MB+ range — full export-and-write on every save is O(database size), not O(change size); (b) the Integrity Engine's full-table scans (e.g. rebuilding the entire relationships adjacency map every run) are fine at hundreds of relationships, not designed for tens of thousands.

### 15. Overall Architecture Health Score: 8/10

Strong: every new table traces back to Asset IDs with zero duplicated storage (Principle #2/#8 held perfectly under real implementation pressure, not just on paper); zero Fatletic hardcoding in core (verified by grep, not assumed); every engine is independently testable and was tested against real data, not just mocks. Held back from higher: the technical debt items in §4 (unversioned scoring, one rule hardcoded outside config) are small but real deviations from the stated principles, and the epoch-birthtime discovery means one of Phase 2's confidence labels (`file_created` → `verified`/100) is now known to be wrong in some cases and hasn't been corrected yet.

### 16. Code Quality Assessment

Consistent with Phase 2's established style: small, single-purpose files per engine; every non-obvious decision has an inline comment explaining *why*, not *what*; TypeScript strict mode clean with zero `any` outside deliberate DB-row-mapping boundaries. All 75 tests pass; typecheck clean. The main quality gap is the repeated row-mapping pattern noted in §9 — functional, not elegant.

### 17. Maintainability Assessment

High. Each of the 10 engines lives in its own file/folder under `app/src/core/services/`, has a clear single responsibility, and depends only on the `WorkspaceDatabase` interface plus (where relevant) other engines' public functions — no circular dependencies between engines. A developer adding an 11th engine has a clear, consistent template to follow (see `asset-intelligence.ts` as the most representative example: read from repositories, compose, return a typed view, no side effects beyond what it's explicitly meant to write).

### 18. Plugin Architecture Assessment

Unchanged and correctly untouched this phase — Phase 3 explicitly built core engines, not plugins, and that classification was correct: none of the 10 systems are brand- or source-specific (verified by grep for Fatletic/FATLETE literals — zero hits outside comments). The plugin *loader* itself (manifests, activation-by-module-flag) remains unbuilt — still deferred to Phase 4, now for the second time, since there is still no second real plugin to validate it against. This continues to be the right call under Principle #6/#5's spirit (don't build an abstraction layer for one implementation) rather than schedule slip.

### 19. Workspace Architecture Assessment

Held cleanly. Every new Phase 3 table lives in the same per-workspace database (ADR-001); nothing added a cross-workspace concept. The PrecisionWorkz stub workspace (all modules inactive) was not re-tested this phase specifically for the knowledge layer — worth a quick confirmation in Phase 4 that classification/tagging/evidence assessment behave sanely (i.e., produce empty-but-correct results, not errors) against a workspace with zero assets, since that path is exercised by the test suite's empty-fixture tests but not by a real second-workspace run.

### 20. Readiness for the Next Phase

Ready. The knowledge layer gives Phase 4 (importers + plugin loader) and Phase 5 (reports) real, tested foundations to build on rather than requiring them to invent their own data access patterns. The one blocking-ish recommendation before leaning further on dates (§10, item 1) is small and contained — doesn't need to gate starting Phase 4, but should land before any report or dashboard surfaces a Priority of Use date to a user.

---

## How to Extend This Document

At the end of each future phase, append a new `## Phase N Review — <Name> (<date>)` section following the same 20-point structure. Do not edit or remove prior phase sections — if a prior finding turns out to be wrong or resolved, note that in the new phase's section (e.g. under "Assumptions Invalidated" or "Lessons Learned"), pointing back to which phase raised it. The value of this document is the trail, not a single polished snapshot.
