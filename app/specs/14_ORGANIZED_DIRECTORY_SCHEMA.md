# Organized Directory Schema

## Template
Every workspace's generated archive follows the same schema, rooted under that workspace's own folder — never a literal brand name in the template itself:

```text
workspaces/<workspace_id>/<workspace_id>_Archive/
  00_README/
  01_MASTER_INDEX/
  02_PRIORITY_OF_USE_DOSSIER/        (only if priorityOfUseDossier module active)
  03_TRADEMARK_READINESS/            (only if trademarkReadinessReport module active)
  04_FIRST_USE_EVIDENCE/
  05_LOGOS_AND_BRAND_IDENTITY/       (only if assetManagement module active)
  06_DESIGN_SOURCE_FILES/
  07_PRODUCT_MOCKUPS/
  08_PRINTFUL_AND_SALES/             (only if printful module active)
  09_CUSTOMER_EVIDENCE/
  10_SOCIAL_MEDIA_ARCHIVE/           (only if instagram or other social module active)
  11_MARKETING_MATERIALS/
  12_PACKAGING_AND_STICKERS/
  13_WEBSITE_AND_DOMAINS/
  14_LEGAL_AND_TRADEMARK_RESEARCH/   (only if trademark or copyright module active)
  15_EXPORTS/
  16_NEEDS_REVIEW/
  17_ORIGINAL_FILE_HASHES/
```

Numbered folders whose module is inactive for a given workspace are simply omitted, not left empty — the schema is a superset, not a fixed structure every workspace must fully populate.

## Example: Fatletic
```text
workspaces/Fatletic/Fatletic_Archive/
  00_README/
  01_MASTER_INDEX/
  02_PRIORITY_OF_USE_DOSSIER/
  03_TRADEMARK_READINESS/
  ...
```

## Rule
The original source directory (the raw evidence tree at `workspaces/<workspace_id>/`, outside the generated `<workspace_id>_Archive/` folder) remains untouched. The organized archive is a generated, additive view — never a move or rename of originals.
