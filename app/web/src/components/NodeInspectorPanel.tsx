import { Link } from "react-router-dom";
import type { NodeDetail } from "../api";

/**
 * Phase 9 Section 5 — everything selecting a node should reveal. A pure
 * rendering of whatever getNodeDetail() (core/services/graph-engine/
 * node-inspector.ts) already composed; this component computes nothing.
 */
export function NodeInspectorPanel({ workspaceId, detail, onClose }: { workspaceId: string; detail: NodeDetail | null; onClose: () => void }) {
  if (!detail) {
    return (
      <div className="inspector-panel">
        <div className="empty-state">Select a node to inspect it.</div>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="pill">{detail.type}</span>
          <h3>{detail.label}</h3>
        </div>
        <button className="pill" onClick={onClose} style={{ cursor: "pointer", border: "none" }}>
          ✕
        </button>
      </div>

      {detail.assetId && (
        <div className="inspector-field">
          <div className="inspector-field-label">Asset ID</div>
          <span className="mono">{detail.assetId}</span>
          {" · "}
          <Link to={`/w/${workspaceId}/assets/${detail.assetId}`} className="mono" style={{ fontSize: 11 }}>
            open in Asset Detail →
          </Link>
        </div>
      )}

      <div className="inspector-field">
        <div className="inspector-field-label">Summary</div>
        <p style={{ margin: 0, fontSize: 12 }}>{detail.summary}</p>
      </div>

      {detail.confidence !== undefined && detail.confidence !== null && (
        <div className="inspector-field">
          <div className="inspector-field-label">Confidence</div>
          <span className="mono">{detail.confidence}/100</span>
        </div>
      )}

      {detail.metadata && detail.metadata.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Metadata</div>
          <div className="row-list">
            {detail.metadata.map((m, i) => (
              <div key={i} className="row-list-item" style={{ cursor: "default", fontSize: 11 }}>
                <span className="mono muted" style={{ width: 100 }}>
                  {m.key}
                </span>
                <span className="mono">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.timeline && detail.timeline.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Timeline ({detail.timeline.length})</div>
          <div className="row-list">
            {detail.timeline.slice(0, 8).map((t) => (
              <div key={t.id} className="row-list-item" style={{ cursor: "default", fontSize: 11 }}>
                <span className="mono muted" style={{ width: 90 }}>
                  {t.eventDate?.slice(0, 10)}
                </span>
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.relationships && detail.relationships.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Relationships</div>
          <div className="row-list">
            {detail.relationships.map((r, i) => (
              <div key={i} className="row-list-item" style={{ cursor: "default", fontSize: 11 }}>
                {r.direction === "outgoing" ? "→" : "←"} asset #{r.otherAssetId} ({r.type}, {r.confidence})
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.evidence && detail.evidence.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Evidence</div>
          <div className="row-list">
            {detail.evidence.map((e, i) => (
              <div key={i} className="row-list-item" style={{ cursor: "default", fontSize: 11 }}>
                {e.dimension}: {e.score}/100 ({e.status})
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.provenance && detail.provenance.length > 1 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Provenance</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {detail.provenance.map((p, i) => (
              <span key={i} className="pill" style={{ fontSize: 10 }}>
                {p.assetLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {detail.supportingAssets && detail.supportingAssets.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Supporting Assets ({detail.supportingAssets.length})</div>
          <div className="row-list">
            {detail.supportingAssets.slice(0, 8).map((a) => (
              <Link key={a.assetId} to={`/w/${workspaceId}/assets/${a.assetId}`} className="row-list-item mono" style={{ fontSize: 11 }}>
                {a.assetId}
              </Link>
            ))}
          </div>
        </div>
      )}

      {detail.cases && detail.cases.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Cases</div>
          <div className="row-list">
            {detail.cases.map((c) => (
              <Link key={c.id} to={`/w/${workspaceId}/cases/${c.id}`} className="row-list-item" style={{ fontSize: 11 }}>
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {detail.reports && detail.reports.length > 0 && (
        <div className="inspector-field">
          <div className="inspector-field-label">Reports</div>
          <div className="row-list">
            {detail.reports.map((r) => (
              <div key={r.id} className="row-list-item" style={{ cursor: "default", fontSize: 11 }}>
                {r.reportType}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.obsidianNotePath && (
        <div className="inspector-field">
          <div className="inspector-field-label">Obsidian Note</div>
          <span className="mono" style={{ fontSize: 11 }}>
            {detail.obsidianNotePath}
          </span>
        </div>
      )}
    </div>
  );
}
