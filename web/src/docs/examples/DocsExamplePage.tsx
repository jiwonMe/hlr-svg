import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";

import { Camera } from "@hlr/camera/camera.js";
import type { DemoCase } from "@hlr/demo/types.js";

import {
  orbitFromCamera,
  orbitPosition,
  type OrbitState,
  clamp,
} from "../../runtime/orbit";
import { useRafLoop } from "../../runtime/useRaf";
import { useFrameState } from "../../runtime/useFrameState";
import { useDemoSvg } from "../../runtime/useDemoSvg";
import {
  SurfaceDiagram,
  type SurfaceDiagramHandle,
} from "../../components/SurfaceDiagram";
import { ExamProvider, Question, type QuestionSpec } from "../../exam/exam";
import { LEAD_QUESTION, PAPER_QUESTIONS } from "../../exam/questions";
import { lineRenderOptions, type HiddenLineMode } from "../../exam/lineStyle";
import { CodeWindow } from "../../site/Code";
import { useSurfaceTones } from "../../site/theme";
import {
  EXAMPLES,
  getExampleById,
  getGithubUrl,
  type ExampleId,
} from "./examplesRegistry";
import { buildExampleModel, DEFAULT_EXAMPLE_PARAMS } from "./exampleFigures";
import { MeshImportExample } from "./MeshImportExample";
import { useElementSize } from "./useElementSize";
import "./examples.css";

type Locale = "ko-kr" | "en-us";
type Projection = "perspective" | "isometric";

const ISO_AZ = Math.PI / 4;
const ISO_POLAR = Math.acos(1 / Math.sqrt(3));
const TANGENT_SPHERES_UNLIT_IDS = ["beta"] as const;
const QUESTIONS: readonly QuestionSpec[] = [...PAPER_QUESTIONS, LEAD_QUESTION];

type DragState = { x: number; y: number; az: number; pol: number; id: number };

export const EXAMPLE_TEXT = {
  "ko-kr": {
    gallery: "예제 갤러리",
    question: (n: number) => `${n}번 문항`,
    example: (n: number) => `예제 ${n}`,
    hint: "끌어서 회전 · 휠로 확대 · 눌러서 도형 선택",
    github: "GitHub 코드",
    reset: "처음 시점",
    play: "회전",
    stop: "멈춤",
    projection: "투영",
    perspective: "원근",
    isometric: "등각",
    hiddenLines: "가려진 선",
    modes: { dashed: "점선", removed: "지우기", solid: "실선" },
    regen: "다시 만들기",
    seed: "seed",
    planeTilt: "평면 기울기",
    selected: "선택",
    deselect: "선택 해제",
    lighting: "조명 채색",
    lightAzimuth: "광원 방위각",
    lightElevation: "광원 높이",
    ambient: "주변광",
    copySvg: "SVG 복사",
    copiedSvg: "복사했습니다",
    copyFailed: "SVG를 복사하지 못했습니다. 파일로 저장해 주세요.",
    exportSvg: "SVG 저장",
    paper: "이 그림이 나온 문항",
    paperNote: "답을 고르면 바로 채점합니다.",
    solution: "풀이",
    drawing: "그림",
    code: "코드",
    codeNote: "이 예제를 그리는 전체 스크립트입니다.",
  },
  "en-us": {
    gallery: "Example gallery",
    question: (n: number) => `Question ${n}`,
    example: (n: number) => `Example ${n}`,
    hint: "Drag to rotate · Wheel to zoom · Click to select",
    github: "GitHub code",
    reset: "Reset view",
    play: "Spin",
    stop: "Stop",
    projection: "Projection",
    perspective: "Perspective",
    isometric: "Isometric",
    hiddenLines: "Hidden lines",
    modes: { dashed: "Dashed", removed: "Removed", solid: "Solid" },
    regen: "Regenerate",
    seed: "seed",
    planeTilt: "Plane tilt",
    selected: "Selected",
    deselect: "Deselect",
    lighting: "Lighting",
    lightAzimuth: "Light azimuth",
    lightElevation: "Light elevation",
    ambient: "Ambient light",
    copySvg: "Copy SVG",
    copiedSvg: "Copied",
    copyFailed: "Could not copy SVG. Download the file instead.",
    exportSvg: "Download SVG",
    paper: "The question this figure comes from",
    paperNote: "Pick an answer to grade it.",
    solution: "Solution",
    drawing: "Figure",
    code: "Code",
    codeNote: "The complete script that draws this example.",
  },
} as const;

