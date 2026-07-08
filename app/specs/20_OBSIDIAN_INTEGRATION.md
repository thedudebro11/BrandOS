# Obsidian Integration

## Purpose
Generate a per-workspace Obsidian vault so every important asset, case, report, milestone, and timeline event has a Markdown note with backlinks — while never silently destroying a user's own edits to those notes.

## Output Location
`workspaces/<id>/<paths.obsidianVault>` (default `06_Obsidian/`, per `workspace.json` — see `18_WORKSPACE_CONFIG_SCHEMA.md`). For Fatletic: `workspaces/Fatletic/06_Obsidian/`.

## Note Types
- Asset note (per classified file)
- Case note (per Case Builder case)
- Report note (per generated report)
- Timeline Event note
- Milestone note

## Note Structure
YAML frontmatter (entity type, id, confidence, dates, safe asset ID/hash reference — never a raw filename for sensitive items, see `21_FILENAME_SANITIZATION.md`) plus a Markdown body, linking related entities via `[[wikilinks]]`.

## Edit Preservation (approved)
Obsidian notes may be hand-edited by the user after generation. Regeneration must never silently overwrite manual edits.

- Every generated note's generated content is tracked via a content hash in `obsidian_notes.content_hash`.
- On regeneration, if the note on disk still matches the last-known generated hash, it is safely rewritten in place.
- If the note on disk no longer matches (the user edited it), the generator does **not** overwrite it. Instead:
  - New generated content is written to a sibling file (e.g. `Asset 0142.generated.md`) for manual merge, **or**
  - Generated content is confined to a clearly delimited block within the note (e.g. between `<!-- brandos:generated:start -->` / `<!-- brandos:generated:end -->` markers), and only that block is ever rewritten — everything outside it is left untouched.
- The exact mechanism (sibling file vs. delimited block) is an implementation choice for Phase 2+; either satisfies the "never silently overwrite" rule. Both must ship together with a diff/merge view in the dashboard's Obsidian Vault Status widget (see `11_DASHBOARD.md`) so the user can see what changed before accepting a regeneration.

## Rule
Vault generation is read-from-database, write-to-vault-folder only. It never reads from or writes to the raw evidence tree.
