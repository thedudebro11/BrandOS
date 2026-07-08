import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type DuplicateGroup } from "../api";

export function Duplicates() {
  const { workspaceId = "" } = useParams();
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);

  useEffect(() => {
    api.duplicates(workspaceId).then((r) => setGroups(r.groups));
  }, [workspaceId]);

  if (!groups) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Duplicate Groups</h1>
        <span className="muted mono" style={{ fontSize: 12 }}>
          {groups.length} group{groups.length === 1 ? "" : "s"}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">No duplicate files detected.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map((g) => (
            <div key={g.groupId} className="card">
              <p className="mono muted" style={{ fontSize: 11, wordBreak: "break-all", marginBottom: 8 }}>
                sha256: {g.sha256}
              </p>
              <div className="row-list">
                {g.assets.map((a, i) => (
                  <Link key={i} to={`/w/${workspaceId}/assets/${a?.asset_id}`} className="row-list-item">
                    <div>
                      <div>{a?.filename}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>
                        {a?.original_path}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
