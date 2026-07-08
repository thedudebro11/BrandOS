# Dashboard — Mission Control

## Yes, There Should Be a Dashboard
The organized directory is the storage layer. The dashboard is how the user sees the story, evidence, risks, and progress — mission control, not a file browser.

## Architecture: Widget Registry, Not a Fixed Page List
The dashboard is a widget registry, not a hardcoded page list, so it scales to workspaces with different active modules without per-workspace UI branching. Each widget declares which `workspace.json` module flag(s) activate it (see `19_PLUGIN_ARCHITECTURE.md`). The shell renders whichever widgets are active for the currently selected workspace; a workspace with a module turned off simply never shows that widget.

## Widgets

| Widget | Gated by | Data source |
|---|---|---|
| Workspace Overview | always on | file counts, module summary |
| Asset Library | `assetManagement` | files + classifications |
| Timeline | `assetManagement` | timeline events |
| Knowledge Graph | `assetManagement` | relationships |
| Trademark Readiness | `trademarkReadinessReport` | latest report of that type |
| Priority of Use | `priorityOfUseDossier` | latest report of that type |
| Case Builder | `caseBuilder` | cases, case links |
| Evidence Gaps | `caseBuilder` or report-driven | case missing-evidence + report gap sections |
| Needs Review | always on, shown when non-empty | review queue |
| Logo Evolution | `assetManagement` + brand-type workspace | relationships filtered to logo category |
| Customer Timeline | `assetManagement` | timeline events filtered by type |
| Product Timeline | `assetManagement` | timeline events filtered by type |
| Instagram Timeline | `instagram` | importer-populated timeline events |
| Printful Timeline | `printful` | importer-populated timeline events |
| Reports | always on | reports table |
| Exports | always on | export job history |
| Duplicate Detection | always on | duplicate groups |
| Hash Verification | always on | re-hash-on-demand job status |
| Plugin Status | always on | active plugin list per workspace |
| Obsidian Vault Status | `obsidian` | obsidian notes: count, last generated, drift/edit-conflict status (see `20_OBSIDIAN_INTEGRATION.md`) |

## Home Metrics (Workspace Overview widget)
- Total files scanned
- Files classified
- Files needing review
- Duplicate groups found
- Earliest evidence date
- Earliest commercial/public use date (where applicable)
- Report readiness scores (workspace-type dependent, e.g. trademark readiness for brand workspaces)

## Visuals
- Timeline cards
- Evidence score gauges
- File preview panel
- Relationship graph
- Missing evidence checklist
- Export package builder
