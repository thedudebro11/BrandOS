import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type OverviewData, type ActionItem, type ActivityEvent } from "../api";
import { MetricTile, HeroMetric, ActionCenter, ActivityFeed } from "../components/widgets";

/**
 * Layout follows the specified priority tiers (Phase 4.5 Section 1):
 * hero (Trademark Readiness, Priority of Use, Needs Review, Workspace
 * Status, Evidence Quality) rendered large; mid tier (Timeline,
 * Relationships, Cases, Recent Activity) at normal weight; low tier
 * (Architecture Health, Duplicates, technical metrics) small and quiet at
 * the bottom. Every value still comes straight from the API — this file
 * only arranges, it never computes.
 */
export function Overview() {
  const { workspaceId = "" } = useParams();
  const [data, setData] = useState<OverviewData | null>(null);
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    api.overview(workspaceId).then(setData);
    api.actionCenter(workspaceId).then((r) => setActions(r.items));
    api.activity(workspaceId, 12).then((r) => setActivity(r.events));
  }, [workspaceId]);

  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{data.workspace.name}</h1>
        <span className="muted mono" style={{ fontSize: 12 }}>
          {data.workspace.status}
        </span>
      </div>

      {/* Highest priority */}
      <div className="section">
        <div className="hero-grid">
          <HeroMetric label="Trademark Readiness" value={capitalize(data.trademarkReadiness)} tone="weak" />
          <HeroMetric
            label="Priority of Use"
            value={data.priorityOfUse ? `${data.priorityOfUse.score}/100` : "No data"}
            sublabel={data.priorityOfUse ? capitalize(data.priorityOfUse.status) : undefined}
            tone={data.priorityOfUse?.status === "weak" ? "high" : "normal"}
          />
          <HeroMetric
            label="Needs Review"
            value={data.needsReview.count}
            sublabel={`${data.needsReview.percent}% of assets`}
            tone={data.needsReview.count > 0 ? "high" : "normal"}
          />
          <HeroMetric label="Workspace Status" value={capitalize(data.workspace.status)} />
          <HeroMetric label="Evidence Quality" value={data.evidenceQuality.label} sublabel={`${data.evidenceQuality.coverage}% coverage`} />
        </div>
      </div>

      {/* Action Center */}
      <div className="section">
        <h3 className="section-title">What needs attention</h3>
        {actions ? <ActionCenter items={actions} workspaceId={workspaceId} /> : <div className="muted">Loading…</div>}
      </div>

      {/* Medium priority */}
      <div className="section">
        <div className="tile-grid">
          <MetricTile label="Timeline Completeness" value={`${data.timelineCompleteness}%`} />
          <MetricTile label="Relationship Coverage" value={`${data.relationshipCoverage}%`} />
          <MetricTile label="Cases" value={data.casesCount} />
          <MetricTile label="Health" value={`${data.health}%`} accent />
        </div>
      </div>

      {/* Medium priority: activity feed */}
      <div className="section">
        <h3 className="section-title">Recent Activity</h3>
        <div className="card">{activity ? <ActivityFeed events={activity} /> : <div className="muted">Loading…</div>}</div>
      </div>

      {/* Lower priority — small, quiet, at the bottom */}
      <div className="section">
        <h3 className="section-title">Technical Metrics</h3>
        <div className="tile-grid" style={{ opacity: 0.85 }}>
          <MetricTile label="Duplicate Groups" value={data.duplicateGroups} />
          <MetricTile label="Architecture Health" value={`${data.architectureHealth.score}%`} />
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
          Architecture Health reflects Phase {data.architectureHealth.phase} ({data.architectureHealth.phaseName}) as of{" "}
          {data.architectureHealth.asOf}.
        </p>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