/** Exam pill text for an example: its question number, or a running number. */
export function exampleLabel(id: ExampleId, lang: Locale): string {
  const t = EXAMPLE_TEXT[lang];
  const spec = getExampleById(id);
  if (spec?.question) return t.question(spec.question);
  const basic = EXAMPLES.filter((x) => x.kind === "basic");
  return t.example(basic.findIndex((x) => x.id === id) + 1);
}

export function DocsExamplePage(): React.ReactElement {
  const { locale, exampleId } = useParams<{
    locale?: string;
    exampleId?: string;
  }>();
  const lang: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : "en-us";
  const ex = exampleId ? getExampleById(exampleId) : undefined;
  if (!ex) return <Navigate to={`/docs/${lang}/examples`} replace />;

  const info = ex.text[lang];
  const githubUrl = getGithubUrl(ex.githubPath);
  if (ex.id === "mesh-import") {
    return (
      <MeshImportExample
        lang={lang}
        info={info}
        githubUrl={githubUrl}
        label={exampleLabel(ex.id, lang)}
        code={ex.code}
      />
    );
  }

  return <InteractiveExample key={ex.id} ex={ex} lang={lang} />;
}

function InteractiveExample({
  ex,
  lang,
}: {
  ex: NonNullable<ReturnType<typeof getExampleById>>;
  lang: Locale;
}): React.ReactElement {
  const t = EXAMPLE_TEXT[lang];
  const info = ex.text[lang];
  const githubUrl = getGithubUrl(ex.githubPath);
  const question = QUESTIONS.find((q) => q.no === ex.question);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<SurfaceDiagramHandle | null>(null);
  const surfaceTones = useSurfaceTones();
  const { width, height } = useElementSize(wrapRef);

  // per-example interactive params
  const [seed, setSeed] = useState(DEFAULT_EXAMPLE_PARAMS.seed);
  const [planeTilt, setPlaneTilt] = useState(DEFAULT_EXAMPLE_PARAMS.planeTilt);
  const [hiddenLines, setHiddenLines] = useState<HiddenLineMode>("dashed");
  // Exam figures read best as pure line work; shading suits the others.
  const [lighting, setLighting] = useState(ex.kind === "basic");
  const [lightAzimuth, setLightAzimuth] = useState(-35);
  const [lightElevation, setLightElevation] = useState(45);
  const [ambient, setAmbient] = useState(0.28);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const model = useMemo(
    () =>
      buildExampleModel(
        ex.id,
        width > 0 ? width : 900,
        height > 0 ? height : 560,
        { seed, planeTilt },
      ),
    [ex.id, width, height, seed, planeTilt],
  );
  const baseDemo = model.demo;

  const baseOrbit = useMemo(
    () => orbitFromCamera(baseDemo.camera.position, baseDemo.camera.target),
    [baseDemo],
  );
  const [orbit, orbitInput] = useFrameState<OrbitState>(baseOrbit);
  const initialProjection: Projection =
    baseDemo.camera.kind === "orthographic" ? "isometric" : "perspective";
  const [projection, setProjection] = useState<Projection>(initialProjection);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  // animation
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    orbitInput.reset(baseOrbit);
    dragRef.current = null;
    setDragging(false);
    setProjection(initialProjection);
    setPlaying(false);
  }, [baseOrbit, initialProjection, orbitInput]);

  useRafLoop(playing, (elapsed) => {
    orbitInput.reset((o) => ({ ...o, azimuth: o.azimuth + 0.72 * elapsed }));
  });

  const camera = useMemo(() => {
    const pos = orbitPosition(orbit);
    const aspect = Math.max(1e-6, baseDemo.width / baseDemo.height);

    if (projection === "perspective") {
      return Camera.from({
        kind: "perspective",
        position: pos,
        target: orbit.target,
        up: baseDemo.camera.up,
        fovYRad:
          baseDemo.camera.fovYRad ??
          (baseDemo.camera.halfHeight
            ? 2 * Math.atan(baseDemo.camera.halfHeight / baseOrbit.radius)
            : (55 * Math.PI) / 180),
        aspect,
        near: baseDemo.camera.near,
        far: baseDemo.camera.far,
      });
    }

    return Camera.from({
      kind: "orthographic",
      position: pos,
      target: orbit.target,
      up: baseDemo.camera.up,
      halfHeight: clamp(
        0.2,
        ((baseDemo.camera.halfHeight ?? baseOrbit.radius * 0.55) *
          orbit.radius) /
          baseOrbit.radius,
        30,
      ),
      aspect,
      near: baseDemo.camera.near,
      far: baseDemo.camera.far,
    });
  }, [baseDemo, baseOrbit.radius, orbit, projection]);

  const runtimeDemo = useMemo<DemoCase>(
    () => ({ ...baseDemo, camera }),
    [baseDemo, camera],
  );

  // Lighting only changes the surface layer; expensive HLR stays memoized.
  const renderedLines = useDemoSvg(
    runtimeDemo,
    lineRenderOptions(hiddenLines, dragging || playing),
  );
  const lineSvg = useMemo(() => {
    const annotations = model.annotate(
      camera,
      runtimeDemo.width,
      runtimeDemo.height,
    );
    if (!annotations) return renderedLines;
    return renderedLines.replace(/<\/svg>\s*$/, () => `${annotations}</svg>`);
  }, [camera, model, renderedLines, runtimeDemo.width, runtimeDemo.height]);

  const lightSettings = useMemo(
    () => ({
      enabled: lighting,
      azimuth: lightAzimuth,
      elevation: lightElevation,
      ambient,
    }),
    [lighting, lightAzimuth, lightElevation, ambient],
  );

  const copySvg = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        diagramRef.current?.toSvg() ?? lineSvg,
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }, [lineSvg]);

  const downloadSvg = useCallback(() => {
    const completeSvg = diagramRef.current?.toSvg() ?? lineSvg;
    const url = URL.createObjectURL(
      new Blob([completeSvg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ex.id}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [ex.id, lineSvg]);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 3000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const azimuth = drag.az - (event.clientX - drag.x) * 0.0075;
      const polar = clamp(
        0.05,
        drag.pol - (event.clientY - drag.y) * 0.0075,
        Math.PI - 0.05,
      );
      const latest = orbitInput.current();
      if (latest.azimuth === azimuth && latest.polar === polar) return;
      orbitInput.schedule((current) => ({ ...current, azimuth, polar }));
    },
    [orbitInput],
  );
  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.id !== event.pointerId) return;
      if (event.type === "pointerup") handlePointerMove(event);
      orbitInput.flush();
      dragRef.current = null;
      setDragging(false);
    },
    [handlePointerMove, orbitInput],
  );
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const current = orbitInput.current();
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        az: current.azimuth,
        pol: current.polar,
        id: event.pointerId,
      };
      setDragging(true);
      setPlaying(false);
    },
    [orbitInput],
  );
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY === 0) return;
      const factor = Math.exp(event.deltaY * 0.0012);
      orbitInput.schedule((current) => {
        const radius = clamp(0.2, current.radius * factor, 50);
        return radius === current.radius ? current : { ...current, radius };
      });
    },
    [orbitInput],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [runtimeDemo.primitives]);

  return (
    <div className="example">
      <ExampleHeader
        lang={lang}
        label={exampleLabel(ex.id, lang)}
        info={info}
        githubUrl={githubUrl}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void copySvg()}
        >
          {copyStatus === "copied" ? t.copiedSvg : t.copySvg}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={downloadSvg}
        >
          {t.exportSvg}
        </button>
      </ExampleHeader>

      <section className="example-stage" aria-label={info.title}>
        <div className="example-toolbar">
          <div className="example-toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => {
                orbitInput.reset(baseOrbit);
                setProjection(initialProjection);
                setPlaying(false);
                dragRef.current = null;
                setDragging(false);
              }}
            >
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
              {t.reset}
            </button>
            <button
              type="button"
              className="tool-btn"
              aria-pressed={playing}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <Pause aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <Play aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
              {playing ? t.stop : t.play}
            </button>
            <div className="seg seg-sm" role="group" aria-label={t.projection}>
              <button
                type="button"
                aria-pressed={projection === "perspective"}
                onClick={() => setProjection("perspective")}
              >
                {t.perspective}
              </button>
              <button
                type="button"
                aria-pressed={projection === "isometric"}
                onClick={() => {
                  setProjection("isometric");
                  setPlaying(false);
                  orbitInput.reset((o) => ({
                    ...o,
                    azimuth: ISO_AZ,
                    polar: ISO_POLAR,
                  }));
                }}
              >
                {t.isometric}
              </button>
            </div>
          </div>
          <div className="example-toolbar-group">
            <span className="seg-label">{t.hiddenLines}</span>
            <div className="seg seg-sm" role="group" aria-label={t.hiddenLines}>
              {(Object.keys(t.modes) as HiddenLineMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={hiddenLines === mode}
                  onClick={() => setHiddenLines(mode)}
                >
                  {t.modes[mode]}
                </button>
              ))}
            </div>
            {ex.id === "random-primitives" && (
              <span className="tool-field">
                <label>
                  <span>{t.seed}</span>
                  <input
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setSeed((s) => s + 1)}
                >
                  {t.regen}
                </button>
              </span>
            )}
            {ex.id === "conic-section" && (
              <label className="tool-field">
                <span>{t.planeTilt}</span>
                <input
                  type="range"
                  min={-0.35}
                  max={0.55}
                  step={0.01}
                  value={planeTilt}
                  onChange={(e) => setPlaneTilt(Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </div>

        <div ref={wrapRef} className="example-canvas">
          <SurfaceDiagram
            ref={diagramRef}
            primitives={runtimeDemo.primitives}
            camera={camera}
            width={runtimeDemo.width}
            height={runtimeDemo.height}
            lineSvg={lineSvg}
            lighting={lightSettings}
            unlitPrimitiveIds={
              ex.id === "tangent-spheres"
                ? TANGENT_SPHERES_UNLIT_IDS
                : undefined
            }
            selectedId={selectedId}
            tones={surfaceTones}
            onSelect={setSelectedId}
            ariaLabel={`${info.title}. ${t.hint}`}
            interactive={dragging || playing}
            className="example-surface"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />
          <p className="example-hint" aria-hidden="true">
            {t.hint}
          </p>
          {selectedId && (
            <div className="example-selected">
              <span>
                {t.selected} · <code>{selectedId}</code>
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label={t.deselect}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="example-light">
          <label className="tool-check">
            <input
              type="checkbox"
              checked={lighting}
              onChange={(e) => setLighting(e.target.checked)}
            />
            {t.lighting}
          </label>
          <label className="tool-range">
            <span>{t.lightAzimuth}</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={lightAzimuth}
              onChange={(e) => setLightAzimuth(Number(e.target.value))}
              disabled={!lighting}
            />
            <output>{lightAzimuth}°</output>
          </label>
          <label className="tool-range">
            <span>{t.lightElevation}</span>
            <input
              type="range"
              min={-85}
              max={85}
              step={1}
              value={lightElevation}
              onChange={(e) => setLightElevation(Number(e.target.value))}
              disabled={!lighting}
            />
            <output>{lightElevation}°</output>
          </label>
          <label className="tool-range">
            <span>{t.ambient}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={ambient}
              onChange={(e) => setAmbient(Number(e.target.value))}
              disabled={!lighting}
            />
            <output>{Math.round(ambient * 100)}%</output>
          </label>
          <span role="status" className="example-status">
            {copyStatus === "failed" ? t.copyFailed : ""}
          </span>
        </div>
      </section>

      {question && (
        <section
          className="example-paper"
          aria-labelledby="example-paper-title"
        >
          <div className="example-section-head">
            <h2 id="example-paper-title">{t.paper}</h2>
            <p>{t.paperNote}</p>
          </div>
          <div className="example-paper-body">
            <ExamProvider>
              <Question spec={question} showFigure={false} />
            </ExamProvider>
            <dl className="example-notes">
              <div>
                <dt>{t.solution}</dt>
                <dd>{question.solution}</dd>
              </div>
              <div>
                <dt>{t.drawing}</dt>
                <dd>{question.drawing}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <ExampleCode
        title={t.code}
        note={t.codeNote}
        file={ex.githubPath.split("/").pop() ?? "example.ts"}
        code={ex.code}
        lang={lang}
      />
    </div>
  );
}

export function ExampleHeader({
  lang,
  label,
  info,
  githubUrl,
  children,
}: {
  lang: Locale;
  label: string;
  info: { title: string; description: string; tags: readonly string[] };
  githubUrl: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const t = EXAMPLE_TEXT[lang];
  return (
    <header className="example-head">
      <nav className="example-crumbs" aria-label={t.gallery}>
        <Link to={`/docs/${lang}/examples`}>
          <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
          {t.gallery}
        </Link>
      </nav>
      <div className="example-head-row">
        <div className="example-head-text">
          <p className="exam-pill">
            <span className="exam-pill-period">{label}</span>
            <span>{info.tags.join(" · ")}</span>
          </p>
          <h1 className="docs-title">{info.title}</h1>
          <p className="docs-lede">{info.description}</p>
        </div>
        <div className="example-actions">
          <a
            className="btn btn-secondary btn-sm"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.github}
            <ArrowUpRight aria-hidden="true" size={13} strokeWidth={1.8} />
          </a>
          {children}
        </div>
      </div>
    </header>
  );
}

export function ExampleCode({
  title,
  note,
  file,
  code,
  lang,
}: {
  title: string;
  note: string;
  file: string;
  code: string;
  lang: Locale;
}): React.ReactElement {
  return (
    <section className="example-code" aria-labelledby="example-code-title">
      <div className="example-section-head">
        <h2 id="example-code-title">{title}</h2>
        <p>{note}</p>
      </div>
      <CodeWindow title={file} code={code.trim()} locale={lang} />
    </section>
  );
}

export function getAllExampleIds(): ExampleId[] {
  return EXAMPLES.map((x) => x.id);
}
