# Phase 6 Knowledge Layer Validation Report — Knowledge Layer & Obsidian Integration

Generated 2026-07-08. Every claim below is backed by a real, reproducible check performed during this phase — a passing test, a real generated file, a real `git status` on the vault directory — not an impression. Where something wasn't tested, that's stated explicitly rather than implied, per this phase's own "never invent facts" mandate applying equally to claims about itself.

## Knowledge Completeness

**High, and directly measured, not estimated.** Every active Fatletic asset (199) and every case (5) produced exactly one note; the workspace produced exactly one note; 8 index pages were generated. Total: 213 notes for Fatletic, 9 for PrecisionWorkz (workspace + 8 empty indexes — correct, since PrecisionWorkz has zero assets/cases as a deliberate proof-of-genericity stub). The Living Knowledge Review's "missing note" check — comparing `obsidian_notes` against every active asset/case row in the database — found zero gaps on both workspaces after generation. Every note's content is drawn from `getAssetIntelligence()` / `CaseNoteData` / `WorkspaceNoteData`, the same aggregators Mission Control uses, so vault completeness and dashboard completeness are structurally the same claim, not two separately-maintained ones.

## Backlink Coverage

**Real, not simulated.** Asset notes link outward to related assets (via `relationships`), supporting cases, and — for assets carrying a "Logo" tag or "Design Source"/"Product Photo" classification — are linked *inward* from the corresponding index page. Case notes link outward to every supporting asset and to related cases (assets shared with another case). The Living Knowledge Review's "broken link" check parses every `[[...]]` wikilink in every tracked note (via regex against the actual on-disk content, not a re-derivation from the database) and confirms the target note exists; this ran clean on both workspaces post-generation. The "missing backlink" / orphaned-by-no-incoming-link check also ran clean for every asset reachable from at least one index or case. Not yet measured: a *density* metric (average links per note) — the review checks correctness (no broken links, no unreachable notes), not richness, which is the correct scope for a validation engine but worth naming as a gap.

## Index Completeness

All 8 specified index pages generated for both workspaces: All Assets, All Cases, Needs Review, Duplicates, Priority of Use, Logo Evolution, Design Evolution, Products. Each is a real filtered query result (`query.assetsByTag("Logo")`, `query.listAssetsFiltered({classification: ...})`, etc.) rendered as a wikilink list — confirmed by inspecting generated content directly, not just checking the file exists. Fatletic's indexes contain real counts matching the underlying data (e.g. the Needs Review index lists exactly the assets classification flagged `needsReview`); PrecisionWorkz's indexes are honestly empty ("_Nothing here yet._"), not hidden or omitted, consistent with the phase's index-pages-not-duplicate-entities design principle: an index is a live query result, never a second copy of an entity.

## User-Edit Preservation

**Verified against a real hand-edit, not only a test fixture.** `tests/core/vault-generator.test.ts` covers both preservation scenarios (content added below the generated block survives regeneration; a hand-edit made *inside* the generated block is detected via content-hash mismatch and the writer refuses to overwrite, reporting `skipped_manual_edit`). Beyond the test suite: `Assets/AST-00000114.md` in the real Fatletic vault was hand-edited during this phase's development, regenerated, confirmed preserved, then cleaned back to its stub state — an end-to-end proof on the actual file the user would open in Obsidian, not a fixture standing in for one. This closes ADR-008's previously-open "sibling file vs. delimited block" question in favor of delimited block (see `ARCHITECTURE_DECISIONS.md`).

## Incremental Generation

**Proven at real scale.** Running the generator a second time against an unchanged Fatletic workspace produces 213 `skipped_unchanged` outcomes and zero rewrites — confirmed by inspecting `VaultGenerationSummary` output and by the `resolvedDate` bug fix itself, which correctly and *only* triggered `updated` outcomes for the 199 asset notes whose generated content actually changed (their Timeline section), not for the 5 case notes or workspace note whose content was unaffected. The content-hash mechanism (SHA-256 of the trimmed generated block) is the correct primitive for this — cheap to compute, and it already caught a case a naive "did the aggregator return different data" check might miss (whitespace-only differences are correctly treated as unchanged).

## Performance

**Anecdotally strong, not formally benchmarked — stated plainly.** Full generation of Fatletic's 213 notes plus the Living Knowledge Review completes well within interactive CLI timeframes on real hardware (single-digit seconds, informally observed, not instrumented with a timer). The 121-test suite (10 new this phase) runs in single-digit seconds total. No dedicated performance benchmark exists for the vault generator specifically, consistent with the project's standing gap (first named in the Phase 5 validation report and still open): no automated performance/load testing exists anywhere in this codebase yet.

## Scalability

