import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { KindIcon } from "./icons";
import { KIND_NAMES, type EditorObject, type ObjectKind } from "./model";
import type { EditorAction } from "./state";

const ADDABLE: readonly ObjectKind[] = [
  "sphere",
  "cylinder",
  "cone",
  "box",
  "plane",
  "disk",
  "point",
  "segment",
  "face",
];

export function AddPalette({ onAdd }: { onAdd: (kind: ObjectKind) => void }) {
  return (
    <section className="ed-panel-section" aria-labelledby="ed-add-title">
      <h2 id="ed-add-title" className="ed-panel-title">
        추가
      </h2>
      <div className="ed-add-grid">
        {ADDABLE.map((kind) => (
          <button
            key={kind}
            type="button"
            className="ed-add-btn"
            onClick={() => onAdd(kind)}
            title={
              kind === "segment"
                ? "최근 두 점을 잇습니다"
                : kind === "face"
                  ? "최근 세 점을 지나는 면"
                  : `${KIND_NAMES[kind]} 추가`
            }
          >
            <KindIcon kind={kind} />
            <span>{KIND_NAMES[kind]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Outliner({
  objects,
  selection,
  dispatch,
}: {
  objects: readonly EditorObject[];
  selection: string | null;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <section
      className="ed-panel-section ed-outliner"
      aria-labelledby="ed-scene-title"
    >
      <h2 id="ed-scene-title" className="ed-panel-title">
        장면
        <span className="ed-count">{objects.length}</span>
      </h2>
      {objects.length === 0 ? (
        <p className="ed-empty">위의 단추로 도형을 추가하세요.</p>
      ) : (
        <ul className="ed-tree" role="listbox" aria-label="장면의 개체">
          {objects.map((object) => {
            const selected = object.id === selection;
            return (
              <li
                key={object.id}
                role="option"
                aria-selected={selected}
                className={selected ? "is-selected" : undefined}
                data-hidden={object.hidden || undefined}
                onClick={() => dispatch({ type: "select", id: object.id })}
                onDoubleClick={() => setRenaming(object.id)}
              >
                <KindIcon kind={object.kind} size={16} />
                {renaming === object.id ? (
                  <input
                    className="ed-rename"
                    defaultValue={object.name}
                    autoFocus
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
                {object.label && (
                  <i className="ed-tree-label">{object.label}</i>
                )}
                <button
                  type="button"
                  className="ed-tree-eye"
                  aria-label={object.hidden ? "보이기" : "숨기기"}
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
