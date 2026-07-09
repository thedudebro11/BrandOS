// Thin fetch wrappers — this file must never contain calculations, only
// shaping HTTP calls. Every response type is imported from ../../shared-types
// (Phase 5, Section 1) — this file declares zero of its own response shapes.
import type {
  ActionItem,
  ActivityEvent,
  AssetFacets,
  AssetIntelligence,
  AssetSummary,
  CaseDetail,
  CaseEvidenceSuggestion,
  CaseSummary,
  CaseTemplate,
  DuplicateGroup,
  EvidenceTraceStep,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  NodeDetail,
  OverviewData,
  PathKind,
  PathResult,
  PriorityOfUseData,
  ReviewQueueEntry,
  SearchResult,
  TimelineEntry,
  TimelineExplorerData,
  WorkspaceSummary,
} from "../../shared-types";

export type {
  ActionItem,
  ActivityEvent,
  AssetFacets,
  AssetIntelligence,
  AssetSummary,
  CaseDetail,
  CaseEvidenceSuggestion,
  CaseSummary,
  CaseTemplate,
  DuplicateGroup,
  EvidenceTraceStep,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  NodeDetail,
  OverviewData,
  PathKind,
  PathResult,
  PriorityOfUseData,
  ReviewQueueEntry,
  SearchResult,
  TimelineEntry,
  TimelineExplorerData,
  WorkspaceSummary,
};

const BASE = "/api";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `${url} -> ${res.status}`);
  return res.json();
}

export const api = {
  listWorkspaces: () => getJson<{ workspaces: WorkspaceSummary[] }>(`${BASE}/workspaces`),
  overview: (id: string) => getJson<OverviewData>(`${BASE}/workspaces/${id}/overview`),
  activity: (id: string, limit = 30) => getJson<{ events: ActivityEvent[] }>(`${BASE}/workspaces/${id}/activity?limit=${limit}`),
  actionCenter: (id: string) => getJson<{ items: ActionItem[] }>(`${BASE}/workspaces/${id}/action-center`),
  reviewQueue: (id: string) => getJson<{ entries: ReviewQueueEntry[] }>(`${BASE}/workspaces/${id}/review-queue`),
  duplicates: (id: string) => getJson<{ groups: DuplicateGroup[] }>(`${BASE}/workspaces/${id}/duplicates`),
  listCases: (id: string) => getJson<{ cases: CaseSummary[]; templates: CaseTemplate[] }>(`${BASE}/workspaces/${id}/cases`),
  caseDetail: (id: string, caseId: number) => getJson<CaseDetail>(`${BASE}/workspaces/${id}/cases/${caseId}`),
  caseSuggestions: (id: string, caseId: number) =>
    getJson<{ suggestions: CaseEvidenceSuggestion[] }>(`${BASE}/workspaces/${id}/cases/${caseId}/suggestions`),
  createCase: (id: string, templateKey: string, title?: string) =>
    postJson<CaseSummary>(`${BASE}/workspaces/${id}/cases`, { templateKey, title }),
  linkToCase: (id: string, caseId: number, linkedType: "asset" | "timeline_event", linkedId: number, note?: string) =>
    postJson<{ ok: true }>(`${BASE}/workspaces/${id}/cases/${caseId}/links`, { linkedType, linkedId, note }),
  priorityOfUse: (id: string) => getJson<PriorityOfUseData>(`${BASE}/workspaces/${id}/priority-of-use`),
  asset: (id: string, assetId: string) => getJson<AssetIntelligence>(`${BASE}/workspaces/${id}/assets/${assetId}`),
  assets: (id: string, params: Record<string, string> = {}) =>
    getJson<{ assets: AssetSummary[]; facets: AssetFacets }>(
      `${BASE}/workspaces/${id}/assets?${new URLSearchParams(params).toString()}`
    ),
  search: (id: string, q: string) => getJson<{ results: SearchResult[] }>(`${BASE}/workspaces/${id}/search?q=${encodeURIComponent(q)}`),
  graph: (id: string) => getJson<GraphData>(`${BASE}/workspaces/${id}/graph`),
  graphNode: (id: string, type: GraphNodeType, nodeId: number) => getJson<NodeDetail>(`${BASE}/workspaces/${id}/graph/node/${type}/${nodeId}`),
  graphNeighbors: (id: string, type: GraphNodeType, nodeId: number) =>
    getJson<{ neighbors: { node: GraphNode; edge: unknown }[] }>(`${BASE}/workspaces/${id}/graph/neighbors/${type}/${nodeId}`),
  graphPath: (id: string, from: { type: GraphNodeType; id: number }, to: { type: GraphNodeType; id: number }, kind: PathKind) =>
    getJson<PathResult>(
      `${BASE}/workspaces/${id}/graph/path?fromType=${from.type}&fromId=${from.id}&toType=${to.type}&toId=${to.id}&kind=${kind}`
    ),
  evidencePath: (id: string, type: GraphNodeType, nodeId: number) =>
    getJson<{ steps: EvidenceTraceStep[] }>(`${BASE}/workspaces/${id}/graph/evidence-path/${type}/${nodeId}`),
  timeline: (id: string, params: Record<string, string> = {}) =>
    getJson<TimelineExplorerData>(`${BASE}/workspaces/${id}/timeline?${new URLSearchParams(params).toString()}`),
};
