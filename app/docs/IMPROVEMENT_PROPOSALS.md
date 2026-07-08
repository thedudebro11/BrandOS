# Improvement Proposals

Concrete, file-level proposed changes. Nothing here is applied yet — this is the Phase 1 work order, pending approval.

## 1. Spec Generalization Mapping

| File | Action | Notes |
|---|---|---|
| `00_VISION.md` | Rewrite | Currently answers "when did FATLETIC begin" etc. Reframe as workspace-agnostic questions ("When did this brand/entity begin? What is the earliest proof of the name/identity? ...") with Fatletic's specific questions moved to a workspace-level vision note if wanted. |
| `01_ARCHITECTURE.md` | Rewrite | Add the layered architecture, plugin system, and per-workspace data model from `SYSTEM_ARCHITECTURE.md`. This is the file most responsible for R1 (hardcoding risk) if left as-is. |
| `02_FILE_SCANNER.md` | Light edit | Already generic in substance ("selected FATLETIC directory" → "selected workspace directory"). |
| `03_METADATA_ENGINE.md` | No change needed | Already fully generic. |
| `04_HASHING_AND_CHAIN_OF_CUSTODY.md` | No change needed | Already fully generic. |
| `05_CLASSIFICATION_ENGINE.md` | Light edit + move category list | The confidence-scoring mechanism is generic; the specific category list (Logo, Printful order, ...) is apparel/brand-specific and should move into `classifier-apparel-brand`'s plugin spec, with core defining only the confidence-band mechanism and a minimal universal category set (Document, Image, Video, Design Source, Unknown). |
| `06_HUMAN_REVIEW_QUEUE.md` | No change needed | Already fully generic. |
| `07_RELATIONSHIP_ENGINE.md` | Light edit | Replace Fatletic-specific relationship examples with generic ones; keep as illustrative, not exhaustive. |
| `08_TIMELINE_ENGINE.md` | Light edit | Timeline *types* list ("Logo Evolution," "Commercial Use") is brand-flavored; keep the mechanism generic and note that the specific timeline set is workspace/plugin-declared. |
| `09_PRIORITY_OF_USE_DOSSIER.md` | Relocate | Move to `app/specs/plugins/report-priority-of-use.md` (or `app/src/plugins/report-priority-of-use/SPEC.md`). This is inherently a trademark-specific report template, not a core requirement for every workspace. |
| `10_TRADEMARK_READINESS_REPORT.md` | Relocate | Same treatment as above → `report-trademark-readiness`. |
| `11_DASHBOARD.md` | Rewrite | Replace the fixed page list with the widget-registry model from `SYSTEM_ARCHITECTURE.md` §8; keep the current page list as the *default widget set for brand-type workspaces*, not the only possible dashboard. |
| `12_INSTAGRAM_ARCHIVE.md` | Relocate | → `importer-instagram` plugin spec. |
| `13_PRINTFUL_IMPORTER.md` | Relocate | → `importer-printful` plugin spec. |
| `14_ORGANIZED_DIRECTORY_SCHEMA.md` | Rewrite | Replace hardcoded `Fatletic_Archive/` with `{workspace_id}_Archive/` template; this is the most direct hardcoding conflict found (§3 of `PROJECT_ANALYSIS.md`). |
| `15_EXPORTS.md` | Light edit | Package *names* (Attorney Review, Trademark Filing Prep, ...) are brand/legal flavored but the export mechanism is generic; keep mechanism in core spec, note that the specific package list is workspace/case-type driven. |
| `16_SECURITY_AND_BACKUPS.md` | No change needed | Already fully generic. |

New specs to add:

