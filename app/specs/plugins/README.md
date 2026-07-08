# Plugin Specs

Specs in this folder describe **plugins**, not core platform requirements (see `app/specs/19_PLUGIN_ARCHITECTURE.md`). Each plugin activates only for workspaces whose `workspace.json` `modules` flags match the plugin's `activatesOn` list. A workspace that doesn't enable a plugin's module gets none of that plugin's code, data, or dashboard widgets.

| Plugin | Type | Activates on | Relocated from |
|---|---|---|---|
| `report-priority-of-use.md` | ReportTemplate | `priorityOfUseDossier` | `09_PRIORITY_OF_USE_DOSSIER.md` |
| `report-trademark-readiness.md` | ReportTemplate | `trademarkReadinessReport` | `10_TRADEMARK_READINESS_REPORT.md` |
| `importer-instagram.md` | Importer | `instagram` | `12_INSTAGRAM_ARCHIVE.md` |
| `importer-printful.md` | Importer | `printful` | `13_PRINTFUL_IMPORTER.md` |
| `classifier-apparel-brand.md` | Classifier | `assetManagement` (brand-type workspace) | extracted from `05_CLASSIFICATION_ENGINE.md` |

Fatletic is the first (and currently only) workspace with all five of these active. A future non-brand workspace (e.g. a personal knowledge vault) would have none of them active by default.
