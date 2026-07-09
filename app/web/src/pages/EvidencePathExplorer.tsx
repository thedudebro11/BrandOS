import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type EvidenceTraceStep, type SearchResult } from "../api";

/**
 * Phase 9 Section 3 — traces one asset's full evidence path (relationships,
 * case links, evidence assessments, reports it feeds into), depth by depth.
 * A direct rendering of traceEvidencePath()'s breadth-first reachability
 * trace (core/services/graph-engine/evidence-path.ts) — every step here is
 * exactly one real, already-existing edge from the last, so the chain stays
 * traceable by construction, never a guess about what "should" connect.
 */
export function EvidencePathExplorer() {
  const { workspaceId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(searchParams.get("assetId"));
  const [steps, setSteps] = useState<EvidenceTraceStep[] | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setAssets([]);
      return;
    }
    api.search(workspaceId, query).then((r) => setAssets(r.results.filter((res) => res.entityType === "asset" && res.stringId).slice(0, 20)));
  }, [workspaceId, query]);

  useEffect(() => {
    if (!selectedAssetId) {
      setSteps(null);
      return;
    }
    api.asset(workspaceId, selectedAssetId).then((intel) => {
      api.evidencePath(workspaceId, "asset", intel.asset.id).then((r) => setSteps(r.steps));
    });
  }, [workspaceId, selectedAssetId]);

  const byDepth = new Map<number, EvidenceTraceStep[]>();
  if (steps) {
    for (const s of steps) {
      if (!byDepth.has(s.depth)) byDepth.set(s.depth, []);
      byDepth.get(s.depth)!.push(s);
    }
  }
  const maxDepth = steps ? Math.max(...steps.map((s) => s.depth)) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>Evidence Path Explorer</h1>
      </div>

      <div className="graph-toolbar">
        <input
          type="text"
          placeholder="Search for a starting asset…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!selectedAssetId ? (
        <div className="row-list">
          {assets.length === 0 ? (
            <div className="empty-state">Type to search for an asset to trace.</div>
          ) : (
            assets.map((a) => (
              <div
                key={a.stringId}
                className="row-list-item"
                onClick={() => {
                  setSelectedAssetId(a.stringId!);
                  setSearchParams({ assetId: a.stringId! });
                }}
              >
                <span className="mono muted" style={{ width: 110, fontSize: 11 }}>
                  {a.stringId}
                </span>
                <span>{a.label}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <p>
            <span
              className="pill"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedAssetId(null);
                setSearchParams({});
                setSteps(null);
              }}
            >
              ← choose a different asset
            </span>
            {" "}
            <Link to={`/w/${workspaceId}/assets/${selectedAssetId}`} className="mono">
              {selectedAssetId} — Asset Detail →
            </Link>
          </p>

          {!steps ? (
            <div className="muted">Tracing evidence path…</div>
          ) : (
            <div>
              {Array.from(byDepth.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([depth, group]) => (
                  <div key={depth}>
                    {depth > 0 && <div className="evidence-path-arrow">↓ ({group.length} at this depth)</div>}
                    {group.map((s, i) => (
                      <div key={`${s.node.type}:${s.node.id}:${i}`} className="evidence-path-step">
                        <span className="pill" style={{ fontSize: 10 }}>
                          {s.node.type}
                        </span>
                        <span style={{ flex: 1 }}>{s.node.label}</span>
                        {s.viaEdge && (
                          <span className="mono muted" style={{ fontSize: 10 }}>
                            via {s.viaEdge.edgeType}
                            {s.viaEdge.confidence !== null ? ` (${s.viaEdge.confidence})` : ""}
                          </span>
                        )}
                        {s.node.type === "case" && (
                          <Link to={`/w/${workspaceId}/cases/${s.node.id}`} className="mono" style={{ fontSize: 11 }}>
                            open →
                          </Link>
                        )}
                        <Link to={`/w/${workspaceId}/graph?focusType=${s.node.type}&focusId=${s.node.id}`} className="mono" style={{ fontSize: 11 }}>
                          in graph →
                        </Link>
                      </div>
                    ))}
                  </div>
                ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                {steps.length} node(s) reached across {maxDepth} hop(s) from this asset's real, recorded relationships, case links, and evidence assessments.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
