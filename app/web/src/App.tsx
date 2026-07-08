import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { CasesList } from "./pages/CasesList";
import { CaseDetail } from "./pages/CaseDetail";
import { PriorityOfUse } from "./pages/PriorityOfUse";
import { AssetDetail } from "./pages/AssetDetail";
import { ReviewQueue } from "./pages/ReviewQueue";
import { Duplicates } from "./pages/Duplicates";
import { AssetsExplorer } from "./pages/AssetsExplorer";
import { api, type WorkspaceSummary } from "./api";

function WorkspacePicker() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);

  useEffect(() => {
    api.listWorkspaces().then((r) => setWorkspaces(r.workspaces));
  }, []);

  if (!workspaces) return <div className="muted" style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 480 }}>
      <h1 style={{ marginBottom: 16 }}>BrandOS</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Choose a workspace to open Mission Control.</p>
      <div className="row-list">
        {workspaces.map((w) => (
          <Link key={w.id} to={`/w/${w.id}/overview`} className="row-list-item">
            <div style={{ flex: 1 }}>
              <div>{w.name}</div>
              <div className="muted mono" style={{ fontSize: 11 }}>
                {w.type} · {w.status}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkspacePicker />} />
        <Route path="/w/:workspaceId" element={<Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="cases" element={<CasesList />} />
          <Route path="cases/:caseId" element={<CaseDetail />} />
          <Route path="priority-of-use" element={<PriorityOfUse />} />
          <Route path="assets" element={<AssetsExplorer />} />
          <Route path="assets/:assetId" element={<AssetDetail />} />
          <Route path="review-queue" element={<ReviewQueue />} />
          <Route path="duplicates" element={<Duplicates />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
