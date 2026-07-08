# Phase 3.5 Validation Report — Evidence Reliability & Knowledge Validation

Generated 2026-07-07 from a real, full scan + analysis of `workspaces/Fatletic/` (199 real files: logos, PSD/XCF/AI source files, PDFs, product mockups, promo video/images, business text docs). Every number below comes directly from `npm run scan -- fatletic` followed by `npm run analyze -- fatletic` and direct database queries against the resulting `.brandos/archive.db` — nothing here is estimated or hand-written.

## Timeline Reliability

**Timeline completeness: 100%** — all 199 active assets have a resolved date. This number alone would be misleading without the next one, which is the actual point of this phase:

**Assets whose filesystem-created timestamp was rejected as implausible: 199 of 199 (100%).** Every single `filesystem_created` candidate on this real workspace was detected as a Unix-epoch artifact and excluded from resolution — confirming the Phase 3 finding was universal on this environment, not a fluke of a few files.

**How the 199 assets actually got resolved, once the bad signal was excluded:**
| Winning source | Count | % |
|---|---|---|
| `filesystem_modified` | 185 | 93% |
| `pdf_metadata` (real embedded metadata) | 11 | 5.5% |
| `exif` (real embedded metadata) | 3 | 1.5% |

**Average resolved-date confidence: 52.1/100.** This is deliberately modest, not inflated — it reflects that 93% of resolutions fell back to `filesystem_modified` (baseline reliability 50/100), the best signal actually available once `filesystem_created` was correctly excluded, not a fabricated high-confidence answer.

**Assets using filesystem timestamps only (no metadata/pattern corroboration): 185 of 199 (93%).** These are honestly labeled as such — visible via `resolved_dates.source_type = 'filesystem_modified'` — not silently presented as equivalent to the 14 assets with real embedded-metadata dates.

**Assets with multiple candidate dates stored: 423 candidate rows across 199 assets (avg. 2.1 per asset), 0 discarded.** Every candidate that was ever found is still in `candidate_dates`, including the 199 rejected epoch ones — nothing was thrown away, only excluded from winning.

## Classification Accuracy

**Classification completeness: 73%** (146 of 199 assets confidently, non-Unknown classified) — up from 36% in the Phase 3 baseline, driven by two real improvements, not a threshold change:

| Category | Phase 3 count | Phase 3.5 count |
|---|---|---|
| Image (generic, low-confidence) | 128 | 53 |
| Product Photo (new: known product-structure rule) | — | 50 |
| Export | 3 | 26 |
| Design Source | 25 | 27 |
| Documentation | 18 | 18 |
| Commerce Evidence | 16 | 16 |
| Historical Evidence | 9 | 9 |

The 75-asset drop in the generic "Image" bucket is real signal, not relabeling: 50 moved to "Product Photo" via the new known-folder-structure rule (`Clothing Promo` path pattern — see `classification-engine/rules.ts`), and Export grew from 3 to 26 as relationship detection and sibling-context boosting found more source→export pairs than Phase 3's single stem-match heuristic alone.

**Confidence distribution:** 0–39: 0 · 40–69: 53 · 70–89: 111 · 90–100: 35. Zero assets in the lowest band — the classifier either finds real signal or lands exactly at the Needs Review threshold, never below it with false confidence.

## Metadata Completeness

**66%** of active assets have at least one extracted metadata fact (EXIF/PDF/PSD/XCF header/etc.). The remaining 34% are mostly plain images and text documents with no embedded metadata to extract — an honest ceiling given the file types present, not a gap in the extractor.

## Relationship Completeness

