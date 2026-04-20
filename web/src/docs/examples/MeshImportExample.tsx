import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

import { Camera } from "@hlr/camera/camera.js";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import { parseObj } from "@hlr/io/obj.js";
import { parseStl } from "@hlr/io/stl.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { Bounds3 } from "@hlr/scene/primitives/triangleMesh.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";

import {
  clamp,
  orbitPosition,
  type OrbitState,
} from "../../runtime/orbit";
import { useElementSize } from "./useElementSize";

type Locale = "ko-kr" | "en-us";

type ExampleInfo = {
  title: string;
  description: string;
};

type MeshImportExampleProps = {
  lang: Locale;
  info: ExampleInfo;
  githubUrl: string;
};

type Projection = "perspective" | "isometric";

type LoadedMeshModel = {
  label: string;
  format: "obj" | "stl";
  meshes: TriangleMesh[];
  bounds: Bounds3;
  warnings: string[];
};

const ISO_AZ = Math.PI / 4;
const ISO_POLAR = Math.acos(1 / Math.sqrt(3));
const DEFAULT_CREASE = 30;

const DEFAULT_OBJ = `
# simple cube
o sample-cube
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8
`.trim();

const TEXT = {
  "ko-kr": {
    back: "Examples로",
    github: "GitHub 코드",
    hint: "드래그: 회전 · 휠: 줌 · OBJ/STL 파일은 드롭으로도 업로드할 수 있습니다.",
    reset: "리셋",
    upload: "파일 선택",
    replace: "다른 파일",
    perspective: "Perspective",
    isometric: "Isometric",
    crease: "crease",
    loaded: "로드됨",
    meshes: "meshes",
    triangles: "triangles",
    edges: "feature edges",
    warnings: "Warnings",
    error: "오류",
    drop: "여기에 OBJ/STL 파일을 드롭하세요",
    empty: "OBJ 또는 STL 파일을 올리면 SVG hidden-line 렌더링 결과를 바로 볼 수 있습니다.",
    sample: "sample-cube.obj",
    unsupported: "지원하지 않는 파일 형식입니다. .obj 또는 .stl 파일만 업로드할 수 있습니다.",
    noGeometry: "유효한 삼각형을 찾지 못했습니다.",
  },
  "en-us": {
    back: "Back to Examples",
    github: "GitHub code",
    hint: "Drag: rotate · Wheel: zoom · Drop an OBJ/STL file anywhere in the viewer.",
    reset: "Reset",
    upload: "Choose file",
    replace: "Replace file",
    perspective: "Perspective",
    isometric: "Isometric",
    crease: "crease",
    loaded: "Loaded",
    meshes: "meshes",
    triangles: "triangles",
    edges: "feature edges",
    warnings: "Warnings",
    error: "Error",
    drop: "Drop an OBJ/STL file here",
    empty: "Upload an OBJ or STL file to preview its SVG hidden-line rendering.",
    sample: "sample-cube.obj",
    unsupported: "Unsupported file type. Please upload an .obj or .stl file.",
    noGeometry: "No valid triangles were found in this file.",
  },
} as const;

