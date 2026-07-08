# Plugin: report-priority-of-use

**Type:** ReportTemplate
**Activates on:** `workspace.json` → `modules.priorityOfUseDossier = true`
**Relocated from:** `app/specs/09_PRIORITY_OF_USE_DOSSIER.md`

## Purpose
Create a neutral, evidence-backed dossier showing the earliest documented use of a workspace's primary mark (`workspace.json` → `importantMarks.primaryMark`). For Fatletic, the mark is FATLETIC.

## Must Include
1. Executive Summary
2. Earliest Known Brand Creation Evidence
3. Earliest Logo/Design Evidence
4. Earliest Product/Mockup Evidence
5. Earliest Printful Order Evidence (if `printful` module active; otherwise earliest commercial-order evidence generally)
6. Earliest Shipment Evidence
7. Earliest Sale Evidence
8. Earliest Instagram/Public Marketing Evidence (if `instagram` module active; otherwise earliest public marketing evidence generally)
9. Earliest Customer/Public Use Evidence
10. Continuous Use Evidence
11. Evidence Strengths
12. Evidence Gaps
13. Potential Conflicts or Weaknesses (workspace's `importantMarks.relatedOrConflictingMarks`, e.g. FATLETE for Fatletic)
14. File Citation Index

## Important Language
Do not say "we deserve the trademark" as a conclusion. Instead say:
"The evidence currently supports/does not support the following factual claims..."

## Citation Rule
Every citation references a file by safe asset ID and hash, never by raw original filename — see `app/specs/21_FILENAME_SANITIZATION.md`. The File Citation Index maps safe asset IDs to full traceability details for attorney/authorized use only; it is not embedded in the client-facing narrative sections.

## Output
- `Priority_of_Use_Dossier.md`
- `Priority_of_Use_Dossier.pdf`
- `Supporting_Evidence_Index.csv`
