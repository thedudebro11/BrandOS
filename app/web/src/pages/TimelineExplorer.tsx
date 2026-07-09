import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type TimelineEntry, type TimelineExplorerData } from "../api";

/**
 * Phase 9 Section 2 — chronological navigation over resolved dates (Phase
 * 3.5), grouped by year, filterable by category/date range/confidence.
 * Every entry links to its Asset Detail page and to the Knowledge Graph
 * (Section 2's closing requirement: "every event should link back to the
 * knowledge graph"), both real navigations, not decoration.
 */
export function TimelineExplorer() {
  const { workspaceId = "" } = useParams();
  const [data, setData] = useState<TimelineExplorerData | null>(null);
  const [category, setCategory] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (minConfidence > 0) params.minConfidence = String(minConfidence);
    api.timeline(workspaceId, params).then(setData);
  }, [workspaceId, category, fromDate, toDate, minConfidence]);

  const grouped = useMemo(() => {
    if (!data) return new Map<string, TimelineEntry[]>();
    const map = new Map<string, TimelineEntry[]>();
    for (const e of data.entries) {
      if (!map.has(e.groupKey)) map.set(e.groupKey, []);
      map.get(e.groupKey)!.push(e);
    }
    return map;
  }, [data]);

  if (!data) return <div className="muted">Loading timeline…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Timeline Explorer</h1>
      </div>

      <div className="graph-toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="pill" style={{ cursor: "pointer" }}>
          <option value="">All categories</option>
          {data.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="pill" />
        <span className="muted">to</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="pill" />
        <label className="muted mono" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
          min confidence
          <input type="range" min={0} max={100} value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} />
          {minConfidence}
        </label>
        <span className="muted mono" style={{ fontSize: 11 }}>
          {data.entries.length} event(s)
        </span>
      </div>

      {data.entries.length === 0 ? (
        <div className="empty-state">No dated evidence matches these filters.</div>
      ) : (
        <div className="timeline-explorer-list">
          {Array.from(grouped.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([year, entries]) => (
              <div key={year}>
                <div className="timeline-explorer-group-header">
                  {year} — {entries.length} event(s)
                </div>
                {entries.map((e) => {
                  const key = `${e.assetId}-${e.resolvedDate}`;
                  const isExpanded = expanded.has(key);
                  return (
                    <div key={key} className="row-list-item" style={{ flexDirection: "column", alignItems: "stretch", cursor: "pointer" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                      >
                        <span className="mono muted" style={{ width: 90, fontSize: 11 }}>
                          {e.resolvedDate.slice(0, 10)}
                        </span>
                        <span className="pill" style={{ fontSize: 10 }}>
                          {e.category ?? "unclassified"}
                        </span>
                        <span style={{ flex: 1 }}>{e.filename}</span>
                        <span className="mono muted" style={{ fontSize: 11 }}>
                          confidence {e.confidence}
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "8px 4px 4px 100px", fontSize: 11 }}>
                          <p className="muted" style={{ margin: "0 0 6px" }}>
                            <strong>Source:</strong> {e.sourceType} — {e.reasoning}
                          </p>
                          <div style={{ display: "flex", gap: 10 }}>
                            <Link to={`/w/${workspaceId}/assets/${e.assetId}`} className="mono">
                              {e.assetId} — Asset Detail →
                            </Link>
                            <Link to={`/w/${workspaceId}/graph?focusType=asset&focusId=${e.assetNumericId}`} className="mono">
                              View in Knowledge Graph →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
