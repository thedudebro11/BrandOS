# Risks

Identified during Phase 0 analysis. Severity is relative to this project's goals (a trustworthy, multi-workspace evidence platform), not generic software risk.

## Architecture Risks

### R1 — Fatletic hardcoding leaks into core despite the plugin design (High)
The single biggest risk. Every existing spec was written single-brand; it is easy for an implementer (human or AI) working phase-by-phase to reach for the fastest path and drop a brand-specific `if` or literal into what should be core code, especially under time pressure. **Mitigation:** the Phase 1 second-workspace stub (`IMPLEMENTATION_PLAN.md`) exists specifically to catch this — if core code can't run cleanly against a workspace with different `modules` flags and no brand data, that's a structural test failure, not a style nitpick. Should be a mandatory check before any Phase 2+ work is considered done.

### R2 — Plugin architecture becomes ceremony without payoff if only one workspace ever gets built (Medium)
If Fatletic remains the only workspace with real data for a long time, the discipline of building importers/classifiers/report templates as plugins rather than direct core code has a real cost (ADR-002) with no immediate benefit to show for it. **Mitigation:** this is a known, accepted tradeoff per the task's explicit instruction ("Every feature must support future workspaces"); worth revisiting only if a future session confirms no second workspace is coming soon, in which case the plugin boundary could be relaxed for velocity — but that would be a deliberate re-decision, not a default drift.

### R3 — Per-workspace SQLite (ADR-001) makes cross-workspace features harder later (Low-Medium)
If a future requirement emerges for a true portfolio dashboard across many workspaces at once, per-workspace DB files mean fan-out queries instead of one query. **Mitigation:** acceptable at expected scale (single digits to low tens of workspaces); revisit only if that assumption breaks.

## Legal / Evidence-Integrity Risks

### R4 — Sensitive raw filenames could appear in attorney-facing or investor-facing exports (High)
Confirmed present today: multiple files in `Fatletic Offical Logos/` and `Variations of Offical Logo/` have profanity/slurs as filenames. If a report template or export ever prints a raw filename verbatim, a formal exhibit meant for the USPTO or an attorney could contain unprofessional or offensive text that has nothing to do with the brand mark itself. **Mitigation:** ADR-007 (hash/label-based citation, never raw filename, in generated documents) — this needs to be treated as a hard requirement of the report/export system, not an optional nicety, and confirmed with the user (`QUESTIONS.md` Q5) before Phase 6 report templates are built.

### R5 — Confidence-score enforcement is currently a documentation convention, not a code path (Medium)
Spec `05` says "never silently guess" and "<70 confidence → Needs Review," but nothing enforces this except the eventual implementation choosing to honor it. If a report generator is built independently of the review-queue routing logic, it's easy to accidentally cite a low-confidence classification as fact. **Mitigation:** `SYSTEM_ARCHITECTURE.md` §7 specifies this must be enforced in the `CaseBuilderService`/`ReportTemplate` contract layer (reject/flag citations below threshold), not left to each report template's author to remember.

### R6 — "Proves" vs. "supports/indicates" language discipline has no automated check (Medium)
Same class of risk as R5 — a stated house style rule with no enforcement mechanism yet. **Mitigation:** proposed lightweight lint pass over generated report text before it's finalized (flag prohibited words: "proves," "guarantees," "confirms ownership," etc.), scoped into Phase 6.

### R7 — Chain of custody could be broken by well-intentioned manual reorganization (Medium)
The workspace evidence is currently in ad hoc, human-organized folders (see `PROJECT_ANALYSIS.md` §4). It would be tempting for the user or a future contributor to "clean up" the raw folder by hand before the scanner ever sees it, which would alter file `created`/`modified` timestamps on some filesystems and potentially weaken first-use-date evidence. **Mitigation:** the workspace README's "do not modify originals" rule needs to be restated prominently and early — worth flagging directly to the user now, outside the doc set, since it's a live risk today, not just a future one.

## Technical Risks

### R8 — Duplicate/near-duplicate evidence volume is higher than the current spec plans for (Medium)
Confirmed: byte-identical duplicate (`Mission Statement.txt` in two locations) and multiple near-duplicate logo variants exist in the real evidence set today. The current spec defers near-duplicate image clustering to v2 (`ROADMAP.md`). If left at v2, the Human Review Queue and Asset Library could be cluttered with near-duplicates for the entire v1 lifetime. **Mitigation:** `IMPLEMENTATION_PLAN.md` Phase 4 pulls a basic perceptual-hash pass forward into v1.

### R9 — Filename-based assumptions will break on real data (Low-Medium)
Confirmed inconsistent casing and at least one typo ("Faletic") in real filenames. Any classifier or importer logic that pattern-matches on exact brand-name spelling in filenames will silently misclassify or skip real evidence. **Mitigation:** already reflected in `SYSTEM_ARCHITECTURE.md`'s classifier design (metadata/content-first, not filename-first); worth calling out explicitly as an anti-pattern in the eventual `19_PLUGIN_ARCHITECTURE.md` / classifier spec.

### R10 — Large binary evidence (video, PSD, high-res images) and git do not mix (Medium)
The current `.gitignore` correctly excludes raw evidence, but nothing yet prevents a future workspace's `workspace.json`/README pattern from being added without the same exclusion, or prevents someone from accidentally `git add -A`-ing a large file before checking `.gitignore` coverage. **Mitigation:** generalize the `.gitignore` pattern per `IMPROVEMENT_PROPOSALS.md` so it applies to `workspaces/*/` structurally, not by hardcoding each workspace name as it's added.

## Operational Risks

### R11 — Obsidian vault regeneration could silently overwrite manual user edits (Medium)
If the user starts hand-editing generated notes in Obsidian (very likely, since that's the point of using Obsidian) and the vault generator later regenerates and overwrites those notes, edits are lost with no warning. **Mitigation:** flagged as an open question (`QUESTIONS.md` Q4) — needs a decision (e.g. generator only touches notes it fully owns and never edits a note with unrecognized manual content, detected via content-hash drift) before Phase 7.

### R12 — Empty placeholder directories (`installer/`, `backups/`, `exports/`, `app/plugins/`, etc.) with no documentation of intended contents (Low)
Not a functional risk today, but a maintainability one — anyone (including a future AI session) opening this repo cold has no way to know if these are meant to be populated by hand, by CI, or by the running app. **Mitigation:** addressed in `IMPROVEMENT_PROPOSALS.md` (add short README/`.gitkeep`-with-purpose to each).

### R13 — `app/.claude` stray 0-byte file vs. untracked root `.claude/` (Low)
Ambiguous which is intentional; could indicate a partially-failed setup step rather than deliberate config. **Mitigation:** flagged for a quick decision, `QUESTIONS.md` Q6 — low severity but cheap to resolve and worth not leaving as silent debris.