**Architecturally reasoned, explicitly not empirically load-tested.** The incremental hash-skip mechanism is the right shape for the 100,000+ note target named in this phase's spec — a regeneration run's cost scales with *changed* entities, not total entities, once the skip path dominates. What was NOT done: generating 100,000 synthetic notes to produce an empirical number. This is a deliberate omission, not an oversight — fabricating that volume of fake assets/cases to produce an impressive-looking benchmark would itself violate this phase's "never invent facts" principle, since the resulting notes would describe evidence that doesn't exist. The honest position: the mechanism is sound by design, unproven by measurement, and the right time to get a real number is Phase 7, when real importer data (Instagram/Printful) grows the dataset without fabrication.

## Readiness for AI

**Foundation-ready, not AI-ready — correctly, since AI was on this phase's explicit "DO NOT BUILD" list.** What exists now that an eventual AI feature could consume: a complete, queryable knowledge graph (Phase 3), reliability-scored dates with full reasoning chains (Phase 3.5), and now a human-readable Markdown rendering of all of it with real backlinks — a reasonable retrieval surface. What's explicitly absent and correctly so: no embeddings, no summarization, no generated prose beyond templated sentences assembled from real fields. Any future AI phase would be adding a new consumer on top of the same aggregators the vault uses, not inventing new data access.

## Readiness for Reports

**High.** The report system (planned Phase 8, formerly Phase 7 before this phase's insertion) needs exactly what this phase already proved works: composing `AssetIntelligenceView`/`EvidenceAssessment`/case data into formatted output without inventing facts, citing real sources, and handling "nothing to report yet" as an honest state rather than a placeholder. The vault's Timeline section — real resolved date, confidence, and reasoning, with raw candidates available but clearly subordinate — is a direct preview of the citation discipline ADR-007 requires from report templates.

## Readiness for Export System

**Moderate.** The vault generator establishes the pattern an export system needs (read-only rendering from aggregators, respecting ADR-003's "reference, don't duplicate" rule until the actual export boundary), but exports have additional requirements this phase didn't need to solve: packaging into a delivery format (ZIP/PDF), and ADR-007's filename-hashing/citation-index scheme for anything leaving the workspace to a third party. Nothing built this phase blocks that work; nothing built this phase does it either.

## Remaining Technical Debt

Carried from Phase 5, untouched this phase (correctly — Phase 6 was scoped to the knowledge layer, not cleanup): the duplicated row-mapper, 2 dead functions, and 4 empty scaffolding directories. One of those four, `app/obsidian-temple/` (misspelled, distinct from the git-tracked `app/obsidian-template/`), is now a stronger deletion candidate than before, since real vault generation exists and never used it. New this phase, and already closed rather than carried forward: the `getAssetIntelligence()` resolvedDate gap (see `ARCHITECTURE_REVIEW.md` Phase 6 §4/§5 for the full account) — fixed at the source, verified via typecheck, full test suite, frontend build, and real vault regeneration.

## Remaining Architectural Risks

- **The aggregator-gap pattern this phase surfaced (§5 of the Architecture Review) is the most important open risk, not a closed one** — the specific instance is fixed, but the general risk (a single composition point silently falling behind a newer sibling system) is structural and will recur unless a standing check is adopted (see Architecture Review §10.3).
- No performance/load testing exists anywhere in the project (carried from Phase 5, restated above under Performance/Scalability, not new).
- The Obsidian Vault Status widget remains unbuilt — the drift-detection *data* exists (`obsidian_notes.has_manual_edits`) but there is no UI surfacing it yet, meaning a user who hand-edits a note has no in-dashboard confirmation that BrandOS correctly preserved it (they'd currently have to check via Obsidian itself, or trust this report).

## Recommendations Before Phase 7

1. Build the Obsidian Vault Status widget as part of Phase 7's work, using the `obsidian_notes` table this phase already built — closing the one user-facing gap this phase's own architecture left open.
2. Adopt the standing practice named in this phase's Architecture Review §10.3: whenever a new knowledge-layer table or resolution system ships, explicitly check `getAssetIntelligence()` (and any other single-aggregator pattern) for staleness before shipping the next consumer.
3. Use Phase 7's real importer data as the first legitimate opportunity to get an empirical performance/scalability number for the vault generator, closing this report's one honestly-unproven claim without fabricating test data.

## Overall Knowledge Layer Readiness Score: 8.5/10

Matches this phase's Architecture Review score (§15) — the two assessments measure the same underlying work from different angles, and Phase 6 was explicitly a knowledge-layer-health phase in the same spirit Phase 5 was a platform-health phase. Strong: knowledge completeness, backlink coverage, index completeness, and user-edit preservation are all evidence-backed by real generated output and a real hand-edit test, not just design intent. The score is held at 8.5 rather than raised further because performance/scalability remain honestly unproven at target scale (by design, not oversight) and because this phase's main event — finding and fixing the `resolvedDate` aggregator gap — is a maintenance correction to existing architecture rather than a demonstration of new strength, the same reasoning Phase 5's held score used. None of this blocks Phase 7; it's stated precisely so Phase 7 can act on it deliberately.
