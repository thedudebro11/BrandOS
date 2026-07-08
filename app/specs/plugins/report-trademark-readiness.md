# Plugin: report-trademark-readiness

**Type:** ReportTemplate
**Activates on:** `workspace.json` → `modules.trademarkReadinessReport = true`
**Relocated from:** `app/specs/10_TRADEMARK_READINESS_REPORT.md`

## Purpose
Assess whether a workspace's archive is ready to support a federal trademark application and possible priority dispute for its primary mark. For Fatletic: FATLETIC, goods/services Class 25 (clothing/apparel).

## Sections
- Brand name reviewed (from `importantMarks.primaryMark`)
- Goods/services and class
- Common law evidence summary
- Federal filing readiness
- Specimen readiness
- First use evidence
- First use in commerce evidence
- Continuous use evidence
- Social proof
- Customer proof
- Sales proof
- Similar mark watchlist (from `importantMarks.relatedOrConflictingMarks`, e.g. FATLETE for Fatletic)
- Risk factors
- Evidence gaps
- Recommended next actions

## Scoring
- Trademark Evidence Completeness: 0-100
- First Use Confidence: 0-100
- Commerce Proof Confidence: 0-100
- Continuous Use Confidence: 0-100
- Specimen Quality: 0-100
- Attorney Review Recommended: Yes/No/Conditional

## Citation Rule
Every citation references a file by safe asset ID and hash, never by raw original filename — see `app/specs/21_FILENAME_SANITIZATION.md`.

## Output
- `TRADEMARK_READINESS_REPORT.md`
- `TRADEMARK_READINESS_REPORT.pdf`
