import { Link } from "react-router-dom";
import type { ActionItem, ActivityEvent } from "../api";

export function MetricTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="metric-tile">
      <span className="label">{label}</span>
      <span className={`value mono${accent ? " accent" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * The signature element (see frontend design plan): a segmented bar showing
 * the real strong/weak/conflicting breakdown behind a confidence number,
 * not a generic single-color progress bar. Appears on Overview tiles, case
 * cards, and asset rows so the same visual language means the same thing
 * everywhere in the app.
 */
export function ConfidenceBar({ strong, weak, conflict }: { strong: number; weak: number; conflict: number }) {
  const total = strong + weak + conflict || 1;
  return (
    <div className="confidence-bar" role="img" aria-label={`${strong} strong, ${weak} weak, ${conflict} conflicting`}>
      <div className="seg-strong" style={{ width: `${(strong / total) * 100}%` }} />
      <div className="seg-weak" style={{ width: `${(weak / total) * 100}%` }} />
      <div className="seg-conflict" style={{ width: `${(conflict / total) * 100}%` }} />
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "strong" ? "strong" : status === "conflicting" ? "conflict" : status === "weak" ? "weak" : "";
  return <span className={`pill ${cls}`}>{status}</span>;
}

/** Top-of-hierarchy metric — larger, used for the 5 highest-priority signals only (Section 1). */
export function HeroMetric({ label, value, sublabel, tone }: { label: string; value: string | number; sublabel?: string; tone?: "high" | "normal" | "weak" }) {
  return (
    <div className={`hero-metric${tone ? ` tone-${tone}` : ""}`}>
      <span className="hero-label">{label}</span>
      <span className="hero-value mono">{value}</span>
      {sublabel && <span className="hero-sublabel">{sublabel}</span>}
    </div>
  );
}

export function ActionCenter({ items, workspaceId }: { items: ActionItem[]; workspaceId: string }) {
  if (items.length === 0) {
    return <div className="empty-state">Nothing needs attention right now.</div>;
  }
  return (
    <div className="row-list">
      {items.map((item) => (
        <Link key={item.id} to={`/w/${workspaceId}/${item.href}`} className="row-list-item">
          <span className={`pill ${item.severity === "high" ? "conflict" : item.severity === "normal" ? "weak" : ""}`}>
            {item.severity}
          </span>
          <span style={{ flex: 1 }}>{item.label}</span>
          <span className="muted">→</span>
        </Link>
      ))}
    </div>
  );
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <div className="empty-state">No activity recorded yet.</div>;
  }
  return (
    <div className="activity-feed">
      {events.map((e, i) => (
        <div key={i} className="activity-item">
          <span className="mono muted activity-time">{formatRelative(e.timestamp)}</span>
          <span>{e.description}</span>
        </div>
      ))}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
