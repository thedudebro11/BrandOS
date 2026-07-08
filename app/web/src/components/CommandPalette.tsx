import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type SearchResult } from "../api";

const GROUP_LABELS: Record<string, string> = {
  asset: "Assets",
  case: "Cases",
  timeline_event: "Timeline Events",
  tag: "Tags",
};

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.search(workspaceId, term).then((r) => {
        setResults(r.results.slice(0, 30));
        setActiveIndex(0);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [term, workspaceId]);

  // Grouped by entity type — "results should be grouped intelligently" (Section 7) —
  // ordering here (Cases, Assets, then the rest) reflects Mission Control's own
  // priority hierarchy (Section 1), not an arbitrary list order.
  const grouped = useMemo(() => {
    const order = ["case", "asset", "timeline_event", "tag"];
    return order
      .map((type) => ({ type, items: results.filter((r) => r.entityType === type) }))
      .filter((g) => g.items.length > 0);
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  function select(result: SearchResult) {
    setOpen(false);
    setTerm("");
    if (result.entityType === "case") navigate(`/w/${workspaceId}/cases/${result.id}`);
    else if (result.entityType === "asset" && result.stringId) navigate(`/w/${workspaceId}/assets/${result.stringId}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[activeIndex]) {
      select(flat[activeIndex]);
    }
  }

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div className="palette-overlay" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search assets, cases, tags, timeline events…"
        />
        <div className="palette-results">
          {term.trim() && flat.length === 0 && <div className="palette-result muted">No results</div>}
          {grouped.map((group) => (
            <div key={group.type}>
              <div className="palette-group-label">{GROUP_LABELS[group.type] ?? group.type}</div>
              {group.items.map((r) => {
                const i = runningIndex++;
                return (
                  <div
                    key={`${r.entityType}-${r.id}`}
                    className={`palette-result${i === activeIndex ? " active" : ""}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(r)}
                  >
                    <span>{r.label}</span>
                    <span className="muted mono" style={{ fontSize: 11 }}>
                      {r.matchedField}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
