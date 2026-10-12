import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCcw, Upload } from "lucide-react";

import { Camera } from "@hlr/camera/camera.js";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import { parseObj } from "@hlr/io/obj.js";
import { parseStl } from "@hlr/io/stl.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { Bounds3 } from "@hlr/scene/primitives/triangleMesh.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";

import { clamp, orbitPosition, type OrbitState } from "../../runtime/orbit";
import { useElementSize } from "./useElementSize";
import { EXAMPLE_TEXT, ExampleCode, ExampleHeader } from "./DocsExamplePage";

type Locale = "ko-kr" | "en-us";

type ExampleInfo = {
  title: string;
  description: string;
  tags: readonly string[];
};

type MeshImportExampleProps = {
  lang: Locale;
  info: ExampleInfo;
  githubUrl: string;
  label: string;
  code: string;
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
    hint: "끌어서 회전 · 휠로 확대 · OBJ/STL 파일을 끌어다 놓아도 됩니다",
    reset: "처음 시점",
    upload: "파일 선택",
    replace: "다른 파일",
    perspective: "원근",
    isometric: "등각",
    crease: "모서리 각도",
    loaded: "불러온 파일",
    meshes: "메시",
    triangles: "삼각형",
    edges: "특징선",
    warnings: "경고",
    error: "오류",
    drop: "여기에 OBJ/STL 파일을 드롭하세요",
    empty:
      "OBJ 또는 STL 파일을 올리면 SVG hidden-line 렌더링 결과를 바로 볼 수 있습니다.",
    sample: "sample-cube.obj",
    unsupported:
      "지원하지 않는 파일 형식입니다. .obj 또는 .stl 파일만 업로드할 수 있습니다.",
    noGeometry: "유효한 삼각형을 찾지 못했습니다.",
  },
  "en-us": {
    hint: "Drag: rotate · Wheel: zoom · Drop an OBJ/STL file anywhere in the viewer.",
    reset: "Reset view",
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
    empty:
      "Upload an OBJ or STL file to preview its SVG hidden-line rendering.",
    sample: "sample-cube.obj",
    unsupported: "Unsupported file type. Please upload an .obj or .stl file.",
    noGeometry: "No valid triangles were found in this file.",
  },
} as const;

export function MeshImportExample({
  lang,
  info,
  githubUrl,
  label,
  code,
}: MeshImportExampleProps): React.ReactElement {
  const t = TEXT[lang];
  const shared = EXAMPLE_TEXT[lang];
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

  const baseOrbit = useMemo(
    () => orbitFromBounds(model.bounds),
    [model.bounds],
  );
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
        strokeWidthVisible: 1.35,
        strokeWidthHidden: 1.05,
        dashArrayHidden: "3.2 2.6",
        strokeVisible: "#0a0a0a",
        strokeHidden: "#0a0a0a",
        opacityHidden: 0.9,
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
    <div className="example">
      <ExampleHeader
        lang={lang}
        label={label}
        info={info}
        githubUrl={githubUrl}
      />

      <section className="example-stage" aria-label={info.title}>
        <div className="example-toolbar">
          <div className="example-toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden="true" size={14} strokeWidth={1.8} />
              {model.label === t.sample ? t.upload : t.replace}
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setOrbit(baseOrbit)}
            >
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
              {t.reset}
            </button>
            <div
              className="seg seg-sm"
              role="group"
              aria-label={shared.projection}
            >
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
                  setOrbit((current) => ({
                    ...current,
                    azimuth: ISO_AZ,
                    polar: ISO_POLAR,
                  }));
                }}
              >
                {t.isometric}
              </button>
            </div>
          </div>
          <label className="tool-field">
            <span>{t.crease}</span>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={creaseAngleDeg}
              onChange={(e) => setCreaseAngleDeg(Number(e.target.value))}
            />
            <output>{creaseAngleDeg}°</output>
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".obj,.stl"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void loadFile(file);
            e.currentTarget.value = "";
          }}
        />

        <div
          ref={wrapRef}
          className="example-canvas mesh-canvas"
          role="img"
          aria-label={`${info.title}. ${t.hint}`}
          style={{ touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
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
            if (e.currentTarget.contains(e.relatedTarget as Node | null))
              return;
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
              azimuth: drag.az - dx * speed,
              polar: clamp(0.05, drag.pol - dy * speed, Math.PI - 0.05),
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
              radius: clamp(
                0.25,
                current.radius * scale,
                Math.max(60, diag * 8),
              ),
            }));
          }}
        >
          <div className="mesh-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="example-hint" aria-hidden="true">
            {t.hint}
          </p>
          {dragActive && <div className="mesh-drop">{t.drop}</div>}
        </div>

        <div className="mesh-info">
          <p className="mesh-stats">
            <span>
              {t.loaded} <b>{model.label}</b>
            </span>
            <span>
              {t.meshes} <b>{model.meshes.length}</b>
            </span>
            <span>
              {t.triangles} <b>{totalTriangles}</b>
            </span>
            <span>
              {t.edges} <b>{totalEdges}</b>
            </span>
          </p>
          <p className="mesh-note">{t.empty}</p>
          {warnings.length > 0 && (
            <div className="mesh-warnings">
              <h3>{t.warnings}</h3>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <div className="mesh-error" role="alert">
              <h3>{t.error}</h3>
              <p>{error}</p>
            </div>
          )}
        </div>
      </section>

      <ExampleCode
        title={shared.code}
        note={shared.codeNote}
        file="mesh-import.ts"
        code={code}
        lang={lang}
      />
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
