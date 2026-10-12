import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Code2,
  Download,
  FileDown,
  FolderOpen,
  ImageDown,
  LayoutTemplate,
  Link2,
  Maximize2,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { Vec3 } from "@hlr/math/vec3.js";
import { clamp, type OrbitState } from "./runtime/orbit";
import { useFrameState } from "./runtime/useFrameState";
import { LogoMark } from "./site/Logo";
import { ThemeButton } from "./site/ThemeToggle";
import { CodeWindow } from "./site/Code";
import {
  boundsCenter,
  boundsOf,
  boundsRadius,
  buildScene,
  type Bounds,
  type BuiltScene,
} from "./editor/build";
import { generateCode } from "./editor/codegen";
import {
  clipboardText,
  decodeScene,
  encodeScene,
  parseClipboard,
  svgToPng,
} from "./editor/exporters";
import { Segmented } from "./editor/fields";
import { Inspector } from "./editor/Inspector";
import { formatNumber, snapValue, vec, type Tuple3 } from "./editor/math";
import {
  createObject,
  isPositioned,
  KIND_NAMES,
  parseDoc,
  parseView,
  type EditorDoc,
  type SavedView,
} from "./editor/model";
import { AddPalette, Outliner, type ShapeKind } from "./editor/Outliner";
import { copyClosure, editorReducer, type EditorState } from "./editor/state";
import { DEFAULT_TEMPLATE, TEMPLATES } from "./editor/templates";
import type { ToolContext } from "./editor/tools";
import { movePatches, transformTargets } from "./editor/transform";
import {
  Viewport,
  type GizmoMode,
  type ViewportHandle,
} from "./editor/Viewport";
import { VIEW_SCALE, type Projection } from "./editor/viewCamera";
import "./site/site.css";
import "./exam/exam.css";
import "./editor/editor.css";

const DOC_KEY = "hlr-studio:doc";
const VIEW_KEY = "hlr-studio:view";

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

const MemoPalette = memo(AddPalette);
const MemoOutliner = memo(Outliner);

function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
}

function loadInitial(): EditorState {
  return {
    doc: parseDoc(readStorage(DOC_KEY)) ?? DEFAULT_TEMPLATE.create(),
    selection: [],
    past: [],
    future: [],
  };
}

function toSaved(view: OrbitState, projection: Projection): SavedView {
  return {
    target: [view.target.x, view.target.y, view.target.z],
    radius: view.radius,
    azimuth: view.azimuth,
    polar: view.polar,
    projection,
  };
}

