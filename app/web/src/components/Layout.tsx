import { Outlet, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { api } from "../api";

export function Layout() {
  const { workspaceId = "" } = useParams();
  const [workspaceName, setWorkspaceName] = useState(workspaceId);

  useEffect(() => {
    api.listWorkspaces().then((r) => {
      const match = r.workspaces.find((w) => w.id === workspaceId);
      if (match) setWorkspaceName(match.name);
    });
  }, [workspaceId]);

  return (
    <div className="app-shell">
      <Sidebar workspaceId={workspaceId} workspaceName={workspaceName} />
      <main className="main">
        <Outlet />
      </main>
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}
