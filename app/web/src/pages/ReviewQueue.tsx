import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ReviewQueueEntry } from "../api";

export function ReviewQueue() {
  const { workspaceId = "" } = useParams();
  const [entries, setEntries] = useState<ReviewQueueEntry[] | null>(null);

  useEffect(() => {
    api.reviewQueue(workspaceId).then((r) => setEntries(r.entries));
  }, [workspaceId]);

  if (!entries) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Needs Review</h1>
        <span className="muted mono" style={{ fontSize: 12 }}>
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">Nothing needs review right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => (
            <div key={e.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Link to={`/w/${workspaceId}/assets/${e.asset?.asset_id}`} style={{ fontWeight: 500 }}>
                  {e.asset?.filename ?? "Unknown asset"}
                </Link>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  confidence {e.confidence}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                {e.reason}
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
                <span>
                  <span className="muted">Suggested action: </span>
                  {e.suggested_action}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span className="pill">effort: {e.estimated_effort}</span>
                <span className="pill">impact: {e.potential_impact}</span>
              </div>
              {e.possible_classifications_detail && (
                <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>
                  {e.possible_classifications_detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
