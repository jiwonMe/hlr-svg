import React, { useMemo, useState } from "react";

// NOTE: src/는 .js 확장자 import를 사용하므로, 브라우저에서는 dist/를 직접 import한다.
import { buildDemoCases } from "../../dist/demo/cases.js";
import type { DemoCase } from "../../dist/demo/types.js";
import { Viewer } from "./Viewer";

type Mode = "single" | "all";

export function App(): React.ReactElement {
  const cases = useMemo(() => buildDemoCases(), []);
  const [mode, setMode] = useState<Mode>("single");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState(cases[0]?.name ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => c.name.toLowerCase().includes(q));
  }, [cases, query]);

  const selected = useMemo(() => {
    return cases.find((c) => c.name === selectedName) ?? cases[0] ?? null;
  }, [cases, selectedName]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">HLR SVG Demo</div>
          <div className="brandSub">React + Vite</div>
        </div>

        <div className="controls">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="케이스 검색…"
            aria-label="케이스 검색"
          />

          <div className="segmented" role="tablist" aria-label="보기 모드">
            <button
              className={mode === "single" ? "segBtn segBtnActive" : "segBtn"}
              onClick={() => setMode("single")}
              type="button"
              role="tab"
              aria-selected={mode === "single"}
            >
              하나 보기
            </button>
            <button
              className={mode === "all" ? "segBtn segBtnActive" : "segBtn"}
              onClick={() => setMode("all")}
              type="button"
              role="tab"
              aria-selected={mode === "all"}
            >
              전체 보기
            </button>
          </div>
        </div>
      </header>

      <div className="content">
        <aside className="sidebar">
          <div className="sidebarTitle">Cases ({filtered.length})</div>
          <div className="caseList" role="listbox" aria-label="데모 케이스 목록">
            {filtered.map((c) => {
              const active = c.name === selectedName;
              return (
                <button
                  key={c.name}
                  className={active ? "caseBtn caseBtnActive" : "caseBtn"}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedName(c.name);
                    setMode("single");
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="main">
          {mode === "single" ? (
            selected ? (
              <Viewer demo={selected} />
            ) : (
              <div className="empty">케이스가 없습니다.</div>
            )
          ) : (
            <div className="grid">
              {filtered.map((c) => (
                <Viewer key={c.name} demo={c} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
