import React, { useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CsgOperation } from "@hlr/scene/primitives/csg.js";
import { Glyph, KindIcon } from "./icons";
import {
  consumedIds,
  KIND_NAMES,
  OPERATION_SYMBOLS,
  type EditorObject,
  type SolidKind,
  type SurfaceKind,
} from "./model";
import type { EditorAction } from "./state";
import {
  BOOLEAN_TOOLS,
  CONSTRUCT_TOOLS,
  MARK_TOOLS,
  POINT_TOOLS,
  toolAction,
  type Tool,
  type ToolContext,
} from "./tools";

export type ShapeKind = SolidKind | SurfaceKind;

const SHAPES: readonly ShapeKind[] = [
  "sphere",
  "cylinder",
  "cone",
  "box",
  "plane",
  "disk",
];

function ToolButtons({
  tools,
  ctx,
  dispatch,
}: {
  tools: readonly Tool[];
  ctx: ToolContext;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const kinds = ctx.selection.map(
    (id) => ctx.objects.find((o) => o.id === id)?.kind,
  );
  const pointsOnly = kinds.every((k) => k === "point") ? kinds.length : 0;
  return (
    <>
      {tools.map((tool) => {
        const action = toolAction(tool.id, ctx);
        // Tools light up once the selection fits them; segments and faces
        // also work from nothing by making new points.
        const ready =
          action !== null &&
          (tool.id === "segment"
            ? pointsOnly >= 2
            : tool.id === "face"
              ? pointsOnly >= 3
              : true);
        return (
          <button
            key={tool.id}
            type="button"
            className="ed-add-btn"
            data-ready={ready || undefined}
            disabled={!action}
            title={`${tool.label} — ${tool.needs}`}
            onClick={() => action && dispatch(action)}
          >
            <Glyph name={tool.id} />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </>
  );
}

/** Shapes to drop in, and constructions that work on the selection. */
export function AddPalette({
  onAdd,
  placing,
  onTogglePlacing,
  ctx,
  dispatch,
}: {
  onAdd: (kind: ShapeKind) => void;
  /** The 점 tool: clicks in the viewport put down points. */
  placing: boolean;
  onTogglePlacing: () => void;
  ctx: ToolContext;
  dispatch: React.Dispatch<EditorAction>;
}) {
  return (
    <section className="ed-panel-section ed-palette" aria-label="만들기">
      <h2 className="ed-panel-title">만들기</h2>
      <div className="ed-add-grid">
        {SHAPES.map((kind) => (
          <button
            key={kind}
            type="button"
            className="ed-add-btn"
            onClick={() => onAdd(kind)}
            title={`${KIND_NAMES[kind]} 추가`}
          >
            <KindIcon kind={kind} />
            <span>{KIND_NAMES[kind]}</span>
          </button>
        ))}
        <button
          type="button"
          className="ed-add-btn"
          aria-pressed={placing}
          onClick={onTogglePlacing}
          title="점 찍기 (P) — 누른 자리에 점을 놓습니다. 꼭짓점·선분·구·평면에 놓으면 거기에 붙습니다."
        >
          <KindIcon kind="point" />
          <span>점</span>
        </button>
        <ToolButtons tools={POINT_TOOLS} ctx={ctx} dispatch={dispatch} />
      </div>
      <h2 className="ed-panel-title ed-palette-sub">
        작도
        <small>고른 것 위에 점을 세웁니다</small>
      </h2>
      <div className="ed-add-grid">
        <ToolButtons tools={CONSTRUCT_TOOLS} ctx={ctx} dispatch={dispatch} />
      </div>
      <h2 className="ed-panel-title ed-palette-sub">
        불리언 · 표시
        <small>먼저 고른 것이 A</small>
      </h2>
      <div className="ed-add-grid">
        <ToolButtons tools={BOOLEAN_TOOLS} ctx={ctx} dispatch={dispatch} />
        <ToolButtons tools={MARK_TOOLS} ctx={ctx} dispatch={dispatch} />
      </div>
    </section>
  );
}

type Row = {
  object: EditorObject;
  depth: number;
  /** For operands: the operation they take part in, and which side. */
  op?: CsgOperation;
  side?: "a" | "b";
};

export function Outliner({
  objects,
  selection,
  dispatch,
}: {
  objects: readonly EditorObject[];
  selection: readonly string[];
  dispatch: React.Dispatch<EditorAction>;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const rows = useMemo(() => {
    const byId = new Map(objects.map((object) => [object.id, object]));
    const consumed = consumedIds(objects);
    const out: Row[] = [];
    const walk = (row: Row) => {
      out.push(row);
      const { object, depth } = row;
      if (object.kind !== "boolean" || depth > 16) return;
      const a = byId.get(object.a);
      const b = byId.get(object.b);
      if (a) walk({ object: a, depth: depth + 1, op: object.op, side: "a" });
      if (b) walk({ object: b, depth: depth + 1, op: object.op, side: "b" });
    };
    for (const object of objects)
      if (!consumed.has(object.id)) walk({ object, depth: 0 });
    return out;
  }, [objects]);
  const selected = new Set(selection);

  const onRowClick = (event: React.MouseEvent, id: string) => {
    if (event.metaKey || event.ctrlKey) {
      dispatch({ type: "toggle", id });
      anchor.current = id;
      return;
    }
    if (event.shiftKey && anchor.current) {
      const from = rows.findIndex((r) => r.object.id === anchor.current);
      const to = rows.findIndex((r) => r.object.id === id);
      if (from >= 0 && to >= 0) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        dispatch({
          type: "select",
          ids: rows.slice(lo, hi + 1).map((r) => r.object.id),
        });
        return;
      }
    }
    anchor.current = id;
    dispatch({ type: "select", ids: [id] });
  };

  const top = rows.filter((r) => r.depth === 0).length;
  return (
    <section
      className="ed-panel-section ed-outliner"
      aria-labelledby="ed-scene-title"
    >
      <h2 id="ed-scene-title" className="ed-panel-title">
        장면
        <span className="ed-count">{top}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="ed-empty">위의 단추로 도형을 추가하세요.</p>
      ) : (
        <ul
          className="ed-tree"
          role="listbox"
          aria-multiselectable="true"
          aria-label="장면의 개체"
        >
          {rows.map(({ object, depth, op, side }) => (
            <li
              key={object.id}
              role="option"
              aria-selected={selected.has(object.id)}
              className={selected.has(object.id) ? "is-selected" : undefined}
              data-hidden={object.hidden || undefined}
              data-operand={depth > 0 || undefined}
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={(event) => onRowClick(event, object.id)}
              onDoubleClick={() => setRenaming(object.id)}
            >
              {op && (
                <span
                  className="ed-tree-op"
                  title={side === "a" ? "A" : `${OPERATION_SYMBOLS[op]} B`}
                >
                  {side === "a" ? "A" : OPERATION_SYMBOLS[op]}
                </span>
              )}
              <KindIcon kind={object.kind} size={16} />
              {renaming === object.id ? (
                <input
                  className="ed-rename"
                  defaultValue={object.name}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    dispatch({
                      type: "update",
                      id: object.id,
                      patch: { name: event.target.value || object.name },
                    });
                    setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <span className="ed-tree-name">{object.name}</span>
              )}
              {object.kind === "boolean" ? (
                <span className="ed-tree-badge">
                  {OPERATION_SYMBOLS[object.op]}
                </span>
              ) : object.kind === "point" && object.constraint ? (
                <span className="ed-tree-badge" title="작도한 점">
                  작도
                </span>
              ) : null}
              {object.label && (
                <i className="ed-tree-label">{object.label}</i>
              )}
              {depth === 0 && (
                <button
                  type="button"
                  className="ed-tree-eye"
                  aria-label={object.hidden ? "보이기" : "숨기기"}
                  title={`${KIND_NAMES[object.kind]} ${object.hidden ? "보이기" : "숨기기"}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch({
                      type: "update",
                      id: object.id,
                      patch: { hidden: !object.hidden },
                    });
                  }}
                >
                  {object.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
