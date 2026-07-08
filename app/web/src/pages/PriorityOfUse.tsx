import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type PriorityOfUseData } from "../api";
import { StatusPill } from "../components/widgets";

/**
 * The chain (Timeline -> Evidence -> Relationships -> Supporting Assets ->
 * Confidence -> Reasoning -> Conflicts) is a real, meaningful sequence — each
 * step is the input to the next in how the Evidence Engine actually reasons
 * — so numbered steps here are justified, unlike a decorative 01/02/03.
 */
const CHAIN_STEPS = [
  "Timeline",
  "Evidence",
  "Relationships",
  "Supporting Assets",
  "Confidence",
  "Reasoning",
  "Conflicts",
];

export function PriorityOfUse() {
  const { workspaceId = "" } = useParams();
  const [data, setData] = useState<PriorityOfUseData | null>(null);

  useEffect(() => {
    api.priorityOfUse(workspaceId).then(setData);
  }, [workspaceId]);

  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Priority of Use</h1>
      </div>

      <div className="section">
        <div className="card" style={{ display: "flex", gap: 4, overflowX: "auto", padding: "12px 16px" }}>
          {CHAIN_STEPS.map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="pill mono">{i + 1}</span>
              <span style={{ fontSize: 12 }}>{step}</span>
              {i < CHAIN_STEPS.length - 1 && <span className="muted"> → </span>}
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Confidence</h3>
        <div className="card">
          {data.assessment ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>
                  {data.assessment.score}/100
                </span>
                <StatusPill status={data.assessment.status} />
              </div>
              <h3 className="section-title" style={{ marginTop: 16 }}>
                Reasoning
              </h3>
              <p className="muted">{data.assessment.notes}</p>
            </>
          ) : (
            <p className="muted">Priority of Use has not been assessed yet — run `npm run analyze` for this workspace.</p>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Conflicts &amp; Gaps ({data.gaps.length})</h3>
        {data.gaps.length === 0 ? (
          <div className="empty-state">No priority-of-use category gaps detected.</div>
        ) : (
          <div className="row-list">
            {data.gaps.map((g, i) => (
              <div key={i} className="row-list-item" style={{ cursor: "default" }}>
                <span className={`pill ${g.priority === "high" ? "conflict" : ""}`}>{g.priority}</span>
                <span>{g.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Supporting Assets ({data.supportingAssets.length})</h3>
        {data.supportingAssets.length === 0 ? (
          <div className="empty-state">No assets currently support a Priority of Use claim.</div>
        ) : (
          <div className="row-list">
            {data.supportingAssets.map((a) => (
              <div key={a.asset.assetId} className="row-list-item" style={{ cursor: "default" }}>
                <div style={{ flex: 1 }}>
                  <div>{a.asset.filename}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>
                    {a.asset.assetId}
                    {a.timelineEvents[0] && ` · ${a.timelineEvents[0].eventDate.slice(0, 10)}`}
                  </div>
                </div>
                {a.classification && <span className="pill">{a.classification.category}</span>}
                {a.relationships.length > 0 && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    {a.relationships.length} relationship(s)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