- `17_CASE_BUILDER.md` — formalizes the Case Builder module design from `SYSTEM_ARCHITECTURE.md` §7 as a numbered core spec (it's a core service, not a plugin, since every workspace type can use it even if with a different `caseTypes` list).
- `18_WORKSPACE_SCHEMA.md` — formalizes `workspace.json`'s schema, validation rules, and the `modules`/`paths`/`caseTypes` contract from `SYSTEM_ARCHITECTURE.md` §4.
- `19_PLUGIN_ARCHITECTURE.md` — formalizes the four plugin contracts and manifest convention from `SYSTEM_ARCHITECTURE.md` §6 / ADR-002.
- `20_OBSIDIAN_VAULT_GENERATION.md` — formalizes `SYSTEM_ARCHITECTURE.md` §9, including the answer to `QUESTIONS.md` Q4 once decided.

## 2. Top-Level Doc Rewrites

- **`app/README.md`** — currently opens "A full project specification for building a professional Brand Archive ... for FATLETIC." Rewrite to describe BrandOS as the platform, with Fatletic named explicitly as "the first workspace," matching the language already used correctly in `workspaces/Fatletic/README.md`.
- **`app/PROJECT_OVERVIEW.md`** — currently names the product "Fatletic Brand Archive (FBA)." Rewrite product identity to BrandOS; keep a short "Fatletic Workspace" subsection describing what Fatletic specifically is within the platform.
- **`app/MASTER_PLAN.md`** / **`app/ROADMAP.md`** — superseded by `IMPLEMENTATION_PLAN.md`. Recommend replacing their contents with a short pointer to `app/docs/IMPLEMENTATION_PLAN.md` rather than maintaining three overlapping plan documents.
- **`app/prompts/CLAUDE_MASTER_PROMPT.md`** — currently instructs a builder to "Build the FATLETIC Brand Archive & Trademark Evidence Vault." Rewrite to instruct building BrandOS-the-platform with Fatletic as the first workspace to populate, referencing the new spec structure (§1) and this doc set.
- **Add a root `README.md`** — does not exist today. Should briefly state what BrandOS is, point to `app/docs/` for architecture, and point to `workspaces/` for workspace data, so anyone (including a future Claude session with no memory of this conversation) can orient immediately.

## 3. Repository Hygiene

- **`.gitignore` generalization** — current root `.gitignore` hardcodes `workspaces/Fatletic/*` with two negations. Replace with a pattern that applies to any `workspaces/<id>/`, e.g.:
  ```
  workspaces/*/*
  !workspaces/*/README.md
  !workspaces/*/workspace.json
  ```
  so adding a second workspace doesn't require remembering to hand-edit `.gitignore` again (a realistic way for R10 to occur).
- **Resolve `app/.claude`** (0-byte file) vs. untracked root `.claude/` — per `QUESTIONS.md` Q6.
- **Add short README/purpose notes** to `installer/`, `backups/`, `exports/`, and the currently-empty `app/plugins/`, `app/shared/`, `app/scripts/`, `app/tests/`, `app/obsidian-temple/` directories, stating what each is for and whether its contents are hand-maintained or app-generated. `app/obsidian-temple/` in particular has an unclear relationship to the planned `workspaces/<id>/06_Obsidian/` per-workspace vault output — worth clarifying whether it's a shared template source (likely) or something else, since right now it's just an empty, undocumented folder.
- **Line-ending normalization** — `git diff` on `workspace.json`/`README.md`/`.gitignore` shows the only actual changes present are line-ending churn (LF touched to CRLF or vice versa). Worth adding a `.gitattributes` with `* text=auto` (or an explicit LF policy) so this doesn't keep showing up as noise in future diffs.

## 4. Fatletic Workspace-Level Additions (not core platform changes)

- Add `workspaces/Fatletic/06_Obsidian/` once vault generation ships (Phase 7) — not created now, per instructions.
- Consider a `workspaces/Fatletic/CASES.md` or DB-seeded equivalent listing the five named initial cases, so the Case Builder has real seed content the first time it runs against Fatletic rather than starting empty.
- Given the confirmed exact-duplicate (`Mission Statement.txt`) and heavy near-duplicate logo variant set, consider whether the user wants an early, lightweight "duplicate report" run manually (even before full Phase 3-4 implementation) just to get visibility — flagged as optional, not required, since Phase 0 explicitly forbids touching originals or building code yet.

## 5. Summary of Priority

If only a subset of this can happen immediately after approval, the highest-value items are: (1) generalizing `01_ARCHITECTURE.md` and `14_ORGANIZED_DIRECTORY_SCHEMA.md` since they contain the most direct hardcoding conflicts, (2) adding the three missing core specs (`17`–`19`), and (3) the `.gitignore` generalization, since that one is a live risk (R10) every day it isn't fixed, not just a future-implementation concern.
