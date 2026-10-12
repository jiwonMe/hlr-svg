import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  Code2,
  Download,
  FileDown,
  FolderOpen,
  LayoutTemplate,
  Maximize2,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { Vec3 } from "@hlr/math/vec3.js";
import { clamp, type OrbitState } from "./runtime/orbit";
import { useFrameState } from "./runtime/useFrameState";
import { LogoMark } from "./site/Logo";
import { CodeWindow } from "./site/Code";
import {
  boundsCenter,
  boundsRadius,
  buildScene,
  type Bounds,
} from "./editor/build";
import { generateCode } from "./editor/codegen";
import { Segmented } from "./editor/fields";
import { Inspector } from "./editor/Inspector";
import { formatNumber, snapValue, vec, type Tuple3 } from "./editor/math";
import {
  createFace,
  createObject,
  createSegment,
  isPositioned,
  KIND_NAMES,
  parseDoc,
  type EditorDoc,
  type EditorObject,
  type ObjectKind,
} from "./editor/model";
import { AddPalette, Outliner } from "./editor/Outliner";
import { editorReducer, type EditorState } from "./editor/state";
import { DEFAULT_TEMPLATE, TEMPLATES } from "./editor/templates";
import {
  Viewport,
  type GizmoMode,
  type ViewportHandle,
} from "./editor/Viewport";
import { VIEW_SCALE, type Projection } from "./editor/viewCamera";
import "./site/site.css";
import "./exam/exam.css";
import "./editor/editor.css";

const STORAGE_KEY = "hlr-studio:doc";

const VIEWS = {
  // A three-quarter view like exam figures; exact isometric stacks cube corners.
  start: { azimuth: 0.6, polar: 1.1 },
  iso: { azimuth: Math.PI / 4, polar: Math.acos(1 / Math.sqrt(3)) },
  front: { azimuth: 0, polar: Math.PI / 2 },
  side: { azimuth: Math.PI / 2, polar: Math.PI / 2 },
  top: { azimuth: 0, polar: 0.02 },
} as const;
type ViewName = keyof typeof VIEWS;

const SNAP_OPTIONS = [0, 0.1, 0.25, 0.5, 1] as const;

function loadInitial(): EditorState {
  let doc: EditorDoc | null = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) doc = parseDoc(JSON.parse(raw));
  } catch {
    doc = null;
  }
  return {
    doc: doc ?? DEFAULT_TEMPLATE.create(),
    selection: null,
    past: [],
    future: [],
  };
}