function fromSaved(saved: SavedView): OrbitState {
  return {
    target: vec(saved.target),
    radius: saved.radius,
    azimuth: saved.azimuth,
    polar: saved.polar,
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

function selectionBounds(
  selection: readonly string[],
  scene: BuiltScene,
): Bounds | null {
  const parts = selection
    .map((id) => scene.bounds.get(id))
    .filter((b): b is Bounds => !!b);
  return parts.length
    ? boundsOf(parts.flatMap((b) => [b.min, b.max]))
    : scene.sceneBounds;
}

function download(name: string, content: string | Blob, type: string) {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
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

type ExportItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
};

function ExportMenu({ items }: { items: readonly ExportItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="ed-menu" ref={ref}>
      <button
        type="button"
        className="tool-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FileDown size={14} />
        내보내기
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="ed-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              {item.icon}
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lays shapes, points and planes out in 3D and draws them as exam figures. */
export function GeometryPlayground(): React.ReactElement {
  const [state, dispatch] = useReducer(editorReducer, undefined, loadInitial);
  const { doc, selection, past, future } = state;
  const objects = doc.objects;
  // Settings changes keep the same objects array, so the scene is reused.
  const scene = useMemo(() => buildScene({ objects }), [objects]);
  const [stored] = useState(() => parseView(readStorage(VIEW_KEY)));
  const [view, viewInput] = useFrameState<OrbitState>(
    stored
      ? fromSaved(stored)
      : fitView(scene.sceneBounds, 1.6, {
          ...VIEWS.start,
          target: Vec3.zero(),
          radius: 12,
        }),
  );
  const [projection, setProjection] = useState<Projection>(
    stored?.projection ?? "orthographic",
  );
  const [gizmo, setGizmo] = useState<GizmoMode>("move");
  const [snap, setSnap] = useState<number>(0.5);
  const [renderMs, setRenderMs] = useState(0);
  const [dialog, setDialog] = useState<null | "code" | "templates">(null);
  const [message, setMessage] = useState("");
  const viewportRef = useRef<ViewportHandle | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const titleEdit = useRef(false);
  const [params, setParams] = useSearchParams();

  const step = snap || 0.5;
  const dropX = snapValue(view.target.x, step);
  const dropZ = snapValue(view.target.z, step);
  const ctx: ToolContext = useMemo(
    () => ({ objects, selection, dropAt: [dropX, 0, dropZ] }),
    [objects, selection, dropX, dropZ],
  );

  // Autosave is a per-browser convenience; failures are silent.
  useEffect(() => {
    const timer = window.setTimeout(() => writeStorage(DOC_KEY, doc), 300);
    return () => window.clearTimeout(timer);
  }, [doc]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => writeStorage(VIEW_KEY, toSaved(view, projection)),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [view, projection]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2800);
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

  const loadScene = useCallback(
    (next: EditorDoc, saved?: SavedView | null) => {
      dispatch({ type: "load", doc: next });
      if (saved) {
        viewInput.reset(fromSaved(saved));
        setProjection(saved.projection);
      } else {
        viewInput.reset((current) => ({ ...current, ...VIEWS.start }));
        frame(buildScene(next).sceneBounds);
      }
    },
    [frame, viewInput],
  );

  // Scenes shared as links open once, then the address goes back to normal.
  useEffect(() => {
    const code = params.get("scene");
    if (!code) return;
    let cancelled = false;
    void decodeScene(code).then((shared) => {
      if (cancelled) return;
      if (shared) {
        loadScene(shared.doc, shared.view);
        setMessage(`공유된 장면 ‘${shared.doc.title}’을 열었습니다`);
      } else setMessage("공유 링크를 읽지 못했습니다");
      setParams({}, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [params, setParams, loadScene]);

  const latest = useRef({ doc, selection, snap, scene, dropAt: ctx.dropAt });
  latest.current = { doc, selection, snap, scene, dropAt: ctx.dropAt };

  const addShape = useCallback((kind: ShapeKind) => {
    const { doc: current, dropAt } = latest.current;
    dispatch({
      type: "add",
      objects: [createObject(current.objects, kind, dropAt)],
    });
  }, []);

  const exportSvg = () => {
    const svg = viewportRef.current?.exportSvg();
    if (!svg) return;
    download(`${fileName(doc.title)}.svg`, svg, "image/svg+xml;charset=utf-8");
    setMessage("SVG로 저장했습니다");
  };

  const exportPng = async () => {
    const svg = viewportRef.current?.exportSvg();
    if (!svg) return;
    try {
      setMessage("PNG를 만드는 중…");
      download(`${fileName(doc.title)}.png`, await svgToPng(svg, 2), "image/png");
      setMessage("PNG(2배 해상도)로 저장했습니다");
    } catch {
      setMessage("PNG를 만들지 못했습니다");
    }
  };

  const saveJson = () => {
    download(
      `${fileName(doc.title)}.json`,
      JSON.stringify(
        { ...doc, view: toSaved(viewInput.current(), projection) },
        null,
        2,
      ),
      "application/json",
    );
    setMessage("장면과 시점을 JSON으로 저장했습니다");
  };

  const openJson = async (file: File) => {
    try {
      const value = JSON.parse(await file.text()) as { view?: unknown };
      const parsed = parseDoc(value);
      if (!parsed) throw new Error("invalid");
      loadScene(parsed, parseView(value.view));
      setMessage(`‘${parsed.title}’을 불러왔습니다`);
    } catch {
      setMessage("HLR SVG 장면 파일이 아닙니다");
    }
  };

  const copyLink = async () => {
    try {
      const code = await encodeScene({
        doc,
        view: toSaved(viewInput.current(), projection),
      });
      const url = `${window.location.origin}${window.location.pathname}#/playground?scene=${code}`;
      await navigator.clipboard.writeText(url);
      setMessage(`공유 링크를 복사했습니다 (${url.length.toLocaleString()}자)`);
    } catch {
      setMessage("링크를 클립보드에 넣지 못했습니다");
    }
  };

  // Copy and paste go through the system clipboard as JSON.
  useEffect(() => {
    const onCopy = (event: ClipboardEvent, cut: boolean) => {
      const { doc: current, selection: picked } = latest.current;
      if (isTyping(event.target) || !picked.length) return;
      if (window.getSelection()?.toString()) return;
      const closure = copyClosure(current.objects, picked);
      event.clipboardData?.setData(
        "text/plain",
        clipboardText(closure, picked),
      );
      event.preventDefault();
      if (cut) dispatch({ type: "remove", ids: picked });
      setMessage(`${picked.length}개를 ${cut ? "잘라 냈습니다" : "복사했습니다"}`);
    };
    const copy = (event: ClipboardEvent) => onCopy(event, false);
    const cut = (event: ClipboardEvent) => onCopy(event, true);
    const paste = (event: ClipboardEvent) => {
      if (isTyping(event.target)) return;
      const pasted = parseClipboard(
        event.clipboardData?.getData("text/plain") ?? "",
      );
      if (!pasted?.objects.length) return;
      event.preventDefault();
      dispatch({ type: "paste", objects: pasted.objects, roots: pasted.roots });
    };
    document.addEventListener("copy", copy);
    document.addEventListener("cut", cut);
    document.addEventListener("paste", paste);
    return () => {
      document.removeEventListener("copy", copy);
      document.removeEventListener("cut", cut);
      document.removeEventListener("paste", paste);
    };
  }, []);

  // Keyboard shortcuts read the latest state through a ref.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const {
        doc: current,
        selection: picked,
        snap: grid,
        scene: built,
      } = latest.current;
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
        if (picked.length) dispatch({ type: "duplicate", ids: picked });
      } else if (mod && key === "a") {
        event.preventDefault();
        dispatch({ type: "selectAll" });
      } else if (mod || event.altKey) {
        return;
      } else if ((key === "delete" || key === "backspace") && picked.length) {
        event.preventDefault();
        dispatch({ type: "remove", ids: picked });
      } else if (key === "escape") {
        if (dialog) setDialog(null);
        else dispatch({ type: "select", ids: [] });
      } else if (key === "w") setGizmo("move");
      else if (key === "e") setGizmo("rotate");
      else if (key === "r") setGizmo("scale");
      else if (key === "f") frame(selectionBounds(picked, built));
      else if (key === "h" && picked.length) {
        const hide = !picked.every(
          (id) => current.objects.find((o) => o.id === id)?.hidden,
        );
        dispatch({
          type: "updateMany",
          patches: picked.map((id) => ({ id, patch: { hidden: hide } })),
        });
      } else if (key === "0") setView("iso");
      else if (key === "1") setView("front");
      else if (key === "3") setView("side");
      else if (key === "7") setView("top");
      else if (key === "5")
        setProjection((p) =>
          p === "orthographic" ? "perspective" : "orthographic",
        );
      else if (key.startsWith("arrow") && picked.length) {
        const targets = transformTargets(current.objects, picked);
        if (!targets.length) return;
        event.preventDefault();
        const d = grid || 0.1;
        const delta: Tuple3 =
          key === "arrowleft"
            ? [-d, 0, 0]
            : key === "arrowright"
              ? [d, 0, 0]
              : event.shiftKey
                ? [0, key === "arrowup" ? d : -d, 0]
                : [0, 0, key === "arrowup" ? -d : d];
        dispatch({ type: "updateMany", patches: movePatches(targets, delta) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, frame]);

  const single =
    selection.length === 1
      ? objects.find((object) => object.id === selection[0])
      : undefined;
  const selectionText = single
    ? `${KIND_NAMES[single.kind]} · ${single.name}${
        single.kind === "point"
          ? ` · (${(scene.points.get(single.id) ?? single.position)
              .map((v) => formatNumber(v, 2))
              .join(", ")})`
          : isPositioned(single)
            ? ` · (${single.position.map((v) => formatNumber(v, 2)).join(", ")})`
            : ""
      }${scene.consumed.has(single.id) ? " · 불리언 재료" : ""}`
    : selection.length > 1
      ? `${selection.length}개 고름 · Shift+누르기로 더하거나 빼기`
      : "선택 없음 · 도형을 누르거나 목록에서 고르세요";

  const exportItems: ExportItem[] = [
    {
      id: "svg",
      label: "SVG",
      hint: "선 그림 그대로, 라벨 포함",
      icon: <Download size={15} />,
      run: exportSvg,
    },
    {
      id: "png",
      label: "PNG",
      hint: "2배 해상도 그림, 흰 바탕",
      icon: <ImageDown size={15} />,
      run: () => void exportPng(),
    },
    {
      id: "json",
      label: "장면 JSON",
      hint: "다시 열 수 있는 파일, 시점 포함",
      icon: <FileDown size={15} />,
      run: saveJson,
    },
    {
      id: "link",
      label: "공유 링크 복사",
      hint: "주소 하나에 장면과 시점을 담습니다",
      icon: <Link2 size={15} />,
      run: () => void copyLink(),
    },
    {
      id: "code",
      label: "TypeScript 코드",
      hint: "라이브러리로 같은 그림을 그리는 코드",
      icon: <Code2 size={15} />,
      run: () => setDialog("code"),
    },
  ];

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
          onFocus={() => {
            titleEdit.current = false;
          }}
          onChange={(event) => {
            // One undo step per edit, taken on the first keystroke.
            if (!titleEdit.current) dispatch({ type: "checkpoint" });
            titleEdit.current = true;
            dispatch({
              type: "title",
              title: event.target.value,
              transient: true,
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
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
          <ThemeButton className="ed-icon-btn" />
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
          <ExportMenu items={exportItems} />
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
        <aside className="ed-left" aria-label="만들기와 장면 목록">
          <MemoPalette onAdd={addShape} ctx={ctx} dispatch={dispatch} />
          <MemoOutliner
            objects={objects}
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
                { value: "scale", label: "크기", title: "크기 (R)" },
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
                { value: "orthographic", label: "직교", title: "직교 (5)" },
                { value: "perspective", label: "원근", title: "원근 (5)" },
              ]}
              onChange={setProjection}
            />
            <button
              type="button"
              className="tool-btn"
              onClick={() => frame(selectionBounds(selection, scene))}
              title="고른 도형에 맞춤 (F)"
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
              끌기 회전 · Shift 끌기 이동 · Shift+누르기 여럿 · W·E·R
              이동·회전·크기 · F 맞춤 · ⌘C·⌘V 복사
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
            ctx={ctx}
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
                          loadScene(template.create());
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
  scene: BuiltScene;
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
