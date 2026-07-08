# Architecture Principles

This document is BrandOS's constitution. Every future change — a new engine, a new plugin, a new workspace, a new UI, a new phase — is evaluated against these principles before it's evaluated against anything else (elegance, speed of delivery, convenience). When a principle and a shortcut conflict, the principle wins. If a principle needs to change, that's a deliberate, visible decision recorded as an ADR in `ARCHITECTURE_DECISIONS.md` — not something that happens by accretion.

These are non-negotiable. Everything else in the specs, the architecture docs, and the codebase is negotiable detail underneath them.

## 1. Original evidence is never modified

No code path — core, plugin, CLI, dashboard, AI, or otherwise — may write, rename, move, or delete a file inside a workspace's raw evidence tree. The only filesystem writes any BrandOS code performs are confined to a workspace's `.brandos/` folder (and, once built, its Obsidian vault and export destinations — always additive, never touching the source). This is enforced structurally (`WorkspaceFs.writeGenerated()` throws if asked to write outside `.brandos/`, and there is deliberately no rename/delete method anywhere in the engine), not just by convention. If a future feature seems to require modifying an original, the answer is that feature is wrong, not that this principle bends.

## 2. Every relationship, link, and reference uses Asset IDs — never filenames or paths

A permanent `AST-########` ID is assigned once, at first scan, and never changes — even if the file is renamed, moved, or goes missing. Relationships, timeline events, case links, tags, classifications, evidence assessments, and every future report or export cite the Asset ID, not a filename or path. Filenames are display convenience; Asset IDs are the only stable handle the system is allowed to depend on. This is what makes it safe for a user to reorganize their raw folders by hand without silently breaking every derived record.

## 3. Every conclusion must be traceable back to source assets

Nothing BrandOS generates — a classification, a tag, an evidence score, a case's completeness rating, a future report sentence — may exist without a path back to the specific asset(s), timeline event(s), or metadata fact(s) that produced it. "Trust me" is not an acceptable output. If a conclusion can't cite its source, it isn't a conclusion the system is allowed to state — it belongs in the Human Review Queue instead.

## 4. Never invent facts, never overstate confidence

Confidence scores reflect actual signal strength, not optimism. A rule that matches on a weak signal (a folder name keyword) must score lower than a rule that matches on a strong signal (a file's own binary header). Below a 70 confidence threshold, an item goes to Needs Review — it does not get silently treated as settled. Generated language uses "supports," "indicates," "appears to show" — never "proves" unless evidence directly and unambiguously proves the claim. This applies to every dimension the system scores: classification, evidence strength, priority of use, continuous use, everything.

## 5. Favor plugins over hardcoding

Anything specific to one workspace, one brand, one data source, or one report format is a plugin, not core. Core code (`app/src/core/`) may never contain a literal workspace name, brand name, trademark, or plugin identifier. If a feature is being built and the fastest path involves writing `if (workspace.id === 'fatletic')` anywhere under `core/`, that is a signal the feature belongs in a plugin instead, even when there's currently only one real-world case to generalize from.

## 6. Favor configuration over customization

When two workspaces need different behavior, the answer is a `workspace.json` field or a database-stored template/rule set — not a code branch. Case types, evidence dimensions, dashboard widgets, and report packages are all designed to be declared in config or seeded as data, not hardcoded as an enumerated list a developer has to extend for each new use case. Configuration can be changed by editing a file or a row; customization requires shipping new code. Prefer the former every time it's genuinely sufficient.

## 7. One database per workspace; a workspace folder is a self-contained unit

No cross-workspace table, no shared multi-tenant store. A workspace's `.brandos/archive.db` plus its raw evidence folder is everything needed to understand that workspace — it can be moved, zipped, or handed to a third party without extracting rows from anywhere else. This is what makes "never leak one brand's evidence into another's report" a structural guarantee instead of a query-discipline hope.

## 8. No duplicated information — everything is a reference

When one piece of data needs to be visible from many angles (an asset's tags, its classification, its evidence relevance, its linked cases), the system composes a read-time view over normalized tables rather than copying the data into a wider row or a second store. A "knowledge layer" is a way of *querying* what's already there, not a new place to store a second copy of it.

## 9. Read-only until explicitly told otherwise

Every engine defaults to read-only against the evidence tree, and defaults to append-only / additive against generated data (mark-missing instead of delete, replace-then-insert instead of silent overwrite where history might matter). Anything destructive — deleting a case, renaming a display label, permanently discarding a duplicate — requires an explicit, human-initiated action, never an automatic side effect of a scan or an analysis pass.

## 10. Event-driven, not tightly coupled

Services communicate by emitting events on the shared bus (`file.discovered`, `asset.created`, `classification.assigned`, etc.) so that future consumers — the dashboard, Obsidian generation, reports, AI features — can subscribe without the producer needing to know they exist. A service should never need to import and directly call another layer's code (e.g. a core engine calling into a future UI component) to do its job.

## How to use this document

Before adding a feature, ask: does this touch an original file? Does it reference anything by filename instead of Asset ID? Can every number or sentence it produces point back to a source asset? Does it hardcode a workspace or brand where a plugin or config value should sit instead? If any answer is uncomfortable, that's the principle doing its job — fix the design before writing the code, not after.