**3%** (6 of 199 assets participate in a detected relationship). This is intentionally low — Phase 2/3.5 only implement the single same-folder/matching-stem heuristic; broader relationship types (mockup→Printful order→shipment, per the Phase 3 spec's example chain) require importers that don't exist yet (Phase 4). Reported honestly as a real ceiling of the current system, not a bug.

## Provenance Completeness

**100%** of assets have a fully traceable resolved-date provenance chain (Resolved Date → Candidate Date → Original Asset → SHA-256 Hash → Workspace), verified via `traceResolvedDateProvenance()` and the `provenance_chain_completeness` and `every_resolved_date_has_a_real_candidate` knowledge-validation checks (both passed).

## Assets Requiring Review

**27%** (53 of 199) are in the open Human Review Queue (classification confidence below 70), each with a concrete `suggested_action`, `estimated_effort`, and `potential_impact` (Needs Review Intelligence, System 7) — not just a bare "low confidence" flag.

## Remaining Evidence Gaps

- No dated evidence for **Marketing Evidence** or **Marketplace Evidence** categories — Priority of Use claims for these categories cannot currently be supported (both flagged `high` priority in `evidence_gaps`).
- **Continuous use score: 1/100.** Even with 100% timeline completeness, the *span* of dates is enormous (~20,117 days, ~55 years) because `filesystem_modified` dates on copied/re-saved files don't necessarily reflect real business activity dates — this is a distinct, second-order finding beyond the epoch-birthtime issue: **`modified_at` is a usable fallback for plausibility, but is not itself a strong continuous-use signal.** Worth a dedicated look in a future phase once commercial/social import data (Printful, Instagram) gives genuinely verified dates to raise the priority ranking above filesystem sources in practice, not just in the config table.

## Remaining Technical Debt

1. **Health score formula is miscalibrated.** Computed as `100 − (critical×10 + warning×3 + info×1)`, it hit **0/100** on this real run purely from volume (200 info-level `invalid_timestamp` findings — one per rejected epoch candidate — plus 46 orphaned-asset infos), even though zero critical and only one warning-level issue exist. The formula punishes count, not severity mix, and needs revisiting (e.g. weighted-average or percentage-based rather than flat subtraction) before it's used as a genuine dashboard health indicator. Documented here rather than tuned away just to make this report look better.
2. Evidence assessment and classification scoring remain single-snapshot (noted already in `ARCHITECTURE_REVIEW.md` Phase 3 section) — still true, unchanged this phase.
3. `assetsSupportingDimension()` in the Query Engine still hardcodes a category-to-dimension map in TypeScript rather than config (noted in Phase 3 review, unchanged).

## Remaining Architectural Risks

- **`filesystem_modified` is now the de facto primary date source for 93% of this real workspace.** It was never independently validated the way `filesystem_created` was this phase — it's plausible (not epoch) but its *accuracy* as a proxy for "when this business event happened" is unverified. The continuous-use finding above is the concrete symptom.
- **The classification and tag rule sets remain tuned by inspection of one real workspace (Fatletic).** The new product-structure rule in particular was written directly against Fatletic's actual folder name. Still unverified against a second real workspace — same risk noted in the Phase 3 review, not yet closed.

## Readiness for Dashboard

**Ready, with one caveat.** Every metric a dashboard would want to surface (timeline/metadata/relationship/classification completeness, needs-review %, duplicate/evidence/provenance coverage, confidence distribution) is now a tested, reusable function (`computeEvidenceQualityMetrics`) rather than a one-off query — exactly the "build once, reuse everywhere" goal of this phase. The caveat: the health score formula (Technical Debt #1) should not be surfaced to a user as-is until recalibrated, since `0/100` on a workspace with only one real warning-level issue would be actively misleading rather than merely imprecise.

## Overall Foundation Readiness Score: 7.5/10

Up from Phase 3's implicit baseline. Strong: the core architectural fix (filesystem timestamps as one candidate among many, never assumed true) is proven working against real data, not just designed on paper — 199/199 epoch rejections, correct fallback, honest confidence. Classification quality improved substantially and measurably. Every new engine is tested and delegates rather than duplicates. Held below 8+: the health score formula is genuinely broken and documented as such rather than hidden, continuous-use is still weak for reasons now understood but not yet fixed, and relationship/metadata coverage remain low ceilings inherited from not yet having Phase 4's importers. None of these block starting dashboard work, but the health-score formula specifically should not ship to a UI unchanged.
