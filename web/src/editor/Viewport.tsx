import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Camera } from "@hlr/camera/camera.js";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { SvgStyle } from "@hlr/svg/svgWriter.js";
import {
  SurfaceDiagram,
  type SurfaceDiagramHandle,
} from "../components/SurfaceDiagram";
import { useElementSize } from "../docs/examples/useElementSize";
import { clamp, type OrbitState } from "../runtime/orbit";
import type { FrameStateControl } from "../runtime/useFrameState";
import { annotationSvg, boundsCorners, type BuiltScene } from "./build";
import {
  add3,
  axisAngleMatrix,
  eulerToMatrix,
  matrixToEulerNear,
  mulMat,
  scale3,
  snapValue,
  vec,
  type Tuple3,
} from "./math";
import {
  isPositioned,
  isRotated,
  type EditorDoc,
  type EditorObject,
  type RenderSettings,
} from "./model";
import type { EditorAction } from "./state";
import { cameraFor, type Projection } from "./viewCamera";

export type { Projection };

export type GizmoMode = "move" | "rotate";

const UP = new Vec3(0, 1, 0);
const AXES: readonly Tuple3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const AXIS_NAMES = ["X", "Y", "Z"] as const;

function lineStyle(
  hiddenLines: RenderSettings["hiddenLines"],
  visible: number,
): Partial<SvgStyle> {
  const base = {
    strokeVisible: "#0a0a0a",
    strokeHidden: "#0a0a0a",
    strokeWidthVisible: visible,
  };
  if (hiddenLines === "removed")
    return { ...base, strokeWidthHidden: visible, opacityHidden: 0 };
  if (hiddenLines === "solid")
    return {
      ...base,
      strokeWidthHidden: visible,
      dashArrayHidden: "none",
      opacityHidden: 1,
    };
  return {
    ...base,
    strokeWidthHidden: Math.max(0.75, visible * 0.78),
    dashArrayHidden: "3.2 2.6",
    opacityHidden: 0.9,
  };
}

type Drag =
  | {
      kind: "orbit";
      id: number;
      x: number;
      y: number;
      view: OrbitState;
      moved: boolean;
    }
  | { kind: "pan"; id: number; x: number; y: number; view: OrbitState }
  | {
      kind: "move";
      id: number;
      x: number;
      y: number;
      objectId: string;
      start: Tuple3;
      /** Axis index, or -1 for the screen plane. */
      axis: number;
      checkpointed: boolean;
    }
  | {
      kind: "rotate";
      id: number;
      objectId: string;
      start: Tuple3;
      pivot: { x: number; y: number };
      angle0: number;
      axis: number;
      toward: boolean;
    };

export type ViewportHandle = {
  exportSvg(): string;
  camera(): Camera;
  size(): { width: number; height: number };
};

type ViewportProps = {
  doc: EditorDoc;
  scene: BuiltScene;
  selection: string | null;
  dispatch: React.Dispatch<EditorAction>;
  view: OrbitState;
  viewInput: FrameStateControl<OrbitState>;
  projection: Projection;
  gizmo: GizmoMode;
  snap: number;
  onRendered?: (ms: number) => void;
};

/** World units per screen pixel at a point, for both projections. */
function worldPerPixel(camera: Camera, p: Tuple3, height: number): number {
  if (camera.kind === "orthographic") return (2 * camera.halfHeight!) / height;
  const depth = Vec3.dot(Vec3.sub(vec(p), camera.position), camera.forward);
  return (2 * Math.max(0.05, depth) * Math.tan(camera.fovYRad! / 2)) / height;
}

function basisFor(axis: Tuple3): [Tuple3, Tuple3] {
  const helper: Tuple3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const a = Vec3.normalize(Vec3.cross(vec(helper), vec(axis)));
  const b = Vec3.cross(vec(axis), a);
  return [
    [a.x, a.y, a.z],
    [b.x, b.y, b.z],
  ];
}

const f = (n: number) => n.toFixed(1);

