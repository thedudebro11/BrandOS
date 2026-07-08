import type { WorkspaceDatabase } from "../../db/connection";
import { getCandidateDates, getDateSourcePriorities, upsertResolvedDate } from "../../db/knowledge-repositories";
import type { CandidateDateRecord, RejectedAlternative, ResolvedDateRecord } from "../../types";

const CORROBORATION_TOLERANCE_MS = 1000 * 60 * 60 * 24 * 7; // within 7 days counts as agreeing
const CONFLICT_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 30; // more than 30 days apart counts as conflicting

/**
 * Picks the single best-supported date for an asset from every candidate
 * collected so far, using the configured priority order among *plausible*
 * candidates only (System 3), and produces a fully explained result (System
 * 2/11): what was chosen, why, what else existed, and why those were
 * rejected. Never silently picks a date — if nothing plausible exists, no
 * resolved_dates row is written at all rather than fabricating a guess.
 */
export function resolveAssetDate(db: WorkspaceDatabase, assetId: number): ResolvedDateRecord | undefined {
  const candidates = getCandidateDates(db, assetId);
  if (candidates.length === 0) return undefined;

  const priorities = getDateSourcePriorities(db);
  const priorityByType = new Map(priorities.map((p) => [p.sourceType, p]));

  const plausible = candidates.filter((c) => c.isPlausible);
  const implausible = candidates.filter((c) => !c.isPlausible);

  const rejected: RejectedAlternative[] = implausible.map((c) => ({
    sourceType: c.sourceType,
    dateValue: c.dateValue,
    reasonRejected: c.implausibilityReason ?? "Marked implausible",
  }));

  if (plausible.length === 0) {
    // Nothing usable — every candidate was implausible. Do not resolve a
    // fake date; clear any stale prior resolution (e.g. from before a
    // candidate was reclassified as implausible) so this asset shows up
    // honestly in evidence-quality metrics as unresolved, not stuck with an
    // outdated answer.
    db.run("DELETE FROM resolved_dates WHERE asset_id = ?", [assetId]);
    return undefined;
  }

  const ranked = [...plausible].sort((a, b) => {
    const pa = priorityByType.get(a.sourceType)?.priorityRank ?? 999;
    const pb = priorityByType.get(b.sourceType)?.priorityRank ?? 999;
    if (pa !== pb) return pa - pb;
    return a.id - b.id; // stable tie-break: earliest-recorded candidate wins
  });

  const winner = ranked[0];
  const winnerPriority = priorityByType.get(winner.sourceType);
  const winnerTime = new Date(winner.dateValue).getTime();

  let corroboratingCount = 0;
  const conflicting: CandidateDateRecord[] = [];
  for (const c of plausible) {
    if (c.id === winner.id) continue;
    const diff = Math.abs(new Date(c.dateValue).getTime() - winnerTime);
    if (diff <= CORROBORATION_TOLERANCE_MS) corroboratingCount++;
    else if (diff >= CONFLICT_THRESHOLD_MS) conflicting.push(c);

    rejected.push({
      sourceType: c.sourceType,
      dateValue: c.dateValue,
      reasonRejected: `Lower priority than "${winner.sourceType}" (rank ${winnerPriority?.priorityRank ?? "?"} beats rank ${
        priorityByType.get(c.sourceType)?.priorityRank ?? "?"
      })${diff >= CONFLICT_THRESHOLD_MS ? " — NOTE: this candidate conflicts with the chosen date by more than 30 days" : ""}`,
    });
  }

  const baseReliability = winnerPriority?.reliabilityScore ?? 50;
  const confidence = Math.min(100, baseReliability + corroboratingCount * 5);

  const reasoningParts = [
    `Selected "${winner.sourceType}" (${winnerPriority?.tierLabel ?? "unranked tier"}, priority rank ${
      winnerPriority?.priorityRank ?? "?"
    }) as the highest-priority plausible candidate among ${plausible.length} plausible and ${implausible.length} implausible candidate(s).`,
    `Base reliability for this source: ${baseReliability}/100.`,
  ];
  if (corroboratingCount > 0) {
    reasoningParts.push(`${corroboratingCount} other plausible candidate(s) agree within 7 days, adding +${corroboratingCount * 5} confidence (capped at 100).`);
  }
  if (conflicting.length > 0) {
    reasoningParts.push(
      `${conflicting.length} plausible candidate(s) conflict by more than 30 days (${conflicting
        .map((c) => `${c.sourceType}: ${c.dateValue}`)
        .join("; ")}) — not used to adjust confidence, but recorded for human review.`
    );
  }

  return upsertResolvedDate(
    db,
    assetId,
    winner.dateValue,
    confidence,
    winner.sourceType,
    winner.id,
    reasoningParts.join(" "),
    rejected,
    corroboratingCount
  );
}
