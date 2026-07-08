import { NavLink } from "react-router-dom";

export function Sidebar({ workspaceName, workspaceId }: { workspaceName: string; workspaceId: string }) {
  const base = `/w/${workspaceId}`;
  const link = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        BrandOS
        <span className="workspace-name">{workspaceName}</span>
      </div>
      <NavLink to={`${base}/overview`} className={link}>
        Overview
      </NavLink>
      <NavLink to={`${base}/cases`} className={link}>
        Cases
      </NavLink>
      <NavLink to={`${base}/priority-of-use`} className={link}>
        Priority of Use
      </NavLink>
      <NavLink to={`${base}/assets`} className={link}>
        Assets
      </NavLink>
      <NavLink to={`${base}/review-queue`} className={link}>
        Needs Review
      </NavLink>
      <NavLink to={`${base}/duplicates`} className={link}>
        Duplicates
      </NavLink>
      <div style={{ marginTop: "auto", padding: "8px 10px" }}>
        <span className="muted" style={{ fontSize: 11 }}>
          Press <span className="kbd">⌘K</span> to search
        </span>
      </div>
    </nav>
  );
}
