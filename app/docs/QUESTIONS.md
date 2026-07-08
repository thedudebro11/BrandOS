# Open Questions

Decisions that need Oscar's input before or during implementation. Each includes a recommended default where one exists — silence is not consent to proceed past Phase 0, but these are flagged so approval can address them explicitly rather than each blocking implementation individually later.

## Q1 — Desktop shell: Tauri or Electron?
`01_ARCHITECTURE.md` names both as options. Tauri is lighter-weight and better suited to a local-first tool handling large media evidence, but Electron has a simpler Node-native plugin loading story. This affects how the plugin loader (ADR-002) is actually implemented.
**Recommendation:** Tauri, unless there's a reason to prefer Electron's ecosystem maturity (e.g. a specific library only available for Node/Electron).

## Q2 — Should Phase 1 (spec generalization) happen before or interleaved with Phase 2+ (code)?
The plan sequences spec rewriting as its own phase immediately after approval. An alternative is to generalize each spec just-in-time as its corresponding service gets built, avoiding a big up-front rewrite pass that might get revised anyway once real implementation surfaces gaps.
**Recommendation:** Do the rewrite up front (as planned) — the specs are currently actively wrong (Fatletic-branded), and leaving them wrong while building against them risks the exact hardcoding risk (R1) this whole exercise is meant to prevent.

## Q3 — What is the second/example workspace for the Phase 1 stub?
`IMPLEMENTATION_PLAN.md` proposes a minimal non-Fatletic workspace stub purely to prove genericity. Candidates named in this task: Precision Workz, Sales Pro, Safe Steps, a future brand, or a personal knowledge vault. A personal knowledge vault type is architecturally the most different from Fatletic (no trademark/case-builder concerns at all), which makes it the strongest genericity test but also the most work to config correctly.
**Recommendation:** A generic `_template` workspace (not a real named future brand) with `modules` mostly `false` — cheapest to build, still proves the config-driven activation model works, and doesn't force a premature decision about which real brand comes second.

## Q4 — Obsidian vault: generated-only, or does the user want to hand-edit notes?
Directly affects ADR-005 and R11. If the user plans to treat the generated vault as a starting point they'll personally annotate in Obsidian, the vault generator needs an explicit "don't clobber manual edits" strategy (content-hash drift detection, or a clear separation between a `generated/` subfolder and a `notes/` folder the user owns). If the vault is purely a read-only generated view, regeneration can be simpler (always overwrite).
**Recommendation:** Ask directly — this materially changes the `VaultGenerator` design in Phase 7, worth locking down before, not during, that phase.

## Q5 — Confirm the filename-sanitization approach for legal exports (ADR-007)
Proposed: never print raw filenames in generated attorney/USPTO-facing documents, use neutral exhibit labels + a private hash/citation index instead. Given the sensitive filenames confirmed in the evidence set, this needs explicit sign-off rather than an assumed default, since it also affects whether/how the user can supply friendlier per-file display names.
**Recommendation:** Approve the hash/label approach in ADR-007; separately, consider whether the user wants to review the specific flagged filenames now (outside this doc set) rather than waiting for Phase 6.

## Q6 — What should happen to `app/.claude` (stray 0-byte file) vs. the untracked root `.claude/`?
Low-stakes but worth a quick answer: keep one, remove the other, or confirm both are intentional and serve different purposes (e.g. one is a Claude Code project config directory, the other a leftover).
**Recommendation:** Investigate and clean up during Phase 1 repo hygiene pass — not blocking, but flagged so it isn't silently forgotten.

## Q7 — Should generated output (`.brandos/`, `06_Obsidian/`, exports) be excluded from git per ADR-005, or does the user want any of it version-controlled?
Specifically: does the user want the Obsidian vault's evolution tracked in git (e.g. to see brand-history notes change over time), separate from full-disk/external backups?
**Recommendation:** Exclude by default (ADR-005), matching raw evidence treatment; revisit per-workspace if the user wants vault history tracked.

## Q8 — Priority order for the eight initial Fatletic cases?
`SYSTEM_ARCHITECTURE.md` §7 lists all five cases named in this task (FATLETIC Trademark Registration, Priority of Use Dossier, FATLETE Comparison, Brand History Archive, Media Kit) as Phase 6 work. Is there a real-world deadline (e.g. an actual trademark filing date) that should reorder which case gets built and populated first?
**Recommendation:** None — purely needs Oscar's input on any external timeline pressure (e.g. USPTO filing plans) that isn't visible from the repo alone.
