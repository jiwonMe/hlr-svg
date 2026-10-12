import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, RotateCcw, Sun } from "lucide-react";
import { Camera } from "@hlr/camera/camera.js";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import { lineToCubic3 } from "@hlr/curves/builders.js";
import { Vec3 } from "@hlr/math/vec3.js";
import {
  SurfaceDiagram,
  type SurfaceDiagramHandle,
} from "./components/SurfaceDiagram";
import { useElementSize } from "./docs/examples/useElementSize";
import { clamp, orbitPosition, type OrbitState } from "./runtime/orbit";
import {
  DEFAULT_PLAYGROUND_PRESET,
  PLAYGROUND_PRESETS,
  type PlaygroundPreset,
} from "./runtime/playgroundScenes";
import "./playground.css";

const BASE_RADIUS = 8.5;
const INITIAL_ORBIT: OrbitState = {
  target: Vec3.zero(),
  radius: BASE_RADIUS,
  azimuth: Math.PI / 4,
  polar: Math.acos(1 / Math.sqrt(3)),
};

type DragState = {
  id: number;
  x: number;
  y: number;
  azimuth: number;
  polar: number;
};

function ShapeIcon({ id }: { id: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      {id === "cube" ? (
        <>
          <path d="m20 6 13 7v14l-13 7-13-7V13zM7 13l13 8 13-8M20 21v13" />
          <path d="m20 6 0 14" strokeDasharray="2 3" opacity=".4" />
        </>
      ) : id === "octahedron" ? (
        <>
          <path d="m20 5 14 16-14 14L6 21zM20 5v30M6 21l14 5 14-5" />
          <path d="m6 21 14-5 14 5" strokeDasharray="2 3" opacity=".4" />
        </>
      ) : id === "cylinder" ? (
        <>
          <ellipse cx="20" cy="10" rx="11" ry="4" />
          <path d="M9 10v20c0 5 22 5 22 0V10" />
          <path d="M9 30c0-5 22-5 22 0" strokeDasharray="2 3" opacity=".4" />
        </>
      ) : id === "cone" || id === "cone-sphere" ? (
        <>
          <path d="m8 30 12-25 12 25" />
          <ellipse cx="20" cy="30" rx="12" ry="4" />
          {id === "cone-sphere" && (
            <circle cx="12" cy="22" r="8" fill="var(--pg-paper)" />
          )}
        </>
      ) : id === "sphere-cylinder" ? (
        <>
          <circle cx="23" cy="20" r="12" />
          <ellipse cx="14" cy="7" rx="7" ry="3" />
          <path d="M7 7v26c0 4 14 4 14 0V7" />
        </>
      ) : id === "sphere-sphere" ? (
        <>
          <circle cx="14" cy="20" r="11" />
          <circle cx="26" cy="20" r="11" />
        </>
      ) : (
        <>
          <circle cx="20" cy="20" r="14" />
          <ellipse cx="20" cy="20" rx="6" ry="14" opacity=".45" />
          <path d="M6 20c5 6 23 6 28 0" opacity=".45" />
        </>
      )}
    </svg>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "°",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}): React.ReactElement {
  return (
    <label className="pg-range">
      <span className="pg-control-label">
        <span>{label}</span>
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleControl({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.ReactElement {
  return (
    <label className="pg-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        className="pg-switch"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function GeometryPlayground(): React.ReactElement {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<SurfaceDiagramHandle | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [presetId, setPresetId] = useState(DEFAULT_PLAYGROUND_PRESET.id);
  const [orbit, setOrbit] = useState(INITIAL_ORBIT);
  const [projection, setProjection] = useState<"orthographic" | "perspective">(
    "orthographic",
  );
  const [dragging, setDragging] = useState(false);
  const [fillEnabled, setFillEnabled] = useState(true);
  const [showHidden, setShowHidden] = useState(true);
  const [showIntersections, setShowIntersections] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [azimuth, setAzimuth] = useState(135);
  const [elevation, setElevation] = useState(45);
  const [ambient, setAmbient] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    "도형을 선택하거나 드래그해 다른 방향에서 살펴보세요.",
  );
  const size = useElementSize(canvasRef);
  const width = size.width || 960;
  const height = size.height || 620;
  const preset =
    PLAYGROUND_PRESETS.find((item) => item.id === presetId) ??
    DEFAULT_PLAYGROUND_PRESET;
  const scene = useMemo(
    () => new Scene(preset.primitives),
    [preset.primitives],
  );
  const auxiliaryCurves = useMemo(
    () =>
      (preset.auxiliarySegments ?? []).flatMap(([start, end]) => {
        const a = preset.annotations?.find((point) => point.text === start);
        const b = preset.annotations?.find((point) => point.text === end);
        return a && b ? [lineToCubic3(a.point, b.point)] : [];
      }),
    [preset.auxiliarySegments, preset.annotations],
  );

  const camera = useMemo(() => {
    const common = {
      position: orbitPosition(orbit),
      target: orbit.target,
      up: new Vec3(0, 1, 0),
      aspect: width / height,
      near: 0.05,
      far: 100,
    };
    return projection === "orthographic"
      ? Camera.from({
          ...common,
          kind: "orthographic",
          halfHeight: (preset.halfHeight * orbit.radius) / BASE_RADIUS,
        })
      : Camera.from({
          ...common,
          kind: "perspective",
          fovYRad: 2 * Math.atan(preset.halfHeight / BASE_RADIUS),
        });
  }, [height, orbit, preset.halfHeight, projection, width]);

  const lineSvg = useMemo(
    () =>
      new SvgRenderer({
        width,
        height,
        background: false,
        include: { intersections: showIntersections },
        style: {
          strokeVisible: "#293632",
          strokeHidden: "#62736c",
          strokeWidthVisible: strokeWidth,
          strokeWidthHidden: strokeWidth,
          dashArrayHidden: "5 5",
          opacityHidden: showHidden ? 0.5 : 0,
        },
        hlr: { samples: 112, coarseSamples: 0, refineIters: 18 },
        intersections: { angularSamples: 112 },
      }).render(scene, camera, { curves: auxiliaryCurves }),
    [
      auxiliaryCurves,
      camera,
      height,
      scene,
      showHidden,
      showIntersections,
      strokeWidth,
      width,
    ],
  );
  const annotatedLineSvg = useMemo(() => {
    if (!showLabels || !preset.annotations?.length) return lineSvg;
    const doc = new DOMParser().parseFromString(lineSvg, "image/svg+xml");
    const group = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-annotations", "true");
    group.setAttribute("pointer-events", "none");
    for (const label of preset.annotations) {
      const point = camera.projectToSvg(label.point, width, height);
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.z < -1 ||
        point.z > 1
      )
        continue;
      const marker = doc.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      marker.setAttribute("cx", String(point.x));
      marker.setAttribute("cy", String(point.y));
      marker.setAttribute("r", "2");
      marker.setAttribute("fill", "#263b30");
      const text = doc.createElementNS("http://www.w3.org/2000/svg", "text");
      text.textContent = label.text;
      text.setAttribute("class", "pg-point-label");
      text.setAttribute("x", String(point.x + label.dx));
      text.setAttribute("y", String(point.y + label.dy));
      text.setAttribute("text-anchor", label.dx < 0 ? "end" : "start");
      text.setAttribute("fill", "#263b30");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "3");
      text.setAttribute("paint-order", "stroke");
      text.setAttribute("font-size", "16");
      text.setAttribute("font-family", "Georgia, serif");
      text.setAttribute("font-style", "italic");
      group.append(marker, text);
    }
    doc.documentElement.append(group);
    return new XMLSerializer().serializeToString(doc);
  }, [camera, height, lineSvg, preset.annotations, showLabels, width]);

  const lighting = useMemo(
    () => ({
      enabled: fillEnabled,
      azimuth,
      elevation,
      ambient: ambient / 100,
    }),
    [ambient, azimuth, elevation, fillEnabled],
  );
  const selectedObject = preset.objects.find(
    (object) => object.id === selectedId,
  );

  const selectPreset = (next: PlaygroundPreset): void => {
    setPresetId(next.id);
    setSelectedId(null);
    setOrbit(INITIAL_ORBIT);
    setNotice(`${next.name} 장면입니다. ${next.description}`);
  };

  const selectObject = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const object = preset.objects.find((item) => item.id === id);
      setNotice(
        object
          ? `${object.name} 선택됨. 다른 도형을 누르면 선택을 바꿀 수 있습니다.`
          : "전체 도형을 살펴보고 있습니다.",
      );
    },
    [preset.objects],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        azimuth: orbit.azimuth,
        polar: orbit.polar,
      };
      setDragging(true);
    },
    [orbit.azimuth, orbit.polar],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      setOrbit((current) => ({
        ...current,
        azimuth: drag.azimuth + dx * 0.006,
        polar: clamp(0.12, drag.polar + dy * 0.006, Math.PI - 0.12),
      }));
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    setOrbit((current) => ({
      ...current,
      radius: clamp(4, current.radius * Math.exp(event.deltaY * 0.001), 18),
    }));
  }, []);

  const saveSvg = useCallback(() => {
    const svg = diagramRef.current?.toSvg();
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hlr-${presetId}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("현재 도형을 SVG 파일로 저장했습니다.");
  }, [presetId]);

  return (
    <div className="pg-page">
      <header className="pg-header">
        <Link className="pg-brand" to="/">
          <span className="pg-brand-mark">H</span>
          <span>
            HLR <span className="pg-brand-divider">/</span>{" "}
            <strong>도형 작업실</strong>
          </span>
        </Link>
        <nav className="pg-header-actions" aria-label="작업실 메뉴">
          <Link className="pg-text-link" to="/docs/ko-kr/quickstart">
            <ArrowLeft size={14} />
            문서
          </Link>
          <button className="pg-download" type="button" onClick={saveSvg}>
            <Download size={15} />
            SVG 다운로드
          </button>
        </nav>
      </header>

      <main className="pg-main">
        <div className="pg-intro">
          <div>
            <span className="pg-eyebrow">GEOMETRY STUDIO</span>
            <h1>빛으로 읽는 입체.</h1>
          </div>
          <p>
            도형을 돌리고, 빛을 옮기고,
            <br />
            가려진 선을 확인하세요.
          </p>
        </div>

        <div className="pg-workspace">
          <aside className="pg-presets pg-panel" aria-label="도형 선택">
            <div className="pg-panel-heading">
              <h2>도형 선택</h2>
              <span>08</span>
            </div>
            {(["기본 도형", "겹침 도형"] as const).map((category) => (
              <section className="pg-preset-group" key={category}>
                <h3>{category}</h3>
                {PLAYGROUND_PRESETS.filter(
                  (item) => item.category === category,
                ).map((item) => (
                  <button
                    className={`pg-preset${presetId === item.id ? " is-active" : ""}`}
                    type="button"
                    key={item.id}
                    onClick={() => selectPreset(item)}
                    aria-pressed={presetId === item.id}
                  >
                    <span className="pg-shape-icon">
                      <ShapeIcon id={item.id} />
                    </span>
                    <span>{item.name}</span>
                    <span className="pg-preset-dot" />
                  </button>
                ))}
              </section>
            ))}
            <div className="pg-practice-note">
              <span>살펴보기</span>
              <p>
                겹침 도형의 교선은 두 곡면이 만나는 자리입니다. 회전하며 앞뒤
                관계를 찾아보세요.
              </p>
            </div>
          </aside>

          <section className="pg-stage pg-panel" aria-label="도형 캔버스">
            <div className="pg-stage-toolbar">
              <div>
                <strong>{preset.name}</strong>
                <span className="pg-stage-badge">
                  {preset.primitives.length > 1 ? "교선 탐구" : "입체 탐구"}
                </span>
              </div>
              <div className="pg-view-controls">
                <div className="pg-segmented" aria-label="투영 방식">
                  <button
                    type="button"
                    aria-pressed={projection === "orthographic"}
                    onClick={() => setProjection("orthographic")}
                  >
                    직교
                  </button>
                  <button
                    type="button"
                    aria-pressed={projection === "perspective"}
                    onClick={() => setProjection("perspective")}
                  >
                    원근
                  </button>
                </div>
                <button
                  className="pg-icon-button"
                  type="button"
                  onClick={() => {
                    setOrbit(INITIAL_ORBIT);
                    setNotice("처음 시점으로 돌아왔습니다.");
                  }}
                  aria-label="시점 초기화"
                  title="시점 초기화"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
            <div className="pg-canvas" ref={canvasRef}>
              <SurfaceDiagram
                ref={diagramRef}
                primitives={preset.primitives}
                camera={camera}
                width={width}
                height={height}
                lineSvg={annotatedLineSvg}
                lighting={lighting}
                selectedId={selectedId}
                onSelect={selectObject}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
                interactive={dragging}
                className="pg-diagram"
              />
              <span className="pg-canvas-corner">
                {projection === "orthographic" ? "직교 투영" : "원근 투영"}
              </span>
            </div>
            <div className="pg-stage-footer">
              <span>
                드래그 회전 <i>·</i> 휠 확대/축소 <i>·</i> 클릭 선택
              </span>
              <button
                type="button"
                onClick={() => {
                  setOrbit(INITIAL_ORBIT);
                  setProjection("orthographic");
                }}
              >
                등각으로 보기 <span>↗</span>
              </button>
            </div>
            <p className="pg-caption" role="status">
              {notice}
            </p>
          </section>

          <aside className="pg-settings" aria-label="도형 표시 설정">
            <section className="pg-panel pg-light-panel">
              <div className="pg-panel-heading">
                <h2>
                  <Sun size={16} />
                  조명
                </h2>
                <span>실시간</span>
              </div>
              <div
                className="pg-light-preview"
                style={
                  {
                    "--light-x": `${50 + Math.sin((azimuth * Math.PI) / 180) * 30}%`,
                    "--light-y": `${60 - elevation * 0.45}%`,
                  } as React.CSSProperties
                }
              >
                <span className="pg-light-orbit" />
                <span className="pg-light-sphere" />
                <span className="pg-light-point" />
              </div>
              <RangeControl
                label="빛의 방향"
                value={azimuth}
                min={0}
                max={360}
                onChange={setAzimuth}
              />
              <RangeControl
                label="빛의 높이"
                value={elevation}
                min={5}
                max={85}
                onChange={setElevation}
              />
              <RangeControl
                label="주변 밝기"
                value={ambient}
                min={10}
                max={75}
                unit="%"
                onChange={setAmbient}
              />
              <button
                className="pg-subtle-button"
                type="button"
                onClick={() => {
                  setAzimuth(135);
                  setElevation(45);
                  setAmbient(30);
                }}
              >
                조명 초기화
              </button>
            </section>

            <section className="pg-panel pg-line-panel">
              <div className="pg-panel-heading">
                <h2>면과 선</h2>
              </div>
              <ToggleControl
                label="면 채색"
                description="빛에 따른 면의 밝기"
                checked={fillEnabled}
                onChange={setFillEnabled}
              />
              <ToggleControl
                label="숨은선"
                description="가려진 모서리를 점선으로"
                checked={showHidden}
                onChange={setShowHidden}
              />
              <ToggleControl
                label="교선"
                description="도형이 만나는 경계"
                checked={showIntersections}
                onChange={setShowIntersections}
              />
              <ToggleControl
                label="점 이름"
                description="꼭짓점과 중심의 이름"
                checked={showLabels}
                onChange={setShowLabels}
              />
              <RangeControl
                label="선 굵기"
                value={strokeWidth}
                min={0.75}
                max={3}
                step={0.25}
                unit=""
                onChange={setStrokeWidth}
              />
            </section>

            <section className="pg-panel pg-object-panel">
              <div className="pg-panel-heading">
                <h2>장면의 도형</h2>
                <span>{String(preset.objects.length).padStart(2, "0")}</span>
              </div>
              {preset.objects.map((object, index) => (
                <button
                  type="button"
                  className={`pg-object${selectedId === object.id ? " is-selected" : ""}`}
                  key={object.id}
                  onClick={() =>
                    selectObject(selectedId === object.id ? null : object.id)
                  }
                  aria-pressed={selectedId === object.id}
                >
                  <span className="pg-object-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{object.name}</strong>
                    <small>{object.kind}</small>
                  </span>
                  <span className="pg-object-dot" />
                </button>
              ))}
              <p className="pg-object-hint">
                {selectedObject
                  ? `${selectedObject.name} 선택됨`
                  : "도형이나 목록을 눌러 선택하세요."}
              </p>
              {selectedId && (
                <button
                  type="button"
                  className="pg-subtle-button"
                  onClick={() => selectObject(null)}
                >
                  선택 해제
                </button>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
