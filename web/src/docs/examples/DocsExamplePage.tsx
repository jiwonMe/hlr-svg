import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { cn } from "../../lib/utils";

import { Camera } from "@hlr/camera/camera.js";
import {
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "@hlr/curves/builders.js";
import type { DemoCase } from "@hlr/demo/types.js";
import {
  buildSpherePlaneSectionsDemo,
  renderSpherePlaneSectionsAnnotations,
  SPHERE_PLANE_SECTIONS_STYLE,
} from "@hlr/demo/spherePlaneSections.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";

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
  EXAMPLES,
  getExampleById,
  getGithubUrl,
  type ExampleId,
} from "./examplesRegistry";
import { MeshImportExample } from "./MeshImportExample";
import { useElementSize } from "./useElementSize";
import {
  SurfaceDiagram,
  type SurfaceDiagramHandle,
} from "../../components/SurfaceDiagram";

type Locale = "ko-kr" | "en-us";

type Projection = "perspective" | "isometric";

const ISO_AZ = Math.PI / 4;
const ISO_POLAR = Math.acos(1 / Math.sqrt(3));
const RENDER_OPTIONS = {
  background: false,
  svgStyle: {
    strokeWidthVisible: 2,
    strokeWidthHidden: 2,
    dashArrayHidden: "6 6",
    strokeVisible: "#000000",
    strokeHidden: "#000000",
    opacityHidden: 0.4,
  },
};
const SPHERE_SECTIONS_RENDER_OPTIONS = {
  background: false,
  svgStyle: SPHERE_PLANE_SECTIONS_STYLE,
};
type DragState = { x: number; y: number; az: number; pol: number; id: number };

const TEXT = {
  "ko-kr": {
    back: "Examples로",
    hint: "드래그: 회전 · 휠: 줌 · 클릭: 객체 선택",
    github: "GitHub 코드",
    reset: "리셋",
    play: "재생",
    stop: "정지",
    perspective: "Perspective",
    isometric: "Isometric",
    regen: "재생성",
    seed: "seed",
    planeTilt: "plane tilt",
    selected: "선택",
    deselect: "선택 해제",
    lighting: "조명 채색",
    lightAzimuth: "광원 방위각",
    lightElevation: "광원 높이",
    ambient: "주변광",
    copySvg: "SVG 복사",
    copiedSvg: "SVG 복사됨",
    copyFailed: "SVG를 복사하지 못했습니다. 파일로 저장해 주세요.",
    exportSvg: "SVG 저장",
  },
  "en-us": {
    back: "Back to Examples",
    hint: "Drag: rotate · Wheel: zoom · Click: select object",
    github: "GitHub code",
    reset: "Reset",
    play: "Play",
    stop: "Stop",
    perspective: "Perspective",
    isometric: "Isometric",
    regen: "Regenerate",
    seed: "seed",
    planeTilt: "plane tilt",
    selected: "Selected",
    deselect: "Deselect",
    lighting: "Lighting",
    lightAzimuth: "Light azimuth",
    lightElevation: "Light elevation",
    ambient: "Ambient light",
    copySvg: "Copy SVG",
    copiedSvg: "SVG copied",
    copyFailed: "Could not copy SVG. Download the file instead.",
    exportSvg: "Download SVG",
  },
} as const;