export const Viewport = forwardRef<ViewportHandle, ViewportProps>(
  function Viewport(
    {
      doc,
      scene,
      selection,
      dispatch,
      view,
      viewInput,
      projection,
      gizmo,
      snap,
      onRendered,
    },
    ref,
  ) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const diagramRef = useRef<SurfaceDiagramHandle | null>(null);
    const size = useElementSize(wrapRef);
    const width = Math.max(1, size.width || 960);
    const height = Math.max(1, size.height || 640);
    const dragRef = useRef<Drag | null>(null);
    const [dragging, setDragging] = useState(false);
    const { settings } = doc;

    const camera = useMemo(
      () => cameraFor(view, projection, width, height),
      [view, projection, width, height],
    );
    const hlrScene = useMemo(
      () => new Scene(scene.primitives),
      [scene.primitives],
    );
    const renderer = useMemo(
      () =>
        new SvgRenderer({
          width,
          height,
          background: false,
          hlr: { samples: 128, coarseSamples: 0, refineIters: 18 },
          intersections: { angularSamples: 128 },
        }),
      [width, height],
    );
    const { hiddenLines, strokeWidth, labels, pointDots, intersections } =
      settings;
    const style = useMemo(
      () => lineStyle(hiddenLines, strokeWidth),
      [hiddenLines, strokeWidth],
    );
    const curves = useMemo(
      () => scene.segments.map((s) => s.curve),
      [scene.segments],
    );

    const timing = useRef(0);
    const lineSvg = useMemo(() => {
      const started = performance.now();
      const svg = renderer.render(hlrScene, camera, {
        curves,
        include: { intersections },
        style,
        // Coarser visibility sampling while the view or a shape is moving.
        hlr: dragging ? { samples: 64, coarseSamples: 16 } : undefined,
      });
      const notes = annotationSvg(
        doc.objects,
        { labels, pointDots },
        scene,
        camera,
        width,
        height,
      );
      timing.current = performance.now() - started;
      return notes ? svg.replace(/<\/svg>\s*$/, () => `${notes}</svg>`) : svg;
    }, [
      renderer,
      hlrScene,
      camera,
      curves,
      intersections,
      style,
      dragging,
      doc.objects,
      labels,
      pointDots,
      scene,
      width,
      height,
    ]);

    useEffect(() => onRendered?.(timing.current), [lineSvg, onRendered]);

    const surfaces = settings.shading || settings.grid;
    const unlit = useMemo(
      () => (settings.shading ? undefined : scene.primitives.map((p) => p.id)),
      [settings.shading, scene.primitives],
    );
    const lighting = useMemo(
      () => ({
        enabled: surfaces,
        azimuth: settings.lightAzimuth,
        elevation: settings.lightElevation,
        ambient: settings.ambient,
      }),
      [
        surfaces,
        settings.lightAzimuth,
        settings.lightElevation,
        settings.ambient,
      ],
    );

    useImperativeHandle(
      ref,
      () => ({
        // Guides and gizmos live in a separate layer and never reach the file.
        exportSvg: () =>
          settings.shading ? (diagramRef.current?.toSvg() ?? lineSvg) : lineSvg,
        camera: () => camera,
        size: () => ({ width, height }),
      }),
      [settings.shading, lineSvg, camera, width, height],
    );

    // Wheel zoom must be able to stop the page from scrolling.
    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const factor = Math.exp(event.deltaY * 0.0012);
        viewInput.schedule((current) => ({
          ...current,
          radius: clamp(0.8, current.radius * factor, 400),
        }));
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [viewInput]);

    const selected =
      doc.objects.find((object) => object.id === selection) ?? null;
    const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
    const right = Vec3.normalize(Vec3.cross(camera.forward, UP));
    const screenUp = Vec3.cross(right, camera.forward);

    const pointer = (event: React.PointerEvent) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      const handle = target.closest("[data-gizmo]")?.getAttribute("data-gizmo");
      const pick = target.closest("[data-pick]")?.getAttribute("data-pick");
      const at = pointer(event);
      const capture = () =>
        event.currentTarget.setPointerCapture(event.pointerId);

      if (handle && selected && isPositioned(selected)) {
        const [mode, axisName] = handle.split("-") as [string, string];
        const axis =
          axisName === "c"
            ? -1
            : AXIS_NAMES.indexOf(axisName.toUpperCase() as "X");
        if (mode === "move") {
          dragRef.current = {
            kind: "move",
            id: event.pointerId,
            x: at.x,
            y: at.y,
            objectId: selected.id,
            start: selected.position,
            axis,
            checkpointed: false,
          };
        } else if (isRotated(selected)) {
          const pivot = project(selected.position);
          const a = AXES[axis]!;
          const toCamera =
            camera.kind === "orthographic"
              ? Vec3.mulScalar(camera.forward, -1)
              : Vec3.sub(camera.position, vec(selected.position));
          dispatch({ type: "checkpoint" });
          dragRef.current = {
            kind: "rotate",
            id: event.pointerId,
            objectId: selected.id,
            start: selected.rotation,
            pivot,
            angle0: Math.atan2(at.y - pivot.y, at.x - pivot.x),
            axis,
            toward: Vec3.dot(vec(a), toCamera) > 0,
          };
        }
        capture();
        setDragging(true);
        return;
      }

      if (pick) {
        dispatch({ type: "select", id: pick });
        const object = doc.objects.find((o) => o.id === pick);
        // Points can be dragged straight away in the screen plane.
        if (object?.kind === "point" && event.button === 0) {
          dragRef.current = {
            kind: "move",
            id: event.pointerId,
            x: at.x,
            y: at.y,
            objectId: object.id,
            start: object.position,
            axis: -1,
            checkpointed: false,
          };
          capture();
          setDragging(true);
        }
        return;
      }

      const panning =
        event.button === 1 || event.button === 2 || event.shiftKey;
      dragRef.current = panning
        ? {
            kind: "pan",
            id: event.pointerId,
            x: at.x,
            y: at.y,
            view: viewInput.current(),
          }
        : {
            kind: "orbit",
            id: event.pointerId,
            x: at.x,
            y: at.y,
            view: viewInput.current(),
            moved: false,
          };
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      const at = pointer(event);

      if (drag.kind === "orbit") {
        const dx = at.x - drag.x;
        const dy = at.y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        if (!drag.moved) {
          drag.moved = true;
          setDragging(true);
        }
        viewInput.schedule({
          ...drag.view,
          azimuth: drag.view.azimuth - dx * 0.008,
          polar: clamp(0.02, drag.view.polar - dy * 0.008, Math.PI - 0.02),
        });
        return;
      }
      if (drag.kind === "pan") {
        const k = worldPerPixel(
          camera,
          [drag.view.target.x, drag.view.target.y, drag.view.target.z],
          height,
        );
        const dx = (at.x - drag.x) * k;
        const dy = (at.y - drag.y) * k;
        setDragging(true);
        viewInput.schedule({
          ...drag.view,
          target: Vec3.add(
            drag.view.target,
            Vec3.add(Vec3.mulScalar(right, -dx), Vec3.mulScalar(screenUp, dy)),
          ),
        });
        return;
      }
      if (drag.kind === "move") {
        const dx = at.x - drag.x;
        const dy = at.y - drag.y;
        if (!drag.checkpointed) {
          if (Math.hypot(dx, dy) < 2) return;
          dispatch({ type: "checkpoint" });
          drag.checkpointed = true;
        }
        let next: Tuple3;
        if (drag.axis >= 0) {
          const a = AXES[drag.axis]!;
          const p0 = project(drag.start);
          const p1 = project(add3(drag.start, a));
          const sx = p1.x - p0.x;
          const sy = p1.y - p0.y;
          const len2 = sx * sx + sy * sy;
          if (len2 < 1e-3) return;
          const t = (dx * sx + dy * sy) / len2;
          next = add3(drag.start, scale3(a, t));
          if (snap > 0)
            next = next.map((value, i) =>
              i === drag.axis ? snapValue(value, snap) : value,
            ) as unknown as Tuple3;
        } else {
          const k = worldPerPixel(camera, drag.start, height);
          const delta = Vec3.add(
            Vec3.mulScalar(right, dx * k),
            Vec3.mulScalar(screenUp, -dy * k),
          );
          next = add3(drag.start, [delta.x, delta.y, delta.z]);
          if (snap > 0)
            next = next.map((value) =>
              snapValue(value, snap),
            ) as unknown as Tuple3;
        }
        dispatch({
          type: "update",
          id: drag.objectId,
          patch: { position: next },
          transient: true,
        });
        return;
      }
      // rotate
      let delta =
        Math.atan2(at.y - drag.pivot.y, at.x - drag.pivot.x) - drag.angle0;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      let degrees = ((drag.toward ? -delta : delta) * 180) / Math.PI;
      if (snap > 0) degrees = Math.round(degrees / 15) * 15;
      const rotation = matrixToEulerNear(
        mulMat(
          axisAngleMatrix(AXES[drag.axis]!, degrees),
          eulerToMatrix(drag.start),
        ),
        drag.start,
      );
      dispatch({
        type: "update",
        id: drag.objectId,
        patch: { rotation },
        transient: true,
      });
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;
      viewInput.flush();
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return (
      <div
        ref={wrapRef}
        className="ed-viewport"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onContextMenu={(event) => event.preventDefault()}
      >
        {settings.grid && (
          <GridLayer camera={camera} width={width} height={height} />
        )}
        <SurfaceDiagram
          ref={diagramRef}
          primitives={scene.primitives}
          camera={camera}
          width={width}
          height={height}
          lineSvg={lineSvg}
          lighting={lighting}
          unlitPrimitiveIds={unlit}
          selectedId={selection}
          onSelect={(id) => dispatch({ type: "select", id })}
          interactive={dragging}
          className="ed-surface"
          ariaLabel="3차원 장면. 끌어서 회전, Shift나 오른쪽 단추로 끌어서 이동, 휠로 확대합니다."
        />
        <Overlay
          doc={doc}
          scene={scene}
          selected={selected}
          camera={camera}
          width={width}
          height={height}
          gizmo={gizmo}
        />
      </div>
    );
  },
);

