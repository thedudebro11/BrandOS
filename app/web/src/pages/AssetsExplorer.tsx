import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type AssetFacets } from "../api";

type AssetRow = { assetId: string; filename: string; extension: string };

export function AssetsExplorer() {
  const { workspaceId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [facets, setFacets] = useState<AssetFacets | null>(null);

  const classification = searchParams.get("classification") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "filename";

  useEffect(() => {
    const params: Record<string, string> = { sortBy };
    if (classification) params.classification = classification;
    if (tag) params.tag = tag;
    api.assets(workspaceId, params).then((r) => {
      setAssets(r.assets as unknown as AssetRow[]);
      setFacets(r.facets);
    });
  }, [workspaceId, classification, tag, sortBy]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Assets</h1>
        {assets && (
          <span className="muted mono" style={{ fontSize: 12 }}>
            {assets.length} shown
          </span>
        )}
      </div>

      <div className="section" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h3 className="section-title">Classification</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 480 }}>
            <button
              className="pill"
              style={{ cursor: "pointer", background: !classification ? "var(--surface-hover)" : "var(--bg)" }}
              onClick={() => setFilter("classification", "")}
            >
              All
            </button>
            {facets?.classifications.map((c) => (
              <button
                key={c.category}
                className="pill"
                style={{ cursor: "pointer", background: classification === c.category ? "var(--surface-hover)" : "var(--bg)" }}
                onClick={() => setFilter("classification", c.category)}
              >
                {c.category} ({c.c})
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="section-title">Sort</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {(["filename", "date", "confidence"] as const).map((s) => (
              <button
                key={s}
                className="pill"
                style={{ cursor: "pointer", background: sortBy === s ? "var(--surface-hover)" : "var(--bg)" }}
                onClick={() => setFilter("sortBy", s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {facets && facets.tags.length > 0 && (
        <div className="section">
          <h3 className="section-title">Tags</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              className="pill"
              style={{ cursor: "pointer", background: !tag ? "var(--surface-hover)" : "var(--bg)" }}
              onClick={() => setFilter("tag", "")}
            >
              All
            </button>
            {facets.tags.slice(0, 12).map((t) => (
              <button
                key={t.name}
                className="pill"
                style={{ cursor: "pointer", background: tag === t.name ? "var(--surface-hover)" : "var(--bg)" }}
                onClick={() => setFilter("tag", t.name)}
              >
                {t.name} ({t.c})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        {!assets ? (
          <div className="muted">Loading…</div>
        ) : assets.length === 0 ? (
          <div className="empty-state">No assets match these filters.</div>
        ) : (
          <div className="row-list">
            {assets.map((a) => (
              <Link key={a.assetId} to={`/w/${workspaceId}/assets/${a.assetId}`} className="row-list-item">
                <span style={{ flex: 1 }}>{a.filename}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  {a.assetId}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