export function MeshImportExample({
  lang,
  info,
  githubUrl,
}: MeshImportExampleProps): React.ReactElement {
  const t = TEXT[lang];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useElementSize(wrapRef);

  const initialModel = useMemo(() => createSampleModel(t.sample), [t.sample]);
  const [model, setModel] = useState<LoadedMeshModel>(initialModel);
  const [warnings, setWarnings] = useState<string[]>(initialModel.warnings);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [creaseAngleDeg, setCreaseAngleDeg] = useState(DEFAULT_CREASE);
  const [projection, setProjection] = useState<Projection>("perspective");
  const [drag, setDrag] = useState<null | {
    x: number;
    y: number;
    az: number;
    pol: number;
    id: number;
  }>(null);

  const baseOrbit = useMemo(() => orbitFromBounds(model.bounds), [model.bounds]);
  const [orbit, setOrbit] = useState<OrbitState>(baseOrbit);

  useEffect(() => {
    setOrbit(baseOrbit);
    setProjection("perspective");
  }, [baseOrbit]);

  const viewportWidth = width > 0 ? width : 960;
  const viewportHeight = height > 0 ? height : 620;
  const diag = Math.max(1, Vec3.distance(model.bounds.min, model.bounds.max));

  const camera = useMemo(() => {
    const position = orbitPosition(orbit);
    const aspect = Math.max(1e-6, viewportWidth / viewportHeight);
    if (projection === "perspective") {
      return Camera.from({
        kind: "perspective",
        position,
        target: orbit.target,
        up: new Vec3(0, 1, 0),
        fovYRad: (50 * Math.PI) / 180,
        aspect,
        near: Math.max(0.01, diag * 0.01),
        far: Math.max(100, diag * 20),
      });
    }
    return Camera.from({
      kind: "orthographic",
      position,
      target: orbit.target,
      up: new Vec3(0, 1, 0),
      halfHeight: Math.max(1, diag * 0.4),
      aspect,
      near: Math.max(0.01, diag * 0.01),
      far: Math.max(100, diag * 20),
    });
  }, [diag, orbit, projection, viewportHeight, viewportWidth]);

  const scene = useMemo(() => new Scene(model.meshes), [model.meshes]);

  const svg = useMemo(() => {
    const renderer = new SvgRenderer({
      width: viewportWidth,
      height: viewportHeight,
      include: {
        intersections: false,
        meshEdges: true,
      },
      mesh: {
        creaseAngleDeg,
      },
      style: {
        strokeWidthVisible: 1.8,
        strokeWidthHidden: 1.8,
        dashArrayHidden: "6 6",
        strokeVisible: "#000000",
        strokeHidden: "#000000",
        opacityHidden: 0.35,
      },
    });

    return renderer.render(scene, camera, {
      include: {
        intersections: false,
        meshEdges: true,
      },
    });
  }, [camera, creaseAngleDeg, scene, viewportHeight, viewportWidth]);

  const totalTriangles = useMemo(
    () => model.meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0),
    [model.meshes],
  );
  const totalEdges = useMemo(
    () =>
      model.meshes.reduce(
        (sum, mesh) =>
          sum + mesh.featureEdges(camera, { creaseAngleDeg }).length,
        0,
      ),
    [camera, creaseAngleDeg, model.meshes],
  );

  const loadFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".obj") && !lower.endsWith(".stl")) {
        setError(t.unsupported);
        return;
      }

      try {
        const bytes = await file.arrayBuffer();
        const imported = lower.endsWith(".stl")
          ? parseStl(bytes)
          : parseObj(bytes);

        setWarnings(imported.warnings);
        if (imported.meshes.length === 0) {
          setError(t.noGeometry);
          return;
        }

        setModel({
          label: file.name,
          format: lower.endsWith(".stl") ? "stl" : "obj",
          meshes: imported.meshes,
          bounds: imported.bounds,
          warnings: imported.warnings,
        });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [t.noGeometry, t.unsupported],
  );

  return (
    <div className={cn("w-full", "px-6", "py-6", "overflow-x-hidden")}>
      <header className={cn("flex", "flex-col", "gap-3", "mb-5")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4")}>
          <div className={cn("min-w-0")}>
            <Link
              to={`/docs/${lang}/examples`}
              className={cn(
                "text-sm font-medium",
                "text-[hsl(152,69%,35%)]",
                "hover:text-[hsl(152,69%,25%)]",
                "hover:underline",
                "underline-offset-4",
              )}
            >
              {t.back}
            </Link>
            <h1
              className={cn(
                "text-2xl font-semibold tracking-tight",
                "text-[hsl(220,9%,18%)]",
                "mt-2",
              )}
            >
              {info.title}
            </h1>
            <p
              className={cn(
                "text-[15px] leading-7",
                "text-[hsl(220,9%,35%)]",
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
              "text-sm font-medium",
              "text-[hsl(152,69%,35%)]",
              "hover:text-[hsl(152,69%,25%)]",
              "hover:underline",
              "underline-offset-4",
              "shrink-0",
            )}
          >
            {t.github}
          </a>
        </div>
      </header>

      <style>{`
        [data-example-svg] svg {
          width: 100%;
          height: auto;
          display: block;
        }
      `}</style>

      <section
        className={cn(
          "rounded-lg",
          "border border-[hsl(220,13%,91%)]",
          "bg-white",
          "overflow-hidden",
          "min-w-0",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            "px-4 py-3",
            "border-b border-[hsl(220,13%,91%)]",
            "bg-[hsl(240,4.8%,95.9%)]",
          )}
        >
          <div className={cn("text-xs text-[hsl(220,9%,46%)]")}>{t.hint}</div>

          <div className={cn("flex flex-wrap items-center gap-2")}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={toolbarButtonClass()}
            >
              {model.label === t.sample ? t.upload : t.replace}
            </button>
            <button
              type="button"
              onClick={() => setOrbit(baseOrbit)}
              className={toolbarButtonClass()}
            >
              {t.reset}
            </button>
            <div className={cn("flex items-center gap-1")}>
              <button
                type="button"
                onClick={() => setProjection("perspective")}
                className={projectionButtonClass(projection === "perspective")}
              >
                {t.perspective}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjection("isometric");
                  setOrbit((current) => ({
                    ...current,
                    azimuth: ISO_AZ,
                    polar: ISO_POLAR,
                  }));
                }}
                className={projectionButtonClass(projection === "isometric")}
              >
                {t.isometric}
              </button>
            </div>
            <label className={cn("flex items-center gap-2 px-3", "text-xs text-[hsl(220,9%,46%)]")}>
              {t.crease}
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={creaseAngleDeg}
                onChange={(e) => setCreaseAngleDeg(Number(e.target.value))}
                className={cn("w-32")}
              />
              <span className={cn("w-10 text-right tabular-nums")}>
                {creaseAngleDeg}°
              </span>
            </label>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".obj,.stl"
          className={cn("hidden")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void loadFile(file);
            e.currentTarget.value = "";
          }}
        />

        <div
          ref={wrapRef}
          className={cn(
            "relative",
            "w-full",
            "h-[calc(100vh-320px)]",
            "min-h-[560px]",
            "touch-none select-none",
            "cursor-grab active:cursor-grabbing",
            "p-3",
            "overflow-hidden",
            dragActive ? "bg-[hsl(152,69%,97%)]" : "bg-white",
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            void loadFile(file);
          }}
          onPointerDown={(e) => {
            const el = wrapRef.current;
            if (!el) return;
            el.setPointerCapture(e.pointerId);
            setDrag({
              x: e.clientX,
              y: e.clientY,
              az: orbit.azimuth,
              pol: orbit.polar,
              id: e.pointerId,
            });
          }}
          onPointerMove={(e) => {
            if (!drag || drag.id !== e.pointerId) return;
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            const speed = 0.0075;
            setOrbit((current) => ({
              ...current,
              azimuth: drag.az + dx * speed,
              polar: clamp(0.05, drag.pol + dy * speed, Math.PI - 0.05),
            }));
          }}
          onPointerUp={(e) => {
            if (!drag || drag.id !== e.pointerId) return;
            setDrag(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const scale = Math.exp(e.deltaY * 0.0012);
            setOrbit((current) => ({
              ...current,
              radius: clamp(0.25, current.radius * scale, Math.max(60, diag * 8)),
            }));
          }}
        >
          <div data-example-svg dangerouslySetInnerHTML={{ __html: svg }} />

          {dragActive ? (
            <div
              className={cn(
                "absolute inset-6",
                "rounded-lg border-2 border-dashed border-[hsl(152,69%,41%)]",
                "bg-[hsla(152,69%,60%,0.08)]",
                "flex items-center justify-center",
                "pointer-events-none",
              )}
            >
              <div className={cn("text-base font-medium text-[hsl(152,69%,30%)]")}>
                {t.drop}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]",
            "border-t border-[hsl(220,13%,91%)]",
          )}
        >
          <div className={cn("px-4 py-4")}>
            <div className={cn("flex flex-wrap items-center gap-4 text-sm text-[hsl(220,9%,35%)]")}>
              <span>
                {t.loaded}: <strong>{model.label}</strong>
              </span>
              <span>
                {model.meshes.length} {t.meshes}
              </span>
              <span>
                {totalTriangles} {t.triangles}
              </span>
              <span>
                {totalEdges} {t.edges}
              </span>
            </div>
            <p className={cn("mt-3 text-sm leading-6 text-[hsl(220,9%,46%)]")}>
              {t.empty}
            </p>
          </div>

          <aside
            className={cn(
              "border-t lg:border-t-0 lg:border-l border-[hsl(220,13%,91%)]",
              "bg-[hsl(220,14%,98%)]",
              "px-4 py-4",
              "space-y-4",
            )}
          >
            <div>
              <div className={cn("text-sm font-semibold text-[hsl(220,9%,18%)]")}>
                {t.warnings}
              </div>
              {warnings.length === 0 ? (
                <div className={cn("mt-2 text-sm text-[hsl(220,9%,46%)]")}>
                  None
                </div>
              ) : (
                <ul className={cn("mt-2 space-y-2 text-sm text-[hsl(220,9%,35%)]")}>
                  {warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>

            {error ? (
              <div>
                <div className={cn("text-sm font-semibold text-[hsl(0,72%,42%)]")}>
                  {t.error}
                </div>
                <div className={cn("mt-2 text-sm leading-6 text-[hsl(0,72%,35%)]")}>
                  {error}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}

function createSampleModel(label: string): LoadedMeshModel {
  const imported = parseObj(DEFAULT_OBJ);
  return {
    label,
    format: "obj",
    meshes: imported.meshes,
    bounds: imported.bounds,
    warnings: imported.warnings,
  };
}

function orbitFromBounds(bounds: Bounds3): OrbitState {
  const target = new Vec3(
    (bounds.min.x + bounds.max.x) / 2,
    (bounds.min.y + bounds.max.y) / 2,
    (bounds.min.z + bounds.max.z) / 2,
  );
  const diag = Math.max(1.5, Vec3.distance(bounds.min, bounds.max));
  return {
    target,
    radius: diag * 1.35,
    azimuth: ISO_AZ,
    polar: Math.min(Math.PI - 0.1, ISO_POLAR + 0.1),
  };
}

function toolbarButtonClass(): string {
  return cn(
    "h-9 px-3",
    "rounded-md",
    "border border-[hsl(220,13%,91%)]",
    "bg-white",
    "text-sm font-medium",
    "hover:bg-[hsl(220,14%,96%)]",
    "transition-colors",
  );
}

function projectionButtonClass(active: boolean): string {
  return cn(
    "h-9 px-3",
    "rounded-md",
    "border border-[hsl(220,13%,91%)]",
    active
      ? "bg-[hsl(152,69%,97%)] text-[hsl(152,69%,35%)]"
      : "bg-white text-[hsl(220,9%,18%)]",
    "text-sm font-medium",
    "hover:bg-[hsl(220,14%,96%)]",
    "transition-colors",
  );
}