export function DocsExamplePage(): React.ReactElement {
  const { locale, exampleId } = useParams<{
    locale?: string;
    exampleId?: string;
  }>();
  const lang: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : "en-us";
  const ex = exampleId ? getExampleById(exampleId) : undefined;
  if (!ex) {
    return <Navigate to={`/docs/${lang}/examples`} replace />;
  }

  const info = ex.text[lang];
  const githubUrl = getGithubUrl(ex.githubPath);
  if (ex.id === "mesh-import") {
    return <MeshImportExample lang={lang} info={info} githubUrl={githubUrl} />;
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
  const t = TEXT[lang];
  const info = ex.text[lang];
  const githubUrl = getGithubUrl(ex.githubPath);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<SurfaceDiagramHandle | null>(null);
  const { width, height } = useElementSize(wrapRef);

  // per-example interactive params
  const [seed, setSeed] = useState(1337);
  const [planeTilt, setPlaneTilt] = useState(0.25);
  const [lighting, setLighting] = useState(ex.id !== "sphere-plane-sections");
  const [lightAzimuth, setLightAzimuth] = useState(-35);
  const [lightElevation, setLightElevation] = useState(45);
  const [ambient, setAmbient] = useState(0.28);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const baseDemo = useMemo<DemoCase>(() => {
    const w = width > 0 ? width : 900;
    const h = height > 0 ? height : 560;

    if (ex.id === "simple-primitives") return buildSimplePrimitivesDemo(w, h);
    if (ex.id === "random-primitives")
      return buildRandomPrimitivesDemo(w, h, seed);
    if (ex.id === "sphere-plane-sections")
      return buildSpherePlaneSectionsDemo(w, h);
    return buildConicSectionDemo(w, h, planeTilt);
  }, [ex.id, width, height, seed, planeTilt]);

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
    ex.id === "sphere-plane-sections"
      ? SPHERE_SECTIONS_RENDER_OPTIONS
      : RENDER_OPTIONS,
  );
  const lineSvg = useMemo(() => {
    if (ex.id !== "sphere-plane-sections") return renderedLines;
    const annotations = renderSpherePlaneSectionsAnnotations(
      camera,
      runtimeDemo.width,
      runtimeDemo.height,
    );
    return renderedLines.replace(/<\/svg>\s*$/, () => `${annotations}</svg>`);
  }, [camera, ex.id, renderedLines, runtimeDemo.width, runtimeDemo.height]);

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
      const azimuth = drag.az + (event.clientX - drag.x) * 0.0075;
      const polar = clamp(
        0.05,
        drag.pol + (event.clientY - drag.y) * 0.0075,
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
    <div
      className={cn(
        // 전체
        "w-full",
        // 패딩
        "px-6 py-6",
        // 오버플로우
        "overflow-x-hidden",
      )}
    >
      <header
        className={cn(
          // 레이아웃
          "flex flex-col gap-3",
          // 간격
          "mb-5",
        )}
      >
        <div
          className={cn(
            // 레이아웃
            "flex items-start justify-between gap-4",
          )}
        >
          <div className={cn("min-w-0")}>
            <Link
              to={`/docs/${lang}/examples`}
              className={cn(
                // 타이포그래피
                "text-sm font-medium",
                // 색상
                "text-[hsl(152,69%,35%)]",
                // 호버
                "hover:text-[hsl(152,69%,25%)]",
                "hover:underline",
                "underline-offset-4",
              )}
            >
              {t.back}
            </Link>
            <h1
              className={cn(
                // 타이포그래피
                "text-2xl font-semibold tracking-tight",
                // 색상
                "text-[hsl(220,9%,18%)]",
                // 간격
                "mt-2",
              )}
            >
              {info.title}
            </h1>
            <p
              className={cn(
                // 타이포그래피
                "text-[15px] leading-7",
                // 색상
                "text-[hsl(220,9%,35%)]",
                // 간격
                "mt-2",
              )}
            >
              {info.description}
            </p>
          </div>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              // 타이포그래피
              "text-sm font-medium",
              // 색상
              "text-[hsl(152,69%,35%)]",
              // 호버
              "hover:text-[hsl(152,69%,25%)]",
              "hover:underline",
              "underline-offset-4",
              // 줄바꿈 방지
              "shrink-0",
            )}
          >
            {t.github}
          </a>
        </div>
      </header>

      {/* Viewer - Full width */}
      <section
        className={cn(
          // 카드
          "rounded-lg",
          "border border-[hsl(220,13%,91%)]",
          "bg-white",
          "overflow-hidden",
          // 최소 너비
          "min-w-0",
        )}
      >
        {/* Toolbar */}
        <div
          className={cn(
            // 레이아웃
            "flex flex-wrap items-center justify-between gap-3",
            // 패딩
            "px-4 py-3",
            // 보더
            "border-b border-[hsl(220,13%,91%)]",
            // 배경
            "bg-[hsl(240,4.8%,95.9%)]",
          )}
        >
          <div
            className={cn(
              // 타이포그래피
              "text-xs",
              // 색상
              "text-[hsl(220,9%,46%)]",
            )}
          >
            {t.hint}
          </div>

          <div className={cn("flex flex-wrap items-center justify-end gap-2")}>
            <button
              type="button"
              onClick={() => {
                orbitInput.reset(baseOrbit);
                setProjection(initialProjection);
                setPlaying(false);
                dragRef.current = null;
                setDragging(false);
              }}
              className={cn(
                // 버튼
                "h-9 px-3",
                "rounded-md",
                "border border-[hsl(220,13%,91%)]",
                "bg-white",
                // 타이포그래피
                "text-sm font-medium",
                // 호버
                "hover:bg-[hsl(220,14%,96%)]",
                // 트랜지션
                "transition-colors",
              )}
            >
              {t.reset}
            </button>

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className={cn(
                // 버튼
                "h-9 px-3",
                "rounded-md",
                "border border-[hsl(220,13%,91%)]",
                "bg-white",
                // 타이포그래피
                "text-sm font-medium",
                // 호버
                "hover:bg-[hsl(220,14%,96%)]",
                // 트랜지션
                "transition-colors",
              )}
            >
              {playing ? t.stop : t.play}
            </button>

            <div className={cn("flex items-center gap-1")}>
              <button
                type="button"
                aria-pressed={projection === "perspective"}
                onClick={() => setProjection("perspective")}
                className={cn(
                  // 버튼
                  "h-9 px-3",
                  "rounded-md",
                  "border border-[hsl(220,13%,91%)]",
                  // 상태
                  projection === "perspective"
                    ? "bg-[hsl(152,69%,97%)] text-[hsl(152,69%,35%)]"
                    : "bg-white text-[hsl(220,9%,18%)]",
                  // 타이포그래피
                  "text-sm font-medium",
                  // 호버
                  "hover:bg-[hsl(220,14%,96%)]",
                  // 트랜지션
                  "transition-colors",
                )}
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
                className={cn(
                  // 버튼
                  "h-9 px-3",
                  "rounded-md",
                  "border border-[hsl(220,13%,91%)]",
                  // 상태
                  projection === "isometric"
                    ? "bg-[hsl(152,69%,97%)] text-[hsl(152,69%,35%)]"
                    : "bg-white text-[hsl(220,9%,18%)]",
                  // 타이포그래피
                  "text-sm font-medium",
                  // 호버
                  "hover:bg-[hsl(220,14%,96%)]",
                  // 트랜지션
                  "transition-colors",
                )}
              >
                {t.isometric}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void copySvg()}
              className={cn(
                "h-9 rounded-md border border-[hsl(220,13%,91%)] bg-white px-3",
                "text-sm font-medium hover:bg-[hsl(220,14%,96%)] transition-colors",
              )}
            >
              {copyStatus === "copied" ? t.copiedSvg : t.copySvg}
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className={cn(
                "h-9 rounded-md border border-[hsl(220,13%,91%)] bg-white px-3",
                "text-sm font-medium hover:bg-[hsl(220,14%,96%)] transition-colors",
              )}
            >
              {t.exportSvg}
            </button>

            {/* example-specific */}
            {ex.id === "random-primitives" ? (
              <div className={cn("flex items-center gap-2")}>
                <label className={cn("text-xs text-[hsl(220,9%,46%)]")}>
                  {t.seed}
                </label>
                <input
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                  className={cn(
                    // 입력
                    "h-9 w-24",
                    "rounded-md",
                    "border border-[hsl(220,13%,91%)]",
                    "bg-white",
                    "px-2",
                    // 타이포그래피
                    "text-sm",
                    // 포커스
                    "focus:outline-none focus:ring-2 focus:ring-[hsl(152,69%,41%)]",
                  )}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={() => setSeed((s) => s + 1)}
                  className={cn(
                    // 버튼
                    "h-9 px-3",
                    "rounded-md",
                    "border border-[hsl(220,13%,91%)]",
                    "bg-white",
                    // 타이포그래피
                    "text-sm font-medium",
                    // 호버
                    "hover:bg-[hsl(220,14%,96%)]",
                    // 트랜지션
                    "transition-colors",
                  )}
                >
                  {t.regen}
                </button>
              </div>
            ) : null}

            {ex.id === "conic-section" ? (
              <div className={cn("flex items-center gap-2")}>
                <label className={cn("text-xs text-[hsl(220,9%,46%)]")}>
                  {t.planeTilt}
                </label>
                <input
                  type="range"
                  min={-0.35}
                  max={0.55}
                  step={0.01}
                  value={planeTilt}
                  onChange={(e) => setPlaneTilt(Number(e.target.value))}
                  className={cn(
                    // 슬라이더
                    "w-40",
                  )}
                />
              </div>
            ) : null}

            {/* 선택된 객체 표시 */}
            {selectedId && (
              <div
                className={cn(
                  // 레이아웃
                  "flex items-center gap-2",
                  // 패딩
                  "px-3 py-1.5",
                  // 보더
                  "rounded-md",
                  "border border-[hsl(152,69%,41%)]",
                  // 배경
                  "bg-[hsl(152,69%,97%)]",
                )}
              >
                <span
                  className={cn(
                    // 타이포그래피
                    "text-sm font-medium",
                    // 색상
                    "text-[hsl(152,69%,35%)]",
                  )}
                >
                  {t.selected}: {selectedId}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className={cn(
                    // 버튼
                    "px-1.5 py-0.5",
                    "rounded",
                    // 타이포그래피
                    "text-xs",
                    // 색상
                    "text-[hsl(152,69%,35%)]",
                    // 호버
                    "hover:bg-[hsl(152,69%,90%)]",
                    // 트랜지션
                    "transition-colors",
                  )}
                  title={t.deselect}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[hsl(220,13%,91%)] px-4 py-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={lighting}
              onChange={(e) => setLighting(e.target.checked)}
              className="accent-[hsl(152,69%,35%)]"
            />
            {t.lighting}
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span>{t.lightAzimuth}</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={lightAzimuth}
              onChange={(e) => setLightAzimuth(Number(e.target.value))}
              disabled={!lighting}
              className="w-28 accent-[hsl(152,69%,35%)] disabled:opacity-40"
            />
            <output className="w-10 text-right tabular-nums">
              {lightAzimuth}°
            </output>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span>{t.lightElevation}</span>
            <input
              type="range"
              min={-85}
              max={85}
              step={1}
              value={lightElevation}
              onChange={(e) => setLightElevation(Number(e.target.value))}
              disabled={!lighting}
              className="w-28 accent-[hsl(152,69%,35%)] disabled:opacity-40"
            />
            <output className="w-10 text-right tabular-nums">
              {lightElevation}°
            </output>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span>{t.ambient}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={ambient}
              onChange={(e) => setAmbient(Number(e.target.value))}
              disabled={!lighting}
              className="w-24 accent-[hsl(152,69%,35%)] disabled:opacity-40"
            />
            <output className="w-9 text-right tabular-nums">
              {Math.round(ambient * 100)}%
            </output>
          </label>
          <span role="status" className="text-xs text-[hsl(220,9%,46%)]">
            {copyStatus === "failed" ? t.copyFailed : ""}
          </span>
        </div>

        {/* Interactive SVG area */}
        <div
          ref={wrapRef}
          className={cn(
            // 레이아웃
            "w-full",
            // 높이 (전체 화면 높이에서 헤더/툴바 제외)
            "h-[calc(100vh-280px)]",
            // 최소 높이
            "min-h-[560px]",
            // 터치
            "touch-none select-none",
            // 커서
            "cursor-grab active:cursor-grabbing",
            // 오버플로우
            "overflow-hidden",
          )}
        >
          <SurfaceDiagram
            ref={diagramRef}
            primitives={runtimeDemo.primitives}
            camera={camera}
            width={runtimeDemo.width}
            height={runtimeDemo.height}
            lineSvg={lineSvg}
            lighting={lightSettings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            ariaLabel={t.hint}
            interactive={dragging || playing}
            className="h-full w-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />
        </div>
      </section>
    </div>
  );
}

function buildSimplePrimitivesDemo(width: number, height: number): DemoCase {
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(4.2, 2.8, 5.4),
    target: new Vec3(0.2, 0.0, 0.0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  const sphere = new Sphere("sphere", new Vec3(-1.6, 0.2, 0.0), 1.0);
  const cylinder = new Cylinder(
    "cyl",
    new Vec3(0.4, -1.1, -0.2),
    new Vec3(0, 1, 0),
    2.4,
    0.65,
    "both",
  );
  const cone = new Cone(
    "cone",
    new Vec3(2.2, 1.2, 0.0),
    new Vec3(0, -1, 0),
    2.2,
    0.9,
    "base",
  );
  const box = new BoxAabb(
    "box",
    new Vec3(-0.6, -0.9, 1.3),
    new Vec3(0.8, 0.5, 2.7),
  );

  return {
    name: "simple-primitives",
    width,
    height,
    camera,
    primitives: [sphere, cylinder, cone, box],
    includeIntersections: false,
    curves: ({ camera }) => [
      ...sphereSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        center: sphere.center,
        radius: sphere.radius,
      }),
      ...cylinderSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        base: cylinder.base,
        axis: cylinder.axis,
        height: cylinder.height,
        radius: cylinder.radius,
      }),
      ...coneSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        apex: cone.apex,
        axis: cone.axis,
        height: cone.height,
        baseRadius: cone.baseRadius,
      }),
      ...boxEdgesAsCubics(box.min, box.max),
    ],
  };
}