/** Floor grid on y = 0, drawn under the shapes and never exported. */
function GridLayer({
  camera,
  width,
  height,
}: {
  camera: Camera;
  width: number;
  height: number;
}) {
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const extent = 10;
  const lines: React.ReactNode[] = [];
  for (let i = -extent; i <= extent; i++) {
    const strong =
      i === 0
        ? "ed-grid-axis"
        : i % 5 === 0
          ? "ed-grid-major"
          : "ed-grid-minor";
    const a = project([i, 0, -extent]);
    const b = project([i, 0, extent]);
    const c = project([-extent, 0, i]);
    const d = project([extent, 0, i]);
    lines.push(
      <line
        key={`x${i}`}
        className={strong}
        x1={f(a.x)}
        y1={f(a.y)}
        x2={f(b.x)}
        y2={f(b.y)}
      />,
      <line
        key={`z${i}`}
        className={strong}
        x1={f(c.x)}
        y1={f(c.y)}
        x2={f(d.x)}
        y2={f(d.y)}
      />,
    );
  }
  return (
    <svg className="ed-grid" width={width} height={height} aria-hidden="true">
      {lines}
    </svg>
  );
}

function Overlay({
  doc,
  scene,
  selected,
  camera,
  width,
  height,
  gizmo,
}: {
  doc: EditorDoc;
  scene: BuiltScene;
  selected: EditorObject | null;
  camera: Camera;
  width: number;
  height: number;
  gizmo: GizmoMode;
}) {
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const right = Vec3.normalize(Vec3.cross(camera.forward, UP));
  const screenUp = Vec3.cross(right, camera.forward);
  const parts: React.ReactNode[] = [];

  // Segment and point hit targets: they are not raycastable surfaces.
  for (const segment of scene.segments) {
    const a = project(segment.from);
    const b = project(segment.to);
    const active = selected?.id === segment.id;
    parts.push(
      <g key={`seg-${segment.id}`}>
        {active && (
          <line
            className="ed-selected-line"
            x1={f(a.x)}
            y1={f(a.y)}
            x2={f(b.x)}
            y2={f(b.y)}
          />
        )}
        <line
          className="ed-hit-line"
          data-pick={segment.id}
          x1={f(a.x)}
          y1={f(a.y)}
          x2={f(b.x)}
          y2={f(b.y)}
        />
      </g>,
    );
  }
  for (const object of doc.objects) {
    if (object.kind !== "point" || object.hidden) continue;
    const p = project(object.position);
    const active = selected?.id === object.id;
    parts.push(
      <g key={`pt-${object.id}`}>
        {active && (
          <circle className="ed-selected-point" cx={f(p.x)} cy={f(p.y)} r={7} />
        )}
        <circle
          className="ed-hit-point"
          data-pick={object.id}
          cx={f(p.x)}
          cy={f(p.y)}
          r={9}
        />
      </g>,
    );
  }

  // Selection brackets around the projected bounds.
  const bounds =
    selected && !selected.hidden ? scene.bounds.get(selected.id) : undefined;
  if (bounds && selected?.kind !== "point") {
    const corners = boundsCorners(bounds).map(project);
    const x0 = Math.min(...corners.map((c) => c.x)) - 8;
    const x1 = Math.max(...corners.map((c) => c.x)) + 8;
    const y0 = Math.min(...corners.map((c) => c.y)) - 8;
    const y1 = Math.max(...corners.map((c) => c.y)) + 8;
    const l = Math.min(14, (x1 - x0) / 3, (y1 - y0) / 3);
    parts.push(
      <path
        key="brackets"
        className="ed-brackets"
        d={`M ${f(x0)} ${f(y0 + l)} V ${f(y0)} H ${f(x0 + l)} M ${f(x1 - l)} ${f(y0)} H ${f(x1)} V ${f(y0 + l)} M ${f(x1)} ${f(y1 - l)} V ${f(y1)} H ${f(x1 - l)} M ${f(x0 + l)} ${f(y1)} H ${f(x0)} V ${f(y1 - l)}`}
      />,
    );
  }

  // Gizmo at the pivot of a positioned selection.
  if (selected && isPositioned(selected) && !selected.hidden) {
    const p = selected.position;
    const c = project(p);
    const k = worldPerPixel(camera, p, height);
    if (gizmo === "rotate" && isRotated(selected)) {
      const radius = 64 * k;
      AXES.forEach((axis, index) => {
        const [b1, b2] = basisFor(axis);
        const d = Array.from({ length: 65 }, (_, i) => {
          const t = (i / 64) * Math.PI * 2;
          const q = project(
            add3(
              p,
              add3(
                scale3(b1, radius * Math.cos(t)),
                scale3(b2, radius * Math.sin(t)),
              ),
            ),
          );
          return `${i ? "L" : "M"} ${f(q.x)} ${f(q.y)}`;
        }).join(" ");
        const name = AXIS_NAMES[index]!.toLowerCase();
        parts.push(
          <g
            key={`ring-${name}`}
            className="ed-gizmo-part"
            data-gizmo={`rotate-${name}`}
          >
            <path className="ed-gizmo-hit" d={d} />
            <path className="ed-gizmo-line" d={d} />
          </g>,
        );
      });
    } else {
      AXES.forEach((axis, index) => {
        const tip = project(add3(p, scale3(axis, 76 * k)));
        const dx = tip.x - c.x;
        const dy = tip.y - c.y;
        const length = Math.hypot(dx, dy);
        if (length < 14) return; // pointing at the viewer
        const ux = dx / length;
        const uy = dy / length;
        const head = `M ${f(tip.x)} ${f(tip.y)} L ${f(tip.x - ux * 10 - uy * 4)} ${f(tip.y - uy * 10 + ux * 4)} L ${f(tip.x - ux * 10 + uy * 4)} ${f(tip.y - uy * 10 - ux * 4)} Z`;
        const name = AXIS_NAMES[index]!;
        parts.push(
          <g
            key={`axis-${name}`}
            className="ed-gizmo-part"
            data-gizmo={`move-${name.toLowerCase()}`}
          >
            <line
              className="ed-gizmo-hit"
              x1={f(c.x)}
              y1={f(c.y)}
              x2={f(tip.x)}
              y2={f(tip.y)}
            />
            <line
              className="ed-gizmo-line"
              x1={f(c.x + ux * 8)}
              y1={f(c.y + uy * 8)}
              x2={f(tip.x - ux * 8)}
              y2={f(tip.y - uy * 8)}
            />
            <path className="ed-gizmo-head" d={head} />
            <text
              className="ed-gizmo-label"
              x={f(tip.x + ux * 12)}
              y={f(tip.y + uy * 12)}
            >
              {name}
            </text>
          </g>,
        );
      });
      parts.push(
        <g key="axis-c" className="ed-gizmo-part" data-gizmo="move-c">
          <rect
            className="ed-gizmo-center"
            x={f(c.x - 6)}
            y={f(c.y - 6)}
            width={12}
            height={12}
          />
        </g>,
      );
    }
  }

  // View axes in the corner.
  const origin = { x: 44, y: height - 44 };
  const triad = AXES.map((axis, index) => {
    const sx = Vec3.dot(vec(axis), right);
    const sy = -Vec3.dot(vec(axis), screenUp);
    return {
      name: AXIS_NAMES[index]!,
      x: origin.x + sx * 24,
      y: origin.y + sy * 24,
    };
  });

  return (
    <svg className="ed-overlay" width={width} height={height}>
      <g className="ed-triad" aria-hidden="true">
        <circle cx={origin.x} cy={origin.y} r={34} />
        {triad.map((axis) => (
          <g key={axis.name}>
            <line x1={origin.x} y1={origin.y} x2={f(axis.x)} y2={f(axis.y)} />
            <text
              x={f(origin.x + (axis.x - origin.x) * 1.38)}
              y={f(origin.y + (axis.y - origin.y) * 1.38)}
            >
              {axis.name}
            </text>
          </g>
        ))}
      </g>
      {parts}
    </svg>
  );
}
