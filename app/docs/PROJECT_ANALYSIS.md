# Project Analysis

Phase 0 deliverable. Read-only analysis of the repository, the specs, and the Fatletic workspace as they exist today. No code or files were moved, renamed, or modified to produce this document.

## 1. Repository Inventory

```
BrandOS/
  app/
    .claude/            <- 0-byte FILE, not a directory (see §5)
    docs/                DASHBOARD_WIREFRAME.md, IMPLEMENTATION_CHECKLIST.md
    obsidian-temple/     empty
    plugins/             empty
    prompts/             CLAUDE_MASTER_PROMPT.md
    scripts/             empty
    shared/              empty
    specs/               00_VISION.md ... 16_SECURITY_AND_BACKUPS.md (17 files)
    src/                 empty
    tests/               empty
    MASTER_PLAN.md
    PROJECT_OVERVIEW.md
    README.md
    ROADMAP.md
    .gitignore
  backups/               empty
  exports/               empty
  installer/             empty
  workspaces/
    Fatletic/
      workspace.json
      README.md
      06_Obsidian/        <- referenced by this task's instructions, does not exist yet
      <~90+ raw evidence files/folders, untouched>
  .gitignore
```

No application code exists anywhere in the repo (`app/src`, `app/plugins`, `app/shared`, `app/scripts`, `app/tests` are all empty). This is genuinely a Phase 0 / pre-implementation state, consistent with the task instructions.

## 2. Spec and Doc Coverage

All 17 spec files (`00_VISION.md` through `16_SECURITY_AND_BACKUPS.md`) and all four `app/*.md` planning docs (`MASTER_PLAN.md`, `PROJECT_OVERVIEW.md`, `README.md`, `ROADMAP.md`) plus `CLAUDE_MASTER_PROMPT.md` and `DASHBOARD_WIREFRAME.md` were read in full. Findings:

| Area | Spec coverage | Notes |
|---|---|---|
| File scanning, hashing, metadata | Strong (`02`, `03`, `04`) | Well specified, workspace-agnostic in substance already |
| Classification + confidence scoring | Strong (`05`) | Categories are apparel/brand-flavored but the *mechanism* (confidence bands, Needs Review) generalizes cleanly |
| Human Review Queue | Strong (`06`) | Generic mechanism |
| Relationships + Timeline | Strong (`07`, `08`) | Generic mechanism, Fatletic-flavored examples only |
| Priority of Use Dossier | Strong (`09`) | Legal-document spec, inherently brand/trademark-specific — this is a **report template**, not a core service |
| Trademark Readiness Report | Strong (`10`) | Same — a report template |
| Dashboard | Strong (`11`) | Page list is Fatletic-only; needs a registry model |
| Instagram / Printful importers | Strong (`12`, `13`) | These are **importer plugins**, not core services |
| Organized Directory Schema | Strong (`14`) | Root folder name is hardcoded `Fatletic_Archive/` |
| Exports | Strong (`15`) | Package types are Fatletic-flavored but the export mechanism is generic |
| Security/Backups | Strong (`16`) | Fully generic already |
| **Case Builder** | **Missing** | Instructed by this task, described in `workspaces/Fatletic/workspace.json` (`modules.caseBuilder: true`) and `workspaces/Fatletic/README.md`, but **no platform spec exists** |
| **Workspace configuration schema** | **Missing** | `workspace.json` exists as an artifact but nothing in `app/specs` defines its schema, validation rules, or how the platform loads it |
| **Plugin architecture** | **Missing** | `01_ARCHITECTURE.md` names services as a numbered list, not as a plugin contract; `app/plugins/` exists as an empty folder with no manifest convention |
| **Obsidian vault generation** | **Missing from specs** | Referenced by `workspace.json` (`modules.obsidian: true`), by `app/obsidian-temple/` (empty), and by this task, but has zero spec coverage |

**Conclusion: spec coverage of the underlying mechanisms (scan → hash → classify → relate → timeline → report → export) is solid and mostly generalizes without rewriting logic. The presentation layer of every spec — names, examples, output filenames — is 100% Fatletic-specific. Three whole subsystems the task requires (Case Builder, workspace config, plugin architecture) have no spec at all.**

## 3. Architecture Conflicts

1. **Every spec file assumes a single brand.** `01_ARCHITECTURE.md` describes "Core Services" as a flat numbered list (File Scanner, Metadata Extractor, ...) with no workspace boundary, no plugin boundary, and no mention of `workspaces/`. As written, a literal implementation of spec `01` would produce a single-tenant Fatletic app, not a platform.
2. **`14_ORGANIZED_DIRECTORY_SCHEMA.md` hardcodes `Fatletic_Archive/`** as the root of the generated archive. This directly contradicts the "no Fatletic hardcoding in core" rule and needs to become a workspace-parameterized template.
3. **`app/PROJECT_OVERVIEW.md` names the product "Fatletic Brand Archive (FBA)"** — the product identity itself is defined as Fatletic, not BrandOS. `app/README.md` opens with "A full project specification for building a professional Brand Archive ... for FATLETIC." These are the top-level docs a new contributor (or a future Claude session) would read first, and they actively mis-describe the project as single-brand.
4. **`CLAUDE_MASTER_PROMPT.md` instructs a builder to "Build the FATLETIC Brand Archive & Trademark Evidence Vault from the provided spec files"** — if used as-is, this prompt would drive implementation directly against the wrong target (Fatletic-only, not BrandOS-the-platform).
5. **No plugin manifest convention exists.** `app/plugins/` is an empty directory with no `plugin.json`-style contract defined anywhere, so "plugin architecture" is currently a folder name, not a design.
6. **No second workspace exists to prove genericity.** Every "reusable" claim in the current specs is unverified — there is nothing yet that would catch a Fatletic-specific assumption sneaking into core code. (Addressed under Improvement Proposals.)