function buildRandomPrimitivesDemo(
  width: number,
  height: number,
  seed: number,
): DemoCase {
  const rng = mulberry32(seed);

  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(5.0, 3.6, 6.2),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (50 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  const primitives = createRandomPrimitives(rng, 10);

  return {
    name: `random-primitives (seed: ${seed})`,
    width,
    height,
    camera,
    primitives,
    includeIntersections: true,
    curves: ({ camera, primitives }) => {
      const out: ReturnType<typeof sphereSilhouetteToCubics3> = [];
      for (const p of primitives) {
        if (p instanceof Sphere)
          out.push(
            ...sphereSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              center: p.center,
              radius: p.radius,
            }),
          );
        else if (p instanceof Cylinder)
          out.push(
            ...cylinderSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              base: p.base,
              axis: p.axis,
              height: p.height,
              radius: p.radius,
            }),
          );
        else if (p instanceof Cone)
          out.push(
            ...coneSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              apex: p.apex,
              axis: p.axis,
              height: p.height,
              baseRadius: p.baseRadius,
            }),
          );
        else if (p instanceof BoxAabb)
          out.push(...boxEdgesAsCubics(p.min, p.max));
      }
      return out;
    },
  };
}

function buildConicSectionDemo(
  width: number,
  height: number,
  tilt: number,
): DemoCase {
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(3.8, 2.4, 5.2),
    target: new Vec3(0.0, 0.1, 0.0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  const cone = new Cone(
    "cone",
    new Vec3(0.0, -1.2, 0.0),
    new Vec3(0.1, 1.0, -0.15),
    2.6,
    1.0,
    "base",
  );
  const plane = new PlaneRect(
    "plane",
    new Vec3(0.15, 0.1, -0.1),
    new Vec3(0.0, 1.0, tilt),
    new Vec3(1.0, 0.0, 0.0),
    2.6,
    1.9,
  );

  return {
    name: "conic-section",
    width,
    height,
    camera,
    primitives: [cone, plane],
    includeIntersections: true,
    curves: ({ camera }) => [
      ...coneSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        apex: cone.apex,
        axis: cone.axis,
        height: cone.height,
        baseRadius: cone.baseRadius,
      }),
    ],
  };
}

