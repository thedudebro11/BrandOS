import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CaseSummary, type CaseTemplate } from "../api";
import { StatusPill } from "../components/widgets";

export function CasesList() {
  const { workspaceId = "" } = useParams();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [showNew, setShowNew] = useState(false);

  function reload() {
    api.listCases(workspaceId).then((r) => {
      setCases(r.cases);
      setTemplates(r.templates);
    });
  }

  useEffect(reload, [workspaceId]);

  async function createCase(templateKey: string) {
    await api.createCase(workspaceId, templateKey);
    setShowNew(false);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Cases</h1>
        <button
          className="pill"
          style={{ cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface)" }}
          onClick={() => setShowNew((v) => !v)}
        >
          + New case
        </button>
      </div>

      {showNew && (
        <div className="card section">
          <h3 className="section-title">Start from a template</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {templates.map((t) => (
              <button
                key={t.templateKey}
                onClick={() => createCase(t.templateKey)}
                className="pill"
                style={{ cursor: "pointer", background: "var(--bg)" }}
                title={t.description ?? ""}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="empty-state">No cases yet. Create one from a template above.</div>
      ) : (
        <div className="row-list">
          {cases.map((c) => (
            <Link key={c.id} to={`/w/${workspaceId}/cases/${c.id}`} className="row-list-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{c.title}</div>
                <div className="muted mono" style={{ fontSize: 11 }}>
                  {c.caseKey} · {c.caseType}
                </div>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {c.linkCount} linked
              </span>
              {c.evidenceStrength && <StatusPill status={c.evidenceStrength.status} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
