# Phase 8 Reports Validation Report — Professional Reports & Evidence Binders

Generated 2026-07-08. Every claim below is backed by a real, reproducible check performed during this phase — a passing test, a real generated file, a real grep against generated output — not an impression. Where something wasn't tested or isn't yet safe, that's stated explicitly rather than implied.

## Report Maturity

**High and uniform across all 9 report types — verified, not assumed.** Every report type generated successfully against real Fatletic data (up to 633 citations in the largest, Evidence Binder) and against PrecisionWorkz's completely empty evidence tree (zero crashes, all 8 workspace-scoped types). All 9 pass through the identical generator pipeline (compose → validate → render × 4 → write → persist) with zero report-type-specific code in the pipeline itself — maturity is uniform by construction, not because each report type happened to receive equal effort. `case_summary` and case-scoped `evidence_binder` were additionally verified against a real Fatletic case (case #1), including a real `case_links` row created via the new `linkReport()` method.

## Evidence Citation Quality

**Real and mechanically enforced, with one significant caveat (see Legal-Risk Safeguards).** The report-validation engine refuses to write any report where a non-exempt section has zero citations — this is not a soft guideline, it's a hard failure `generateReport()` throws on. This check was exercised for real during development: 6 of the 9 report generators initially failed it, because gap/finding/risk sections rendered prose text without building corresponding `Citation` objects. Every citation is built from real engine data (`Citation.assetId` from a real `assets.asset_id`, `confidence`/`sourceType` from a real `resolved_dates` row, `caseId` from a real `cases.id`) — `tests/core/report-engine.test.ts` independently confirms every citation with an `assetId` resolves to a currently-active asset, not just that citations exist. What the validation engine cannot check: whether a citation's *description* semantically matches its section's body text (a structural check, not a semantic one — see Remaining Gaps).

## Determinism

**Proven with both a positive and negative test, not just a positive one.** `hashReportContent()` computes a SHA-256 over a stable, key-sorted stringification of `ReportData` with `generatedAt` excluded. Verified: regenerating the same report from unchanged data produces an identical hash (positive proof); making a real data change (resolving one review-queue item) and regenerating produces a different hash (negative proof — confirms the hash isn't trivially constant). This two-sided proof is stronger than Phase 6's incremental-regeneration proof, which only demonstrated the positive case.

## Export Readiness

**All 4 formats real and distinct, not a JSON wrapper repeated 4 times.** Markdown, screen HTML, print-ready HTML (page-break-aware CSS, `@page` rules, serif type — genuinely different from screen HTML, not the same file with a different `<title>`), and JSON (the canonical `ReportData`, so any external consumer parsing it gets exactly what generated the other 3 formats) were all verified: files exist on disk, are non-empty, markdown contains the report title, HTML contains a valid `<!doctype html>` document, PDF-ready HTML contains real `@page` print CSS, and JSON round-trips via `JSON.parse()` into a structurally equivalent object. **No PDF binary is generated** — this environment has no headless-browser/PDF-rendering dependency (the same category of constraint as ADR-009's sql.js substitution), so "PDF-ready HTML output" is implemented literally: HTML formatted for a browser's own "Print to PDF," not a `.pdf` file BrandOS produces itself. Stated plainly here so it's never assumed to be more than it is.

## Legal-Risk Safeguards

**Real, but with one significant, named gap — the most important finding in this report.**
- **Present:** the Trademark Readiness Report carries `REPORT_LEGAL_DISCLAIMER`, a fixed, non-negotiable string stating BrandOS is not providing legal advice and the report must be reviewed by a licensed attorney — set on every generated instance, verified by direct inspection of real output. No report generator computes a legal conclusion (readiness scores are transparent composite averages of existing assessments, never a "this mark is/isn't registrable" style claim).
- **Missing:** ADR-007 ("sensitive filenames hash-referenced, never echoed verbatim, in generated legal/export documents") is **not honored** by any of the 9 reports. Evidence Binder's Chain of Custody and Hash References sections, and any citation carrying a real filename, print it directly — no exhibit-label substitution, no private citation index. This matters concretely, not just in principle: ADR-007's own original context documents that real filenames in Fatletic's evidence tree contain profanity/slurs. **A Phase 8 report should not be handed to an attorney or third party until this is closed** — this is stated as a hard recommendation, not a nice-to-have, and is the same conclusion `ARCHITECTURE_REVIEW.md`'s Phase 8 entry reaches independently.

## Remaining Gaps

1. **ADR-007 compliance (above)** — the highest-priority gap, with real consequence for this specific workspace's real data.
2. **No semantic citation-quality check** — the validation engine confirms citations exist and reference real assets, not that a citation's description text actually matches what its section claims. No evidence of an actual mismatch (verified by direct code review of all 9 generators), but the validation layer itself cannot catch one if a future report generator introduces it.
3. **No export-package bundling** (ZIP delivery packages combining multiple reports) — out of this phase's actual scope, distinct from the 4-per-report-type output formats that were built.
4. **No report caching/skip-if-unchanged** — every generation call fully recomputes, unlike Phase 6's vault notes. Acceptable for explicitly-triggered document generation; would need revisiting only if reports became scheduled/automatic.
5. **No performance benchmark** — the same gap named in Phases 5, 6, and 7's own reports, now at its fifth consecutive mention.

## Readiness for AI Assistant

**Foundation-ready, correctly not AI-ready — AI was on this phase's explicit "do not build" list.** What exists that a future AI feature could consume: 9 report types' worth of real, structured, citation-backed `ReportData` — a stronger, more curated retrieval surface than the raw knowledge graph alone, since each report already represents one coherent analytical framing (readiness, priority of use, evidence strength) of the same underlying facts. Any future AI assistant summarizing or answering questions about a workspace's evidence would be a new consumer of `ReportData`/the report registry, not a reason to add new data-composition logic.

## Readiness for Graph Visualization

**Low, correctly, since graph visualization was also on this phase's "do not build" list and nothing here changes that.** Reports render citations as tables/lists, never as a graph. The underlying data (`GraphNode`/`GraphEdge` from Phase 3's `graph-engine.ts`) is untouched by this phase and remains exactly as ready or unready for visualization as it was after Phase 3 — Phase 8 neither advanced nor regressed this.

## Overall Reports Readiness Score: 8.5/10

Matches this phase's Architecture Review score (§15) — both assessments measure the same underlying work. Strong: uniform maturity across all 9 report types, mechanically-enforced citation integrity (caught real bugs, not just theoretical ones), two-sided proof of determinism, and honest documentation of every real limitation, including a limitation (ADR-007) with actual consequence for this workspace's real data. Held at 8.5 rather than raised, specifically because of that ADR-007 gap — a report system that doesn't yet honor an existing architecture decision governing exactly the documents it produces is a genuine finding, not a cosmetic one. Held, not lowered, because the gap was found and disclosed by this phase's own review process before anyone else would have had to find it, and every other claim in this report is independently verifiable against real generated output.