function createRandomPrimitives(rng: () => number, count: number) {
  const out: Array<Sphere | Cylinder | Cone | BoxAabb> = [];

  for (let i = 0; i < count; i++) {
    const t = Math.floor(rng() * 4);
    const pos = new Vec3(
      randRange(rng, -3.5, 3.5),
      randRange(rng, -2.0, 2.0),
      randRange(rng, -2.5, 2.5),
    );
    const id = `p_${i}`;

    if (t === 0) out.push(new Sphere(id, pos, randRange(rng, 0.45, 1.15)));
    else if (t === 1)
      out.push(
        new Cylinder(
          id,
          pos,
          randUnitVec3(rng),
          randRange(rng, 1.0, 2.5),
          randRange(rng, 0.3, 0.8),
          "both",
        ),
      );
    else if (t === 2)
      out.push(
        new Cone(
          id,
          pos,
          randUnitVec3(rng),
          randRange(rng, 1.0, 2.5),
          randRange(rng, 0.5, 1.0),
          "base",
        ),
      );
    else {
      const size = randRange(rng, 0.5, 1.2);
      out.push(
        new BoxAabb(
          id,
          pos,
          Vec3.add(pos, new Vec3(size, size * randRange(rng, 0.6, 1.6), size)),
        ),
      );
    }
  }

  return out;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randUnitVec3(rng: () => number): Vec3 {
  const v = new Vec3(
    randRange(rng, -1, 1),
    randRange(rng, -1, 1),
    randRange(rng, -1, 1),
  );
  return Vec3.normalize(v);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxEdgesAsCubics(min: Vec3, max: Vec3) {
  const x0 = min.x,
    y0 = min.y,
    z0 = min.z;
  const x1 = max.x,
    y1 = max.y,
    z1 = max.z;

  const v000 = new Vec3(x0, y0, z0);
  const v100 = new Vec3(x1, y0, z0);
  const v010 = new Vec3(x0, y1, z0);
  const v110 = new Vec3(x1, y1, z0);
  const v001 = new Vec3(x0, y0, z1);
  const v101 = new Vec3(x1, y0, z1);
  const v011 = new Vec3(x0, y1, z1);
  const v111 = new Vec3(x1, y1, z1);

  const edges: Array<[Vec3, Vec3]> = [
    [v000, v100],
    [v010, v110],
    [v001, v101],
    [v011, v111],
    [v000, v010],
    [v100, v110],
    [v001, v011],
    [v101, v111],
    [v000, v001],
    [v100, v101],
    [v010, v011],
    [v110, v111],
  ];

  return edges.map(([a, b]) => lineToCubic3(a, b));
}

export function getAllExampleIds(): ExampleId[] {
  return EXAMPLES.map((x) => x.id);
}
