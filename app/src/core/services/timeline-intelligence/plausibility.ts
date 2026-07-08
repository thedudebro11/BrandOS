/**
 * Plausibility checking is the concrete architectural fix for the Phase 3
 * epoch-date finding: filesystem (and any other) candidate dates are checked
 * against sanity bounds before they're allowed to compete for resolution.
 * An implausible candidate is still stored (never discarded — see
 * recordCandidateDate) but is excluded from resolution and flagged with why.
 */
export function checkPlausibility(dateValue: string, now: Date = new Date()): { plausible: boolean; reason: string | null } {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return { plausible: false, reason: `"${dateValue}" does not parse as a valid date` };
  }

  const epochMs = new Date("1970-01-01T00:00:00.000Z").getTime();
  if (Math.abs(parsed.getTime() - epochMs) < 1000 * 60 * 60 * 48) {
    return {
      plausible: false,
      reason: "Within 48 hours of the Unix epoch (1970-01-01) — almost certainly an unpopulated/default timestamp, not a real date (see ARCHITECTURE_DECISIONS.md ADR-010).",
    };
  }

  const minPlausibleYear = 1990;
  if (parsed.getUTCFullYear() < minPlausibleYear) {
    return { plausible: false, reason: `Year ${parsed.getUTCFullYear()} is before ${minPlausibleYear}, treated as implausible for a digital business asset.` };
  }

  const oneDayMs = 1000 * 60 * 60 * 24;
  if (parsed.getTime() > now.getTime() + oneDayMs) {
    return { plausible: false, reason: `Date is in the future relative to now (${now.toISOString()}).` };
  }

  return { plausible: true, reason: null };
}
