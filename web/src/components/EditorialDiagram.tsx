import React, { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { Camera } from "@hlr/camera/camera.js";
import type { DemoCase } from "@hlr/demo/types.js";
import {
  buildSpherePlaneSectionsDemo,
  renderSpherePlaneSectionsAnnotations,
  SPHERE_PLANE_SECTIONS_STYLE,
} from "@hlr/demo/spherePlaneSections.js";
import {
  buildTangentSpheresDemo,
  renderTangentSpheresAnnotations,
  TANGENT_SPHERES_STYLE,
} from "@hlr/demo/tangentSpheres.js";
import { buildConicSectionCase } from "@hlr/demo/samples/conicSection.js";
import { clamp, orbitFromCamera, orbitPosition } from "../runtime/orbit";
import { useDemoSvg } from "../runtime/useDemoSvg";
import { useFrameState } from "../runtime/useFrameState";

export type EditorialDiagramKind =
  | "sphere-sections"
  | "tangent-spheres"
  | "conic-section";

export type EditorialDiagramProps = {
  kind: EditorialDiagramKind;
  interactive?: boolean;
};

const WIDTH = 700;
const LABELS: Record<EditorialDiagramKind, string> = {
  "sphere-sections":
    "45°를 이루는 두 평면과 구의 단면. 점 O, A, P, Q, R과 보조선이 표시된 공간도형",
  "tangent-spheres":
    "평면 위에서 큰 구 S에 접하는 세 구 S₁, S₂, S₃와 평면 β의 교선",
  "conic-section":
    "기울어진 평면으로 원뿔을 잘랐을 때 나타나는 단면과 가려진 선",
};
const RENDER_OPTIONS = {
  "sphere-sections": {
    background: false,
    svgStyle: {
      ...SPHERE_PLANE_SECTIONS_STYLE,
      strokeVisible: "#292929",
    },
  },
  "tangent-spheres": {
    background: false,
    svgStyle: {
      ...TANGENT_SPHERES_STYLE,
      strokeVisible: "#292929",
    },
  },
  "conic-section": {
    background: false,
    svgStyle: {
      strokeVisible: "#292929",
      strokeHidden: "#777777",
      strokeWidthVisible: 1.7,
      strokeWidthHidden: 1.1,
      dashArrayHidden: "3 3",
      opacityHidden: 0.7,
    },
  },
};

type DragState = {
  id: number;
  x: number;
  y: number;
  azimuth: number;
  polar: number;
};

function buildDiagram(kind: EditorialDiagramKind): DemoCase {
  if (kind === "sphere-sections")
    return buildSpherePlaneSectionsDemo(WIDTH, 480);
  if (kind === "tangent-spheres") return buildTangentSpheresDemo(WIDTH, 400);

  const demo = buildConicSectionCase();
  return {
    ...demo,
    width: WIDTH,
    height: 400,
    camera: Camera.from({
      kind: "perspective",
      position: demo.camera.position,
      target: demo.camera.target,
      up: demo.camera.up,
      fovYRad: demo.camera.fovYRad!,
      aspect: WIDTH / 400,
      near: demo.camera.near,
      far: demo.camera.far,
    }),
  };
}

/** Examination diagrams use the same geometry and annotations as the examples. */
export function EditorialDiagram({
  kind,
  interactive = false,
}: EditorialDiagramProps): React.ReactElement {
  const hintId = useId();
  const baseDemo = useMemo(() => buildDiagram(kind), [kind]);
  const baseOrbit = useMemo(
    () => orbitFromCamera(baseDemo.camera.position, baseDemo.camera.target),
    [baseDemo],
  );
  const [orbit, orbitInput] = useFrameState(baseOrbit);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    orbitInput.reset(baseOrbit);
    dragRef.current = null;
  }, [baseOrbit, orbitInput]);

  const camera = useMemo(() => {
    const shared = {
      position: orbitPosition(orbit),
      target: orbit.target,
      up: baseDemo.camera.up,
      aspect: baseDemo.width / baseDemo.height,
      near: baseDemo.camera.near,
      far: baseDemo.camera.far,
    };
    return baseDemo.camera.kind === "orthographic"
      ? Camera.from({
          ...shared,
          kind: "orthographic",
          halfHeight: baseDemo.camera.halfHeight!,
        })
      : Camera.from({
          ...shared,
          kind: "perspective",
          fovYRad: baseDemo.camera.fovYRad!,
        });
  }, [baseDemo, orbit]);
  const demo = useMemo(() => ({ ...baseDemo, camera }), [baseDemo, camera]);
  const lines = useDemoSvg(demo, RENDER_OPTIONS[kind]);
  const svg = useMemo(() => {
    const annotate =
      kind === "sphere-sections"
        ? renderSpherePlaneSectionsAnnotations
        : kind === "tangent-spheres"
          ? renderTangentSpheresAnnotations
          : null;
    if (!annotate) return lines;
    return lines.replace(
      /<\/svg>\s*$/,
      () => `${annotate(camera, demo.width, demo.height)}</svg>`,
    );
  }, [camera, demo.width, demo.height, kind, lines]);

  const resetView = useCallback(() => {
    dragRef.current = null;
    orbitInput.reset(baseOrbit);
  }, [baseOrbit, orbitInput]);

  const movePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const azimuth = drag.azimuth + (event.clientX - drag.x) * 0.007;
      const polar = clamp(
        0.1,
        drag.polar + (event.clientY - drag.y) * 0.007,
        Math.PI - 0.1,
      );
      orbitInput.schedule((current) => ({ ...current, azimuth, polar }));
    },
    [orbitInput],
  );

  const releasePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.id !== event.pointerId) return;
      if (event.type === "pointerup") movePointer(event);
      orbitInput.flush();
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [movePointer, orbitInput],
  );

  const downloadSvg = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hlr-${kind}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [kind, svg]);

  return (
    <div className="editorial-diagram" data-interactive={interactive}>
      <div
        className="editorial-diagram-canvas"
        role="img"
        aria-label={LABELS[kind]}
        aria-describedby={interactive ? hintId : undefined}
        tabIndex={interactive ? 0 : undefined}
        style={{ touchAction: "pan-y" }}
        onPointerDown={
          interactive
            ? (event) => {
                if (event.button !== 0 || event.pointerType === "touch") return;
                const current = orbitInput.current();
                dragRef.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  azimuth: current.azimuth,
                  polar: current.polar,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.focus({ preventScroll: true });
              }
            : undefined
        }
        onPointerMove={interactive ? movePointer : undefined}
        onPointerUp={interactive ? releasePointer : undefined}
        onPointerCancel={interactive ? releasePointer : undefined}
        onLostPointerCapture={
          interactive
            ? () => {
                orbitInput.flush();
                dragRef.current = null;
              }
            : undefined
        }
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Home") {
                  event.preventDefault();
                  resetView();
                  return;
                }
                const delta: Record<string, [number, number]> = {
                  ArrowLeft: [-0.1, 0],
                  ArrowRight: [0.1, 0],
                  ArrowUp: [0, -0.1],
                  ArrowDown: [0, 0.1],
                };
                const step = delta[event.key];
                if (!step) return;
                event.preventDefault();
                dragRef.current = null;
                orbitInput.reset((current) => ({
                  ...current,
                  azimuth: current.azimuth + step[0],
                  polar: clamp(0.1, current.polar + step[1], Math.PI - 0.1),
                }));
              }
            : undefined
        }
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {interactive && (
        <div className="editorial-diagram-toolbar">
          <span id={hintId} className="editorial-diagram-hint">
            드래그 또는 방향키로 회전
          </span>
          <button
            type="button"
            onClick={resetView}
            title="처음 시점으로 돌아가기 (Home 키)"
            aria-label="도형의 시점 초기화"
          >
            시점 초기화
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            title="현재 도형을 SVG 파일로 저장"
            aria-label="현재 도형을 SVG 파일로 저장"
          >
            SVG 저장 ↗
          </button>
        </div>
      )}
    </div>
  );
}