/** Orbit that fits `bounds` in a viewport of the given aspect. */
function fitView(
  bounds: Bounds | null,
  aspect: number,
  from: OrbitState,
): OrbitState {
  if (!bounds) return { ...from, target: Vec3.zero(), radius: 12 };
  const halfHeight = boundsRadius(bounds) * Math.max(1, 1 / aspect) * 1.18;
  return {
    ...from,
    target: vec(boundsCenter(bounds)),
    radius: clamp(0.8, halfHeight / VIEW_SCALE, 400),
  };
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function fileName(title: string) {
  return title.trim().replace(/[\\/:*?"<>|]+/g, "-") || "scene";
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

/** Lays shapes, points and planes out in 3D and draws them as exam figures. */
export function GeometryPlayground(): React.ReactElement {
  const [state, dispatch] = useReducer(editorReducer, undefined, loadInitial);
  const { doc, selection, past, future } = state;
  // Settings changes keep the same objects array, so the scene is reused.
  const scene = useMemo(() => buildScene(doc), [doc.objects]);
  const [initialView] = useState(() =>
    fitView(scene.sceneBounds, 1.6, {
      ...VIEWS.start,
      target: Vec3.zero(),
      radius: 12,
    }),
  );
  const [view, viewInput] = useFrameState<OrbitState>(initialView);
  const [projection, setProjection] = useState<Projection>("orthographic");
  const [gizmo, setGizmo] = useState<GizmoMode>("move");
  const [snap, setSnap] = useState<number>(0.5);
  const [renderMs, setRenderMs] = useState(0);
  const [dialog, setDialog] = useState<null | "code" | "templates">(null);
  const [message, setMessage] = useState("");
  const viewportRef = useRef<ViewportHandle | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selected =
    doc.objects.find((object) => object.id === selection) ?? null;

  // Autosave is a per-browser convenience; failures are silent.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      } catch {
        /* storage may be unavailable */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [doc]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const frame = useCallback(
    (bounds: Bounds | null) => {
      const size = viewportRef.current?.size() ?? { width: 960, height: 640 };
      viewInput.reset((current) =>
        fitView(bounds, size.width / size.height, current),
      );
    },
    [viewInput],
  );

  const setView = (name: ViewName) =>
    viewInput.reset((current) => ({ ...current, ...VIEWS[name] }));

  // New shapes land on the floor under the view centre, snapped.
  const dropPoint = (): Tuple3 => {
    const target = viewInput.current().target;
    const step = snap || 0.5;
    return [snapValue(target.x, step), 0, snapValue(target.z, step)];
  };

  const addObject = (kind: ObjectKind) => {
    const objects = doc.objects;
    const points = objects.filter((object) => object.kind === "point");
    const at = dropPoint();
    const newPoints = (count: number): EditorObject[] => {
      const made: EditorObject[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.PI / 6;
        made.push(
          createObject([...objects, ...made], "point", [
            at[0] + 1.5 * Math.cos(angle),
            at[1],
            at[2] + 1.5 * Math.sin(angle),
          ]),
        );
      }
      return made;
    };
    if (kind === "segment") {
      const tail =
        selected?.kind === "point" ? selected : points[points.length - 1];
      const head = points.filter((p) => p.id !== tail?.id).at(-1);
      if (tail && head)
        dispatch({ type: "addSegment", from: head.id, to: tail.id });
      else {
        const made = newPoints(2);
        dispatch({
          type: "addMany",
          objects: [
            ...made,
            createSegment([...objects, ...made], made[0]!.id, made[1]!.id),
          ],
        });
      }
      return;
    }
    if (kind === "face") {
      const recent = points.slice(-3);
      if (recent.length === 3)
        dispatch({ type: "addFace", points: recent.map((p) => p.id) });
      else {
        const made = newPoints(3);
        dispatch({
          type: "addMany",
          objects: [
            ...made,
            createFace(
              [...objects, ...made],
              made.map((p) => p.id),
            ),
          ],
        });
      }
      return;
    }
    dispatch({ type: "add", object: createObject(objects, kind, at) });
  };

  const exportSvg = () => {
    const svg = viewportRef.current?.exportSvg();
    if (!svg) return;
    download(`${fileName(doc.title)}.svg`, svg, "image/svg+xml;charset=utf-8");
    setMessage("SVG로 저장했습니다");
  };

  const saveJson = () => {
    download(
      `${fileName(doc.title)}.json`,
      JSON.stringify(doc, null, 2),
      "application/json",
    );
    setMessage("장면을 JSON으로 저장했습니다");
  };

  const openJson = async (file: File) => {
    try {
      const parsed = parseDoc(JSON.parse(await file.text()));
      if (!parsed) throw new Error("invalid");
      dispatch({ type: "load", doc: parsed });
      frame(buildScene(parsed).sceneBounds);
      setMessage(`‘${parsed.title}’을 불러왔습니다`);
    } catch {
      setMessage("HLR SVG 장면 파일이 아닙니다");
    }
  };

  // Keyboard shortcuts read the latest state through a ref.
  const latest = useRef({ selected, snap, scene });
  latest.current = { selected, snap, scene };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const { selected: sel, snap: step, scene: built } = latest.current;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && key === "d") {
        event.preventDefault();
        if (sel) dispatch({ type: "duplicate", id: sel.id });
      } else if (mod) {
        return;
      } else if ((key === "delete" || key === "backspace") && sel) {
        event.preventDefault();
        dispatch({ type: "remove", id: sel.id });
      } else if (key === "escape") {
        if (dialog) setDialog(null);
        else dispatch({ type: "select", id: null });
      } else if (key === "w") setGizmo("move");
      else if (key === "e") setGizmo("rotate");
      else if (key === "f")
        frame(sel ? (built.bounds.get(sel.id) ?? null) : built.sceneBounds);
      else if (key === "0") setView("iso");
      else if (key === "1") setView("front");
      else if (key === "3") setView("side");
      else if (key === "7") setView("top");
      else if (key.startsWith("arrow") && sel && isPositioned(sel)) {
        event.preventDefault();
        const d = step || 0.1;
        const [x, y, z] = sel.position;
        const position: Tuple3 =
          key === "arrowleft"
            ? [x - d, y, z]
            : key === "arrowright"
              ? [x + d, y, z]
              : event.shiftKey
                ? [x, y + (key === "arrowup" ? d : -d), z]
                : [x, y, z + (key === "arrowup" ? -d : d)];
        dispatch({ type: "update", id: sel.id, patch: { position } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, frame]);

  const selectionText = selected
    ? `${KIND_NAMES[selected.kind]} · ${selected.name}${
        isPositioned(selected)
          ? ` · (${selected.position.map((v) => formatNumber(v, 2)).join(", ")})`
          : ""
      }`
    : "선택 없음 · 도형을 누르거나 목록에서 고르세요";

  return (
    <div className="site ed">
      <header className="ed-topbar">
        <Link to="/" className="ed-brand" aria-label="HLR SVG 처음 화면">
          <LogoMark size={20} />
          <span>HLR SVG</span>
        </Link>
        <span className="ed-brand-sep" aria-hidden="true">
          /
        </span>
        <span className="ed-app-name">도형 작업실</span>
        <input
          className="ed-title"
          aria-label="장면 이름"
          value={doc.title}
          onChange={(event) =>
            dispatch({ type: "title", title: event.target.value })
          }
        />
        <div className="ed-top-actions">
          <button
            type="button"
            className="ed-icon-btn"
            onClick={() => dispatch({ type: "undo" })}
            disabled={!past.length}
            title="실행 취소 (⌘Z)"
            aria-label="실행 취소"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="ed-icon-btn"
            onClick={() => dispatch({ type: "redo" })}
            disabled={!future.length}
            title="다시 실행 (⌘⇧Z)"
            aria-label="다시 실행"
          >
            <Redo2 size={16} />
          </button>
          <span className="ed-top-sep" aria-hidden="true" />
          <button
            type="button"
            className="tool-btn"
            onClick={() => setDialog("templates")}
          >
            <LayoutTemplate size={14} />
            템플릿
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => fileRef.current?.click()}
          >
            <FolderOpen size={14} />
            열기
          </button>
          <button type="button" className="tool-btn" onClick={saveJson}>
            <FileDown size={14} />
            JSON
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => setDialog("code")}
          >
            <Code2 size={14} />
            코드
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={exportSvg}
          >
            <Download size={14} />
            SVG 저장
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openJson(file);
            event.currentTarget.value = "";
          }}
        />
      </header>

      <div className="ed-body">
        <aside className="ed-left" aria-label="도형 추가와 장면 목록">
          <AddPalette onAdd={addObject} />
          <Outliner
            objects={doc.objects}
            selection={selection}
            dispatch={dispatch}
          />
        </aside>

        <main className="ed-center">
          <div className="ed-toolbar" role="toolbar" aria-label="보기 도구">
            <Segmented
              label="변형 도구"
              value={gizmo}
              options={[
                { value: "move", label: "이동", title: "이동 (W)" },
                { value: "rotate", label: "회전", title: "회전 (E)" },
              ]}
              onChange={setGizmo}
            />
            <label className="ed-snap">
              <span>스냅</span>
              <select
                value={snap}
                onChange={(event) => setSnap(Number(event.target.value))}
              >
                {SNAP_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? "끄기" : value}
                  </option>
                ))}
              </select>
            </label>
            <span className="ed-toolbar-sep" aria-hidden="true" />
            <div className="ed-views" role="group" aria-label="시점">
              {(
                [
                  ["iso", "등각", "0"],
                  ["front", "정면", "1"],
                  ["side", "옆면", "3"],
                  ["top", "윗면", "7"],
                ] as const
              ).map(([name, label, key]) => (
                <button
                  key={name}
                  type="button"
                  className="tool-btn"
                  onClick={() => setView(name)}
                  title={`${label} (${key})`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Segmented
              label="투영"
              value={projection}
              options={[
                { value: "orthographic", label: "직교" },
                { value: "perspective", label: "원근" },
              ]}
              onChange={setProjection}
            />
            <button
              type="button"
              className="tool-btn"
              onClick={() =>
                frame(
                  selected
                    ? (scene.bounds.get(selected.id) ?? null)
                    : scene.sceneBounds,
                )
              }
              title="선택한 도형에 맞춤 (F)"
            >
              <Maximize2 size={14} />
              맞춤
            </button>
          </div>

          <Viewport
            ref={viewportRef}
            doc={doc}
            scene={scene}
            selection={selection}
            dispatch={dispatch}
            view={view}
            viewInput={viewInput}
            projection={projection}
            gizmo={gizmo}
            snap={snap}
            onRendered={setRenderMs}
          />

          <footer className="ed-statusbar">
            <span className="ed-status-selection">{selectionText}</span>
            <span className="ed-status-hint">
              끌기 회전 · Shift/오른쪽 끌기 이동 · 휠 확대 · W 이동 · E 회전 · F
              맞춤 · ⌘Z 되돌리기
            </span>
            <span className="ed-status-meta" role="status">
              {message || `렌더 ${renderMs.toFixed(0)}ms · 자동 저장`}
            </span>
          </footer>
        </main>

        <aside className="ed-right" aria-label="속성">
          <Inspector
            doc={doc}
            scene={scene}
            selection={selection}
            dispatch={dispatch}
            renderMs={renderMs}
          />
        </aside>
      </div>

      {dialog && (
        <div
          className="ed-dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <div
            className="ed-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ed-dialog-title"
          >
            <div className="ed-dialog-head">
              <h2 id="ed-dialog-title">
                {dialog === "code" ? "코드로 내보내기" : "템플릿에서 시작"}
              </h2>
              <button
                type="button"
                className="ed-icon-btn"
                onClick={() => setDialog(null)}
                aria-label="닫기"
                autoFocus
              >
                <X size={16} />
              </button>
            </div>
            {dialog === "code" ? (
              <CodeDialogBody
                doc={doc}
                viewport={viewportRef.current}
                scene={scene}
              />
            ) : (
              <div className="ed-templates">
                <p className="ed-dialog-note">
                  지금 장면은 실행 취소(⌘Z)로 되돌릴 수 있습니다.
                </p>
                <ul>
                  {TEMPLATES.map((template) => (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = template.create();
                          dispatch({ type: "load", doc: next });
                          viewInput.reset((current) => ({
                            ...current,
                            ...VIEWS.start,
                          }));
                          frame(buildScene(next).sceneBounds);
                          setDialog(null);
                        }}
                      >
                        <strong>{template.name}</strong>
                        <span>{template.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeDialogBody({
  doc,
  viewport,
  scene,
}: {
  doc: EditorDoc;
  viewport: ViewportHandle | null;
  scene: ReturnType<typeof buildScene>;
}) {
  const code = useMemo(() => {
    if (!viewport) return "";
    const { width, height } = viewport.size();
    return generateCode(doc, scene, viewport.camera(), width, height);
  }, [doc, scene, viewport]);
  return (
    <div className="ed-code">
      <p className="ed-dialog-note">
        지금 장면과 시점을 그대로 그리는 TypeScript입니다.{" "}
        <code>pnpm add hlr</code> 후 실행하면 같은 선이 나옵니다.
      </p>
      <CodeWindow title={`${fileName(doc.title)}.ts`} code={code} />
      <button
        type="button"
        className="tool-btn"
        onClick={() =>
          download(`${fileName(doc.title)}.ts`, code, "text/typescript")
        }
      >
        <Download size={14} />
        .ts 파일로 받기
      </button>
    </div>
  );
}
