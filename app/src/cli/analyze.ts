import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { assessWorkspaceEvidence } from "../core/services/evidence-engine/evidence-engine";
import { runDataHealthCheck } from "../core/services/data-health-engine/data-health-engine";
import { validateKnowledge } from "../core/services/knowledge-validation-engine/knowledge-validation-engine";
import { computeEvidenceQualityMetrics } from "../core/services/evidence-quality-metrics/evidence-quality-metrics";
import { latestEvidenceAssessments, listEvidenceGaps, listClassifications } from "../core/db/knowledge-repositories";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

async function main() {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error("Usage: npm run analyze -- <workspaceId>");
    process.exit(1);
  }

  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());

  console.log(`Analyzing workspace "${workspace.config.name}" (${workspace.config.id})...\n`);

  assessWorkspaceEvidence(db);
  const issues = runDataHealthCheck(db);
  const validation = validateKnowledge(db);
  const metrics = computeEvidenceQualityMetrics(db);
  db.save();

  const classifications = listClassifications(db);
  const byCategory = new Map<string, number>();
  for (const c of classifications) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);

  console.log("--- Classification Summary ---");
  for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${category}: ${count}`);
  }

  console.log("\n--- Evidence Assessment (workspace-wide) ---");
  for (const a of latestEvidenceAssessments(db, "workspace", null)) {
    console.log(`${a.dimension}: ${a.score}/100 (${a.status}) — ${a.notes}`);
  }

  const gaps = listEvidenceGaps(db, "workspace", null);
  console.log(`\n--- Evidence Gaps (${gaps.length}) ---`);
  for (const g of gaps) console.log(`[${g.priority}] ${g.gapType}: ${g.description}`);

  console.log(`\n--- Data Health Check (${issues.length} finding(s)) ---`);
  const bySeverity = new Map<string, number>();
  for (const i of issues) bySeverity.set(i.severity, (bySeverity.get(i.severity) ?? 0) + 1);
  for (const [sev, count] of bySeverity) console.log(`${sev}: ${count}`);
  for (const i of issues.filter((i) => i.severity === "critical")) {
    console.log(`  CRITICAL [${i.findingType}]: ${i.description}`);
  }

  console.log(`\n--- Knowledge Validation (${validation.filter((v) => v.passed).length}/${validation.length} passed) ---`);
  for (const v of validation) {
    console.log(`${v.passed ? "PASS" : "FAIL"} ${v.checkName}: ${v.details}`);
  }

  console.log("\n--- Evidence Quality Metrics ---");
  console.log(`Timeline completeness:       ${metrics.timelineCompleteness}%`);
  console.log(`Metadata completeness:       ${metrics.metadataCompleteness}%`);
  console.log(`Relationship completeness:   ${metrics.relationshipCompleteness}%`);
  console.log(`Classification completeness: ${metrics.classificationCompleteness}%`);
  console.log(`Needs review:                ${metrics.needsReviewPercent}%`);
  console.log(`Duplicate coverage:          ${metrics.duplicateCoverage}%`);
  console.log(`Evidence coverage:           ${metrics.evidenceCoverage}%`);
  console.log(`Provenance coverage:         ${metrics.provenanceCoverage}%`);
  console.log(`Health score:                ${metrics.healthScore}/100`);
  console.log(`Missing evidence score:      ${metrics.missingEvidenceScore}%`);
  console.log(`Conflicting evidence score:  ${metrics.conflictingEvidenceScore}%`);
  console.log(`Confidence distribution:     ${metrics.confidenceDistribution.map((b) => `${b.band}=${b.count}`).join(", ")}`);

  db.close();
}

main().catch((err) => {
  console.error("Analyze failed:", err.message);
  process.exit(1);
});
