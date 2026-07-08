import path from "node:path";
import { getWorkspace } from "../core/workspace/workspace-registry";
import { WorkspaceDatabase } from "../core/db/connection";
import { WorkspaceFs } from "../core/fs/workspace-fs";
import { CaseBuilderService } from "../core/services/case-builder/case-builder-service";
import { listCases } from "../core/db/knowledge-repositories";

const WORKSPACES_ROOT = path.resolve(__dirname, "../../../workspaces");

// Fatletic's initial cases, named back in Phase 0/3's spec work. Seeded here
// as empty shells (title/type/purpose only) — no assets are auto-linked.
// Auto-linking evidence to a named legal case would be a much stronger claim
// than tagging a photo "Product Photo," and nothing has reviewed that
// linkage yet, so each case starts honestly empty (see ARCHITECTURE_PRINCIPLES.md #4).
const FATLETIC_CASES: { templateKey: string; title: string }[] = [
  { templateKey: "trademark_registration", title: "FATLETIC Trademark Registration" },
  { templateKey: "priority_of_use", title: "Priority of Use Dossier" },
  { templateKey: "trademark_opposition", title: "FATLETE Comparison" },
  { templateKey: "historical_timeline", title: "Brand History Archive" },
  { templateKey: "media_kit", title: "Media Kit" },
];

async function main() {
  const workspaceId = process.argv[2] ?? "fatletic";
  const workspace = getWorkspace(WORKSPACES_ROOT, workspaceId);
  const wfs = new WorkspaceFs(workspace);
  const db = await WorkspaceDatabase.open(wfs.dbPath());

  const existingTitles = new Set(listCases(db).map((c) => c.title));
  const service = new CaseBuilderService(db);
  let created = 0;

  for (const spec of FATLETIC_CASES) {
    if (existingTitles.has(spec.title)) {
      console.log(`Skipping "${spec.title}" — already exists.`);
      continue;
    }
    const c = service.createFromTemplate(spec.templateKey, spec.title);
    console.log(`Created ${c.caseKey}: ${c.title}`);
    created++;
  }

  db.close();
  console.log(`\n${created} case(s) created, ${FATLETIC_CASES.length - created} already existed.`);
}

main().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
