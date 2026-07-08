import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type AssetIntelligence } from "../api";

/**
 * The "knowledge navigation" panel (Phase 4.5 Section 8): a relationship
 * chain for one asset, rendered as a panel — not a graph visualization
 * (explicitly out of scope). Every field is straight from
 * getAssetIntelligence(); this page composes, it doesn't compute.
 */
export function AssetDetail() {
  const { workspaceId = "", assetId = "" } = useParams();
  const [data, setData] = useState<AssetIntelligence | null>(null);

  useEffect(() => {
    api.asset(workspaceId, assetId).then(setData);
  }, [workspaceId, assetId]);

  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="muted mono" style={{ fontSize: 12 }}>
            {data.asset.assetId}
          </span>
          <h1 style={{ marginTop: 4 }}>{data.asset.filename}</h1>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Classification &amp; Tags</h3>
        <div className="card">
          {data.classification ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="pill">{data.classification.category}</span>
              <span className="mono muted" style={{ fontSize: 12 }}>
                confidence {data.classification.confidence}
              </span>
            </div>
          ) : (
            <p className="muted">Not classified.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.tags.map((t) => (
              <span key={t.tagName} className="pill">
                {t.tagName}
              </span>
            ))}
          </div>
          {data.classification && (
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              {data.classification.reason}
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Knowledge Navigation</h3>
        <div className="card">
          {data.provenance.length <= 1 ? (
            <p className="muted">No relationships — this asset has no upstream source or downstream export detected.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {data.provenance.map((step, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className={`pill${step.direction === "self" ? " strong" : ""}`}
                    title={step.relationshipType ?? undefined}
                  >
                    {step.assetLabel}
                  </span>
                  {i < data.provenance.length - 1 && <span className="muted">→</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Timeline</h3>
        {data.timelineEvents.length === 0 ? (
          <div className="empty-state">No timeline events for this asset.</div>
        ) : (
          <div className="row-list">
            {data.timelineEvents.map((t) => (
              <div key={t.id} className="row-list-item" style={{ cursor: "default" }}>
                <span className="mono muted" style={{ fontSize: 11, width: 90 }}>
                  {t.eventDate.slice(0, 10)}
                </span>
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Metadata</h3>
        {data.metadata.length === 0 ? (
          <div className="empty-state">No extracted metadata.</div>
        ) : (
          <div className="row-list">
            {data.metadata.map((m, i) => (
              <div key={i} className="row-list-item" style={{ cursor: "default" }}>
                <span className="mono muted" style={{ width: 140, fontSize: 11 }}>
                  {m.key}
                </span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Linked Cases</h3>
        {data.linkedCases.length === 0 ? (
          <div className="empty-state">Not linked to any case yet.</div>
        ) : (
          <div className="row-list">
            {data.linkedCases.map((c) => (
              <Link key={c.id} to={`/w/${workspaceId}/cases/${c.id}`} className="row-list-item">
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Hash &amp; Provenance</h3>
        <div className="card">
          <p className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
            {data.asset.sha256}
          </p>
          <p className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>
            {data.asset.originalPath}
          </p>
        </div>
      </div>
    </div>
  );
}
