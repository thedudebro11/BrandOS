import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CaseDetail as CaseDetailData } from "../api";
import { StatusPill, HeroMetric } from "../components/widgets";

export function CaseDetail() {
  const { workspaceId = "", caseId = "" } = useParams();
  const [data, setData] = useState<CaseDetailData | null>(null);
  const [suggestions, setSuggestions] = useState<{ tagName: string; count: number }[] | null>(null);

  useEffect(() => {
    api.caseDetail(workspaceId, Number(caseId)).then(setData);
    api.caseSuggestions(workspaceId, Number(caseId)).then((r) => setSuggestions(r.suggestions));
  }, [workspaceId, caseId]);

  if (!data) return <div className="muted">Loading…</div>;

  const readiness = data.evidenceOverview
    ? data.evidenceOverview.status === "strong"
      ? "Ready for review"
      : data.evidenceOverview.status === "weak"
        ? "Needs more evidence"
        : "Not started"
    : "Not started";

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to={`/w/${workspaceId}/cases`} className="muted" style={{ fontSize: 12 }}>
            ← Cases
          </Link>
          <h1 style={{ marginTop: 4 }}>{data.case.title}</h1>
        </div>
        <span className="muted mono" style={{ fontSize: 12 }}>
          {data.case.caseKey}
        </span>
      </div>

      <div className="section">
        <div className="hero-grid">
          <HeroMetric label="Status" value={data.case.status} />
          <HeroMetric label="Readiness" value={readiness} tone={data.evidenceOverview?.status === "weak" ? "high" : "normal"} />
          <HeroMetric
            label="Confidence"
            value={data.confidence !== null ? `${data.confidence}/100` : "—"}
            sublabel={data.evidenceOverview?.status}
          />
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Executive Summary</h3>
        <div className="card">
          <p>{data.executiveSummary.purpose ?? "No purpose recorded yet."}</p>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {data.executiveSummary.linkedAssetCount} linked asset(s) · {data.executiveSummary.linkedTimelineEventCount} timeline
            event(s)
          </p>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Evidence Overview</h3>
        <div className="card">
          {data.evidenceOverview ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                  {data.evidenceOverview.score}/100
                </span>
                <StatusPill status={data.evidenceOverview.status} />
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {data.evidenceOverview.notes}
              </p>
            </>
          ) : (
            <p className="muted">No evidence linked yet — nothing to assess.</p>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Supporting Assets ({data.supportingAssets.length})</h3>
        {data.supportingAssets.length === 0 ? (
          <div className="empty-state">
            <p>No evidence linked yet.</p>
            {suggestions && suggestions.length > 0 && (
              <div style={{ marginTop: 16, textAlign: "left" }}>
                <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Unlinked assets available to review, grouped by tag (these are candidates to look at — not a claim that
                  they support this case):
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestions.map((s) => (
                    <Link key={s.tagName} to={`/w/${workspaceId}/assets?tag=${encodeURIComponent(s.tagName)}`} className="pill">
                      {s.count} {s.tagName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="row-list">
            {data.supportingAssets.map((a) => (
              <Link key={a.asset.assetId} to={`/w/${workspaceId}/assets/${a.asset.assetId}`} className="row-list-item">
                <div style={{ flex: 1 }}>
                  <div>{a.asset.filename}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>
                    {a.asset.assetId}
                  </div>
                </div>
                {a.classification && <span className="pill">{a.classification.category}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Timeline ({data.timeline.length})</h3>
        {data.timeline.length === 0 ? (
          <div className="empty-state">No timeline events linked to this case yet.</div>
        ) : (
          <div className="row-list">
            {data.timeline.map((t: any) => (
              <div key={t.id} className="row-list-item" style={{ cursor: "default" }}>
                <span className="mono muted" style={{ fontSize: 11, width: 90 }}>
                  {String(t.event_date).slice(0, 10)}
                </span>
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Missing Evidence &amp; Risks</h3>
        {data.missingEvidence.length === 0 ? (
          <div className="empty-state">No missing-evidence items flagged.</div>
        ) : (
          <div className="row-list">
            {data.missingEvidence.map((m: any) => (
              <div key={m.id} className="row-list-item" style={{ cursor: "default" }}>
                <span className={`pill ${m.priority === "high" ? "conflict" : ""}`}>{m.priority}</span>
                <span>{m.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Conflicts</h3>
        {data.conflicts.length === 0 ? (
          <div className="empty-state">No date conflicts detected among linked assets.</div>
        ) : (
          <div className="row-list">
            {data.conflicts.map((a) => (
              <Link key={a.asset.assetId} to={`/w/${workspaceId}/assets/${a.asset.assetId}`} className="row-list-item">
                {a.asset.filename}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Related Cases</h3>
        {data.relatedCases.length === 0 ? (
          <div className="empty-state">No related cases (no shared evidence with another case yet).</div>
        ) : (
          <div className="row-list">
            {data.relatedCases.map((c) => (
              <Link key={c.id} to={`/w/${workspaceId}/cases/${c.id}`} className="row-list-item">
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Notes</h3>
        <div className="empty-state">Case-level notes aren't supported yet — asset-level notes exist via each Asset Detail page.</div>
      </div>

      <div className="section">
        <h3 className="section-title">Linked Documentation</h3>
        {data.linkedDocumentation.length === 0 ? (
          <div className="empty-state">No notes or reports linked yet.</div>
        ) : (
          <div className="row-list">
            {data.linkedDocumentation.map((d: any) => (
              <div key={d.id} className="row-list-item" style={{ cursor: "default" }}>
                {d.linkedType} #{d.linkedId}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Exports</h3>
        <div className="empty-state">Export packages (PDF, Attorney Review, ZIP) are planned for a future phase.</div>
      </div>

      <div className="section">
        <h3 className="section-title">Recent Changes</h3>
        <div className="card">
          <span className="muted">Case last updated: </span>
          <span className="mono">{new Date(data.recentChanges.caseUpdatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