## 4. Fatletic Workspace Analysis

`workspaces/Fatletic/` contains real, unorganized business evidence: logos, PSD/XCF/AI source files, product mockups, Printful proof PDFs, promotional video/images, text-file business plans, and font experiments, spread across ~14 top-level folders plus 20 product subfolders under `Fatletic Offical Logo Clothing Promo/`. Observations relevant to system design:

- **Human-organized, not machine-organized.** Folder names mix purpose ("Text Docs", "Proof Files") with format ("Photoshop Files", "Gimp Files"), and several one-off files sit loose at the workspace root instead of in any category folder (e.g. `Mission Statement.txt`, `bitmap.svg`, `fatletic inspiration.jpg`). The classification engine cannot trust folder location as a signal — this validates spec `05`'s content/metadata-first approach.
- **Confirmed duplicate content.** `Mission Statement.txt` (workspace root) and `Text Docs/Mission Statement.txt` are byte-for-byte identical. This is a live, real example for the Duplicate Detection feature — good for testing, and proof the feature is needed (not hypothetical).
- **Near-duplicate variants are common.** The logo folders contain multiple upscaled/optimized/edited variants of the same source image (e.g. `Fatletic_Optimized_4MB.jpg`, `Fatletic_Optimized_10MP.jpg`, `Fatletic_Optimized_HighDPI.png`, plus `_LE_upscale_balanced` variants). These are exactly the "near-duplicate clustering" case called out in `ROADMAP.md`'s v2 scope — worth pulling into v1 as a lightweight perceptual-hash pass given how much of the evidence set is affected.
- **Inconsistent, sometimes typo'd naming.** "Offical" (sic) appears throughout as the standard spelling; one file is named "Faletic" (missing the "t"). The scanner/classifier must not rely on exact brand-name string matching in filenames.
- **Sensitive filenames.** A number of files under `Fatletic Offical Logos/` and `Variations of Offical Logo/` use profanity/slurs in the filename itself (evidently informal internal nicknames from early development, not brand marks). This is flagged in `RISKS.md` — it is a real constraint on how the Classification Engine, Case Builder, and especially the PDF/legal report generators must handle raw filenames, since those reports may be shown to an attorney, USPTO, or an investor.
- **Mixed evidentiary strength.** Promising for a Priority of Use Dossier: dated-looking product proof PDFs (`Proof Files/13080129_20613013_proof (1).pdf`), source-to-export chains (`.psd`/`.xcf` next to `.png`/`.jpg` exports), and Instagram-adjacent assets. Weak/missing so far: no visible raw Printful order export, no visible raw Instagram data-download ZIP (per spec `12`/`13` "Inputs") — only derived screenshots and promo videos. This will surface real Human Review Queue and Evidence Gaps entries once scanning runs, which is expected and good — it's exactly what those features are for.

## 5. Missing Files/Folders

- **No root-level `README.md`** for BrandOS itself. `app/README.md` exists but describes the Fatletic product, not the platform. A visitor to the repo root today has nothing telling them this is a multi-workspace platform.
- **No `app/specs` entry for Case Builder, Workspace Schema, or Plugin Architecture** (see §2/§3).
- **`workspaces/Fatletic/06_Obsidian/`** does not exist yet — referenced by this task's instructions as the target Obsidian vault path but not yet created (correctly — vault generation is implementation, not Phase 0).
- **`app/.claude` is a 0-byte file, not a directory** — almost certainly an accidental artifact (likely from a tool creating a file where a directory was intended). There is also a separate, untracked `.claude/` directory at the repo root (visible in `git status`). Worth a deliberate decision on which one is intentional rather than leaving both.
- **No second/example workspace** (e.g. a minimal stub workspace) to validate that core code has no Fatletic-specific assumptions baked in.
- **`installer/`, `backups/`, `exports/` are empty with no `.gitkeep` or README** explaining their intended contents — ambiguous whether they're meant to be populated by the app at runtime (exports/backups, likely gitignored) or by hand (installer, likely tracked).

## 6. Summary

The underlying *mechanisms* specified (scan, hash, classify, relate, timeline, review queue, export) are sound and largely reusable as-is. The problem is entirely at the naming/identity and missing-subsystem layer: every doc currently says "Fatletic" where it should say "the workspace," three required subsystems (Case Builder, workspace config, plugins) have no spec, and nothing yet proves the architecture actually generalizes beyond Fatletic. `SYSTEM_ARCHITECTURE.md` and `IMPROVEMENT_PROPOSALS.md` address these directly.
