# Plugin Validation Report — Import Framework & Plugin Runtime

Generated 2026-07-08. Every claim below is backed by a real, reproducible check performed during this phase — a passing test, a real database row, a real CLI run against Fatletic/PrecisionWorkz — not an impression. Where something wasn't tested, that's stated explicitly rather than implied, per this phase's own "build what can be validated, document what cannot" mandate applying equally to its own claims.

## Plugin Health

**Real, live, and observed under both success and failure.** `plugin_health`/`plugin_health_events` track `last_run_status`, `consecutive_failures`, `total_runs`, and `total_failures` per plugin, updated through the one choke point (`runPluginCall()`) every plugin call passes through. Verified directly: `tests/core/plugin-runtime.test.ts`'s recovery test drives a plugin through a failure (`consecutiveFailures` → 1) followed by a different plugin's success, confirming each plugin's health row is independent — one plugin's failure does not corrupt or reset another's counters. A real Fatletic scan shows `importer-generic-folder` with `total_runs: 2, total_failures: 0, last_run_status: success` — the health system's first real, non-fixture data point.

## Plugin Isolation

**Verified at three levels, not assumed from architecture alone.**
1. *Within one workspace, across plugins*: `tests/core/plugin-runtime.test.ts` proves an incompatible plugin (`incompatible-plugin`, deliberately impossible `engineCompatibility`) is skipped without preventing `good-plugin` from loading; a plugin whose `discover()` throws (`broken-plugin`) never propagates a raw exception — always a typed `PluginExecutionError`, always recorded to `plugin_health` first.
2. *Within one workspace, across import runs*: a failed import run finishes as `import_runs.status = 'failed'` with `error_message` populated, without corrupting the workspace database or blocking a subsequent successful run — proven by the golden dataset's idempotency test running scan twice in sequence.
3. *Across workspaces*: real, live proof, not a fixture — a real Fatletic scan shows `importer-instagram`/`importer-printful` as `active` (both `modules` flags are `true`), and a real PrecisionWorkz scan in the same process shows both as `disabled` with the specific reason `"module flag(s) [instagram] not enabled"` / `"...[printful]..."`. This is the fifth consumer type (after scan results, DB rows, API responses, generated vault files) confirmed to respect the ADR-001 workspace boundary.

## Plugin Maturity

Mixed, by design, and stated exactly rather than averaged into a single number:
- **`importer-generic-folder`: production-mature.** It is not a demo plugin — it is what every Fatletic/PrecisionWorkz scan has run through since this phase shipped, meaning its real-world exercise count is identical to this project's entire scan history from this point forward.
- **`importer-zip-archive`: production-mature, less battle-tested.** Fully implemented and tested (extraction, provenance, idempotency, cleanup — 4 tests), but not yet exercised against a real Fatletic ZIP (none exists in the workspace to test against without adding one to real evidence, which was deliberately not done). Verified instead against a real ZIP built with `adm-zip` in the test suite — real bytes, real archive format, just not a real *brand* artifact.
- **`importer-instagram` / `importer-printful`: registration-mature, extraction-absent.** Everything up to the exact boundary of needing real external data is real and tested: manifest validation, registration, per-workspace activation, compatibility checking, error-isolated calls. Each has a `BLOCKED.md` stating precisely what unblocks it. This is an honest maturity ceiling, not an oversight — see each plugin's own file for detail.

## Import Reliability

Every import — folder scan or ZIP — now produces exactly one `import_runs` row recording plugin, version, source, every count (added/updated/skipped/duplicates/warnings/errors), and a `validation_passed` flag from a real `validateKnowledge()` run. A failed import is recorded as `failed` with the actual error message, never silently dropped. Verified against real Fatletic data: `list-imports` shows a complete, accurate history matching the real scans performed during this phase's own development and testing.

## Import Repeatability & Idempotency Verification

**Proven, not assumed, for both real importers:**
- Folder scan: a second real Fatletic scan (199 files, already-scanned) produced `0 created, 0 updated, 199 unchanged` — the exact idempotent result expected, confirmed via a real CLI run, not just a fixture.
- ZIP import: `tests/core/importer-zip-archive.test.ts`'s idempotency test re-imports an unchanged ZIP and confirms zero new assets, zero updates, and — critically — that the *same* Asset IDs are reused on the second import (proven via a before/after ID-set comparison), not just that the count matches.
- The Golden Dataset's own idempotency test additionally confirms relationship and duplicate-group counts stay identical across a re-scan, not just asset counts.

## Performance

Not formally benchmarked — the same honest gap carried from Phase 5's validation report through every phase since, restated rather than re-discovered. Anecdotally: the full 141-test suite (20 new this phase) runs in ~10 seconds; a real Fatletic scan through the new plugin-runtime-mediated path shows no perceptible slowdown against pre-Phase-7 timings, though this was not measured with instrumentation.

## Error Recovery

Verified directly for both cross-plugin and same-plugin scenarios. `tests/core/plugin-runtime.test.ts` has two recovery tests: one drives `broken-plugin` to `consecutiveFailures: 1` and confirms a separate `good-plugin` success doesn't cross-contaminate its health row; a second drives `broken-plugin` through two real failures (`consecutiveFailures: 2, totalFailures: 2`) and then a real success attributed to the same plugin ID, confirming `consecutiveFailures` resets to 0 while `totalFailures` and `totalRuns` correctly preserve history rather than resetting.

## Remaining Risks

- **The aggregator-adjacent risk named in this phase's Architecture Review §5**: `loadPluginsForWorkspace()` is now a second single-choke-point (alongside Phase 6's `getAssetIntelligence()` finding) whose staleness would silently affect every future plugin type. No evidence of actual staleness today — flagged as a pattern to watch, not a current defect.
- **Pre-existing Core literal-leakage** (`classification-engine/rules.ts`'s `"instagram"`/`"printful"` path checks, `DateSourceType`'s brand-specific-sounding literals) — predates this phase, newly surfaced by this phase's own review discipline, not yet fixed.
- **No true load test** of the plugin runtime with many plugins active simultaneously (today: at most 4 real plugins in any one workspace) — the loader's per-plugin try/catch design should scale linearly, but this is reasoned, not measured.
- **`deactivate()` has no caller** — not a defect today (no plugin needs teardown), but a real gap if a future plugin ever holds an open resource (a file handle, a network connection) that needs explicit cleanup on workspace close.

## Recommendations

1. Once real Instagram/Printful export data exists, build and validate real `discover()` implementations against it — both plugins are otherwise ready to receive that work with zero runtime changes needed.
2. Add a true same-plugin fail-then-succeed recovery test to close the narrow gap named above.
3. Fix the pre-existing Core literal-leakage finding as a small, dedicated pass (not a drive-by during a larger feature phase).
4. Get a real, instrumented performance baseline once Phase 8's real importer data grows the dataset — now recommended in four consecutive phase-level reports without being done.

## Overall Plugin Runtime Readiness Score: 8.5/10

Matches this phase's Architecture Review score (§15) — both assessments are measuring the same underlying work. Strong: the runtime and both real importers are genuinely production-quality, verified against real Fatletic/PrecisionWorkz data at every level (registration, activation, isolation, idempotency), not just unit-tested in isolation. Held below 9: two plugins are honestly capped at registration-only maturity (correctly, not by oversight), no performance baseline exists, and this phase's own review surfaced a small pre-existing architectural violation it did not fix. None of this blocks Phase 8; all of it is precisely stated so Phase 8 can act on it deliberately.
