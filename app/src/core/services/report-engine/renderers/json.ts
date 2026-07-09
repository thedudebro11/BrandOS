import type { ReportData } from "../report-types";

/** The JSON output is ReportData itself — no separate JSON-specific shape, so a consumer parsing this back gets exactly what generated the other three formats. */
export function renderJson(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}
