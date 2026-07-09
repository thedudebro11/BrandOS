import type { WorkspaceDatabase } from "../../db/connection";
import {
  addCaseMissingEvidence,
  createCase,
  getCase,
  linkToCase,
  listCaseLinks,
  listCasesForAsset,
  listCaseTemplates,
  unlinkFromCase,
} from "../../db/knowledge-repositories";
import { assessCaseEvidence } from "../evidence-engine/evidence-engine";
import type { CaseLinkedType, CaseRecord } from "../../types";

/**
 * Cases are collections of references — never duplicated assets
 * (ARCHITECTURE_PRINCIPLES.md #2, #8). Every link row points at an existing
 * Asset ID, timeline event id, report id, or note id; deleting a case only
 * ever deletes case_links rows, never the things they point to.
 */
export class CaseBuilderService {
  constructor(private db: WorkspaceDatabase) {}

  listTemplates() {
    return listCaseTemplates(this.db);
  }

  createFromTemplate(templateKey: string, titleOverride?: string): CaseRecord {
    const template = this.listTemplates().find((t) => t.templateKey === templateKey);
    if (!template) {
      throw new Error(`Unknown case template "${templateKey}". Known templates: ${this.listTemplates().map((t) => t.templateKey).join(", ")}`);
    }
    return createCase(this.db, titleOverride ?? template.title, template.defaultCaseType, template.description);
  }

  createCustom(title: string, caseType: string, purpose: string | null): CaseRecord {
    return createCase(this.db, title, caseType, purpose);
  }

  get(caseId: number): CaseRecord | undefined {
    return getCase(this.db, caseId);
  }

  linkAsset(caseId: number, assetId: number, note?: string): void {
    this.link(caseId, "asset", assetId, note);
  }

  linkTimelineEvent(caseId: number, timelineEventId: number, note?: string): void {
    this.link(caseId, "timeline_event", timelineEventId, note);
  }

  /** Phase 8: cases can reference generated reports — case_links.linked_type "report" has existed since Phase 3's schema; this is the first phase to actually produce report rows to link. linkedId is a `reports.id`. */
  linkReport(caseId: number, reportId: number, note?: string): void {
    this.link(caseId, "report", reportId, note);
  }

  private link(caseId: number, type: CaseLinkedType, id: number, note?: string): void {
    if (!this.get(caseId)) throw new Error(`Case ${caseId} does not exist`);
    linkToCase(this.db, caseId, type, id, note ?? null);
  }

  unlink(caseLinkId: number): void {
    unlinkFromCase(this.db, caseLinkId);
  }

  listLinks(caseId: number) {
    return listCaseLinks(this.db, caseId);
  }

  casesForAsset(assetId: number): CaseRecord[] {
    return listCasesForAsset(this.db, assetId);
  }

  flagMissingEvidence(caseId: number, description: string, priority = "normal"): void {
    addCaseMissingEvidence(this.db, caseId, description, priority);
  }

  /** Recomputes and stores this case's evidence-strength assessment (delegates to the Evidence Engine — no separate scoring logic here). */
  recomputeEvidenceStrength(caseId: number): void {
    assessCaseEvidence(this.db, caseId);
  }

  /**
   * Browse candidates for an empty case, grouped by tag — deliberately NOT a
   * claim that these assets support the case. It surfaces counts of unlinked
   * evidence a human hasn't reviewed yet, framed as "here's what's available
   * to look at," never "here's what supports this case" (ARCHITECTURE_PRINCIPLES.md
   * #4, never invent facts). Linking remains an explicit human action via
   * linkAsset(), never automatic.
   */
  suggestUnlinkedEvidence(caseId: number): { tagName: string; count: number }[] {
    const linkedAssetIds = new Set(
      this.listLinks(caseId)
        .filter((l) => l.linkedType === "asset")
        .map((l) => l.linkedId)
    );
    const rows = this.db.all<{ name: string; asset_id: number }>(
      `SELECT t.name, at.asset_id FROM asset_tags at JOIN tags t ON t.id = at.tag_id
       JOIN assets a ON a.id = at.asset_id WHERE a.status = 'active'`
    );
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (linkedAssetIds.has(r.asset_id)) continue;
      counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tagName, count]) => ({ tagName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }
}
