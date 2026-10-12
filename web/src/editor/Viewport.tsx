import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Camera } from "@hlr/camera/camera.js";
import { curvesFromPrimitives } from "@hlr/core/curves.js";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import { evalCubic3, type CubicBezier3 } from "@hlr/curves/cubicBezier3.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { Scene as RaycastScene } from "@hlr/scene/scene.js";
import {
  SurfaceDiagram,
  type SurfaceDiagramHandle,
} from "../components/SurfaceDiagram";
import { useElementSize } from "../docs/examples/useElementSize";
import { useSurfaceTones } from "../site/theme";
import { clamp, type OrbitState } from "../runtime/orbit";
import type { FrameStateControl } from "../runtime/useFrameState";
import {
  angleData,
  angleMarkPath,
  annotationSvg,
  boundsCorners,
  forcedLinesSvg,
  layoutLabels,
  lineStyle,
  measureMark,
  type BuiltScene,
  type LaidLabel,
} from "./build";
import {
  add3,
  axisAngleMatrix,
  dot3,
  frameOf,
  scale3,
  snapValue,
  sub3,
  vec,
  type Tuple3,
} from "./math";
import {
  isPositioned,
  isRotated,
  type EditorDoc,
  type EditorObject,
  type PointObject,
  type PositionedObject,
} from "./model";
import { sphereAngles } from "./resolve";
import type { EditorAction } from "./state";
import {
  axisScalePatch,
  movePatches,
  pivotOf,
  rotatePatches,
  scaleAxesOf,
  scalePatches,
  transformTargets,
} from "./transform";
import { cameraFor, type Projection } from "./viewCamera";

export type { Projection };

export type GizmoMode = "move" | "rotate" | "scale";

const UP = new Vec3(0, 1, 0);
const AXES: readonly Tuple3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const AXIS_NAMES = ["X", "Y", "Z"] as const;
/** Gizmo sizes in screen pixels. */
const ARROW = 76;
const RING = 64;
const SCALE_ARM = 62;
const SCALE_RING = 92;

type Point2 = { x: number; y: number };

type Drag =
  | {
      kind: "orbit";
      id: number;
      x: number;
      y: number;
      view: OrbitState;
      moved: boolean;
      /** Shift, the wheel button or the right button pan instead. */
      pan: boolean;
      /** A press without movement is a click that picks. */
      click: boolean;
      additive: boolean;
    }
  | {
      kind: "pinch";
      ids: [number, number];
      view: OrbitState;
      distance: number;
      mid: Point2;
    }
  | {
      kind: "transform";
      id: number;
      x: number;
      y: number;
      mode: GizmoMode;
      /** 0–2 an axis; -1 the screen plane or uniform scale; 3 the floor plane. */
      axis: number;
      pivot: Tuple3;
      targets: PositionedObject[];
      started: boolean;
      /** Rotate: the starting angle about the pivot and whether the axis faces us. */
      angle0: number;
      toward: boolean;
      /** Scale: start distance from the pivot on screen, along the arm for one axis. */
      reach0: number;
      arm: Point2;
      floor0: Tuple3 | null;
    }
  | {
      kind: "point";
      id: number;
      x: number;
      y: number;
      point: PointObject;
      start: Tuple3;
      started: boolean;
    }
  | {
      kind: "label";
      id: number;
      x: number;
      y: number;
      objectId: string;
      start: readonly [number, number];
      started: boolean;
    };

export type ViewportHandle = {
  exportSvg(): string;
  camera(): Camera;
  size(): { width: number; height: number };
};

type ViewportProps = {
  doc: EditorDoc;
  scene: BuiltScene;
  selection: readonly string[];
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

/** Local axes the scale gizmo pulls along (null where a shape has no size). */
function scaleFrame(
  object: EditorObject | undefined,
): (Tuple3 | null)[] | null {
  if (!object || !isPositioned(object) || object.kind === "point") return null;
  const usable = scaleAxesOf(object);
  if (!usable.some(Boolean)) return null;
  const axes = isRotated(object)
    ? (() => {
        const { right, up, forward } = frameOf(object.rotation);
        return [right, up, forward];
      })()
    : AXES;
  return axes.map((axis, i) => (usable[i] ? axis : null));
}

const f = (n: number) => n.toFixed(1);

function cubicPath(bez: CubicBezier3, project: (p: Vec3) => Point2): string {
  return Array.from({ length: 13 }, (_, i) => {
    const q = project(evalCubic3(bez, i / 12));
    return `${i ? "L" : "M"} ${f(q.x)} ${f(q.y)}`;
  }).join(" ");
}

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
    const pointers = useRef(new Map<number, Point2>());
    const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null);
    const tones = useSurfaceTones();
    const dragging = dragKind !== null;
    const { settings } = doc;

    const camera = useMemo(
      () => cameraFor(view, projection, width, height),
      [view, projection, width, height],
    );
    const hlrScene = useMemo(
      () => new Scene(scene.primitives),
      [scene.primitives],
    );
    const occluders = useMemo(
      () => new RaycastScene(scene.primitives, camera, undefined, true),
      [scene.primitives, camera],
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

    const timing = useRef(0);
    const lineSvg = useMemo(() => {
      const started = performance.now();
      const svg = renderer.render(hlrScene, camera, {
        curves: scene.curves,
        ownedCurves: intersections ? scene.sections : undefined,
        include: { intersections },
        style,
        // Coarser visibility sampling while the view or a shape is moving.
        hlr: dragging ? { samples: 64, coarseSamples: 16 } : undefined,
      });
      const extra =
        forcedLinesSvg(scene, camera, width, height, strokeWidth) +
        annotationSvg(
          doc.objects,
          { labels, pointDots },
          scene,
          camera,
          width,
          height,
          occluders,
        );
      timing.current = performance.now() - started;
      return extra ? svg.replace(/<\/svg>\s*$/, () => `${extra}</svg>`) : svg;
    }, [
      renderer,
      hlrScene,
      occluders,
      camera,
      intersections,
      style,
      strokeWidth,
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

    // Wheel zoom keeps the point under the cursor in place.
    const zoomRef = useRef({ camera, width, height });
    zoomRef.current = { camera, width, height };
    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const { camera: cam, width: w, height: h } = zoomRef.current;
        const rect = el.getBoundingClientRect();
        const factor = Math.exp(
          (event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY) * 0.0012,
        );
        viewInput.schedule((current) => {
          const radius = clamp(0.8, current.radius * factor, 400);
          const k = worldPerPixel(
            cam,
            [current.target.x, current.target.y, current.target.z],
            h,
          );
          const side = Vec3.normalize(Vec3.cross(cam.forward, UP));
          const lift = Vec3.cross(side, cam.forward);
          const dx = (event.clientX - rect.left - w / 2) * k;
          const dy = (event.clientY - rect.top - h / 2) * k;
          const toCursor = Vec3.add(
            Vec3.mulScalar(side, dx),
            Vec3.mulScalar(lift, -dy),
          );
          const kept = 1 - radius / current.radius;
          return {
            ...current,
            radius,
            target: Vec3.add(current.target, Vec3.mulScalar(toCursor, kept)),
          };
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [viewInput]);

    const byId = useMemo(
      () => new Map(doc.objects.map((object) => [object.id, object])),
      [doc.objects],
    );
    const targets = useMemo(
      () => transformTargets(doc.objects, selection),
      [doc.objects, selection],
    );
    const pivot = useMemo(
      () => pivotOf(doc.objects, selection, scene, targets),
      [doc.objects, selection, scene, targets],
    );
    const single = selection.length === 1 ? byId.get(selection[0]!) : undefined;
    const axesForScale = useMemo(() => scaleFrame(single), [single]);
    const laid = useMemo(
      () =>
        layoutLabels(doc.objects, { labels }, scene, camera, width, height),
      [doc.objects, labels, scene, camera, width, height],
    );

    const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
    const right = Vec3.normalize(Vec3.cross(camera.forward, UP));
    const screenUp = Vec3.cross(right, camera.forward);

    const pointer = (event: { clientX: number; clientY: number }) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const rayAt = (at: Point2) => camera.screenToRay(at.x, at.y, width, height);

    /** Everything under the cursor, drawn shapes first, nearest first. */
    const pickAt = (at: Point2): string[] => {
      const ray = rayAt(at);
      const depth = Vec3.dot(ray.dir, camera.forward);
      const tMin = camera.kind === "perspective" ? camera.near / depth : 0;
      const tMax =
        camera.kind === "perspective"
          ? camera.far / depth
          : camera.far - camera.near;
      const hits: { id: string; t: number; layer: number }[] = [];
      for (const item of scene.pickables) {
        const hit = item.primitive.intersect(ray, tMin, tMax);
        if (hit) hits.push({ id: item.objectId, t: hit.t, layer: item.layer });
      }
      hits.sort((a, b) => a.layer - b.layer || a.t - b.t);
      return [...new Set(hits.map((h) => h.id))];
    };

    const choose = (id: string, additive: boolean) => {
      if (additive) dispatch({ type: "toggle", id });
      else if (!selection.includes(id) || selection.length > 1)
        dispatch({ type: "select", ids: [id] });
    };

    /** Clicking the same spot again steps to the next shape underneath. */
    const clickPick = (at: Point2, additive: boolean) => {
      const ids = pickAt(at);
      if (additive) {
        if (ids[0]) dispatch({ type: "toggle", id: ids[0] });
        return;
      }
      if (!ids.length) {
        dispatch({ type: "select", ids: [] });
        return;
      }
      const current = selection.length === 1 ? ids.indexOf(selection[0]!) : -1;
      dispatch({
        type: "select",
        ids: [current >= 0 ? ids[(current + 1) % ids.length]! : ids[0]!],
      });
    };

    const floorHit = (at: Point2, y: number): Tuple3 | null => {
      const ray = rayAt(at);
      if (Math.abs(ray.dir.y) < 1e-6) return null;
      const t = (y - ray.origin.y) / ray.dir.y;
      return [ray.origin.x + ray.dir.x * t, y, ray.origin.z + ray.dir.z * t];
    };

    const beginDrag = (
      event: React.PointerEvent<HTMLDivElement>,
      drag: Drag,
      live = true,
    ) => {
      dragRef.current = drag;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (live) setDragKind(drag.kind);
    };

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      const at = pointer(event);
      pointers.current.set(event.pointerId, at);
      if (event.pointerType === "touch" && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.entries()];
        dragRef.current = {
          kind: "pinch",
          ids: [a![0], b![0]],
          view: viewInput.current(),
          distance: Math.max(
            1,
            Math.hypot(a![1].x - b![1].x, a![1].y - b![1].y),
          ),
          mid: { x: (a![1].x + b![1].x) / 2, y: (a![1].y + b![1].y) / 2 },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragKind("pinch");
        return;
      }
      if (dragRef.current) return;
      const target = event.target as Element;
      const handle = target
        .closest("[data-gizmo]")
        ?.getAttribute("data-gizmo");
      const labelId = target
        .closest("[data-label]")
        ?.getAttribute("data-label");
      const pick = target.closest("[data-pick]")?.getAttribute("data-pick");
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;

      if (handle && pivot && event.button === 0) {
        const [mode, axisName] = handle.split("-") as [GizmoMode, string];
        const axis =
          axisName === "c" || axisName === "u"
            ? -1
            : axisName === "f"
              ? 3
              : AXIS_NAMES.indexOf(axisName.toUpperCase() as "X");
        const c = project(pivot);
        let arm = { x: 1, y: 0 };
        const scaleAxis = axis >= 0 ? axesForScale?.[axis] : null;
        if (mode === "scale" && axis >= 0 && !scaleAxis) return;
        if (scaleAxis) {
          const tip = project(add3(pivot, scaleAxis));
          const len = Math.hypot(tip.x - c.x, tip.y - c.y) || 1;
          arm = { x: (tip.x - c.x) / len, y: (tip.y - c.y) / len };
        }
        const toCamera =
          camera.kind === "orthographic"
            ? Vec3.mulScalar(camera.forward, -1)
            : Vec3.sub(camera.position, vec(pivot));
        beginDrag(event, {
          kind: "transform",
          id: event.pointerId,
          x: at.x,
          y: at.y,
          mode,
          axis,
          pivot,
          targets,
          started: false,
          angle0: Math.atan2(at.y - c.y, at.x - c.x),
          toward:
            axis >= 0 && axis < 3
              ? Vec3.dot(vec(AXES[axis]!), toCamera) > 0
              : false,
          reach0:
            axis >= 0
              ? (at.x - c.x) * arm.x + (at.y - c.y) * arm.y
              : Math.hypot(at.x - c.x, at.y - c.y),
          arm,
          floor0: axis === 3 ? floorHit(at, pivot[1]) : null,
        });
        return;
      }

      if (labelId && event.button === 0) {
        choose(labelId, additive);
        const object = byId.get(labelId);
        if (object && !additive)
          beginDrag(
            event,
            {
              kind: "label",
              id: event.pointerId,
              x: at.x,
              y: at.y,
              objectId: labelId,
              start: object.labelOffset ?? [0, 0],
              started: false,
            },
            false,
          );
        return;
      }

      if (pick && event.button === 0) {
        choose(pick, additive);
        const object = byId.get(pick);
        const draggable =
          object?.kind === "point" &&
          (!object.constraint ||
            object.constraint.type === "onSegment" ||
            object.constraint.type === "onSphere" ||
            object.constraint.type === "onPlane");
        if (draggable && !additive)
          beginDrag(
            event,
            {
              kind: "point",
              id: event.pointerId,
              x: at.x,
              y: at.y,
              point: object,
              start: scene.points.get(object.id) ?? object.position,
              started: false,
            },
            false,
          );
        return;
      }

      dragRef.current = {
        kind: "orbit",
        id: event.pointerId,
        x: at.x,
        y: at.y,
        view: viewInput.current(),
        moved: false,
        pan: event.button === 1 || event.button === 2 || event.shiftKey,
        click: event.button === 0,
        additive,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

    const transformPatches = (
      drag: Extract<Drag, { kind: "transform" }>,
      at: Point2,
    ) => {
      const { pivot: p, targets: group } = drag;
      const dx = at.x - drag.x;
      const dy = at.y - drag.y;
      const c = project(p);
      if (drag.mode === "move") {
        let delta: Tuple3;
        if (drag.axis === 3) {
          const now = floorHit(at, p[1]);
          if (!now || !drag.floor0) return null;
          delta = sub3(now, drag.floor0);
          if (snap > 0)
            delta = [
              snapValue(p[0] + delta[0], snap) - p[0],
              0,
              snapValue(p[2] + delta[2], snap) - p[2],
            ];
        } else if (drag.axis >= 0) {
          const a = AXES[drag.axis]!;
          const tip = project(add3(p, a));
          const sx = tip.x - c.x;
          const sy = tip.y - c.y;
          const len2 = sx * sx + sy * sy;
          if (len2 < 1e-3) return null;
          let t = (dx * sx + dy * sy) / len2;
          if (snap > 0)
            t = snapValue(p[drag.axis]! + t, snap) - p[drag.axis]!;
          delta = scale3(a, t);
        } else {
          const k = worldPerPixel(camera, p, height);
          const shift = Vec3.add(
            Vec3.mulScalar(right, dx * k),
            Vec3.mulScalar(screenUp, -dy * k),
          );
          let next = add3(p, [shift.x, shift.y, shift.z]);
          if (snap > 0)
            next = next.map((v) => snapValue(v, snap)) as unknown as Tuple3;
          delta = sub3(next, p);
        }
        return movePatches(group, delta);
      }
      if (drag.mode === "rotate") {
        let delta = Math.atan2(at.y - c.y, at.x - c.x) - drag.angle0;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        let degrees = ((drag.toward ? -delta : delta) * 180) / Math.PI;
        if (snap > 0) degrees = Math.round(degrees / 15) * 15;
        return rotatePatches(
          group,
          p,
          axisAngleMatrix(AXES[drag.axis]!, degrees),
        );
      }
      // scale
      const step = snap > 0 ? 0.05 : 0;
      const shape = group[0];
      if (drag.axis >= 0 && shape) {
        const reach = (at.x - c.x) * drag.arm.x + (at.y - c.y) * drag.arm.y;
        const k = Math.max(0.05, reach / (drag.reach0 || 1));
        return [
          { id: shape.id, patch: axisScalePatch(shape, drag.axis, k, step) },
        ];
      }
      let k = Math.max(
        0.05,
        Math.hypot(at.x - c.x, at.y - c.y) / Math.max(1, drag.reach0),
      );
      if (step) k = Math.max(0.05, Math.round(k / step) * step);
      return scalePatches(group, p, k);
    };

    const pointPatch = (
      drag: Extract<Drag, { kind: "point" }>,
      at: Point2,
    ): Partial<EditorObject> | null => {
      const c = drag.point.constraint;
      if (!c) {
        const k = worldPerPixel(camera, drag.start, height);
        const shift = Vec3.add(
          Vec3.mulScalar(right, (at.x - drag.x) * k),
          Vec3.mulScalar(screenUp, -(at.y - drag.y) * k),
        );
        let next = add3(drag.start, [shift.x, shift.y, shift.z]);
        if (snap > 0)
          next = next.map((v) => snapValue(v, snap)) as unknown as Tuple3;
        return { position: next };
      }
      if (c.type === "onSegment") {
        const segment = byId.get(c.segment);
        if (segment?.kind !== "segment") return null;
        const a3 = scene.points.get(segment.from);
        const b3 = scene.points.get(segment.to);
        if (!a3 || !b3) return null;
        const a = project(a3);
        const b = project(b3);
        const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        if (len2 < 1) return null;
        let t = clamp(
          0,
          ((at.x - a.x) * (b.x - a.x) + (at.y - a.y) * (b.y - a.y)) / len2,
          1,
        );
        if (snap > 0) t = Math.round(t * 20) / 20;
        return { constraint: { ...c, t } };
      }
      if (c.type === "onSphere") {
        const sphere = byId.get(c.sphere);
        if (sphere?.kind !== "sphere") return null;
        const ray = rayAt(at);
        const center = vec(sphere.position);
        const oc = Vec3.sub(ray.origin, center);
        const b = Vec3.dot(oc, ray.dir);
        const disc = b * b - (Vec3.lenSq(oc) - sphere.radius ** 2);
        const t = disc >= 0 ? -b - Math.sqrt(disc) : -b;
        const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
        let { azimuth, elevation } = sphereAngles([
          p.x - center.x,
          p.y - center.y,
          p.z - center.z,
        ]);
        if (snap > 0) {
          azimuth = Math.round(azimuth / 5) * 5;
          elevation = Math.round(elevation / 5) * 5;
        }
        return { constraint: { ...c, azimuth, elevation } };
      }
      if (c.type === "onPlane") {
        const plane = byId.get(c.plane);
        if (plane?.kind !== "plane") return null;
        const frame = frameOf(plane.rotation);
        const ray = rayAt(at);
        const dir: Tuple3 = [ray.dir.x, ray.dir.y, ray.dir.z];
        const origin: Tuple3 = [ray.origin.x, ray.origin.y, ray.origin.z];
        const denom = dot3(dir, frame.up);
        if (Math.abs(denom) < 1e-9) return null;
        const t = dot3(sub3(plane.position, origin), frame.up) / denom;
        const hit = add3(origin, scale3(dir, t));
        const rel = sub3(hit, plane.position);
        let u = dot3(rel, frame.right);
        let v = dot3(rel, frame.forward);
        if (snap > 0) {
          u = snapValue(u, snap / 2);
          v = snapValue(v, snap / 2);
        }
        return { constraint: { ...c, u, v } };
      }
      return null;
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const at = pointer(event);
      if (pointers.current.has(event.pointerId))
        pointers.current.set(event.pointerId, at);
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === "pinch") {
        const a = pointers.current.get(drag.ids[0]);
        const b = pointers.current.get(drag.ids[1]);
        if (!a || !b) return;
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const radius = clamp(
          0.8,
          (drag.view.radius * drag.distance) / distance,
          400,
        );
        const k = worldPerPixel(
          camera,
          [drag.view.target.x, drag.view.target.y, drag.view.target.z],
          height,
        );
        viewInput.schedule({
          ...drag.view,
          radius,
          target: Vec3.add(
            drag.view.target,
            Vec3.add(
              Vec3.mulScalar(right, -(mid.x - drag.mid.x) * k),
              Vec3.mulScalar(screenUp, (mid.y - drag.mid.y) * k),
            ),
          ),
        });
        return;
      }
      if (drag.id !== event.pointerId) return;
      const dx = at.x - drag.x;
      const dy = at.y - drag.y;

      if (drag.kind === "orbit") {
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        if (!drag.moved) {
          drag.moved = true;
          setDragKind("orbit");
        }
        if (drag.pan) {
          const k = worldPerPixel(
            camera,
            [drag.view.target.x, drag.view.target.y, drag.view.target.z],
            height,
          );
          viewInput.schedule({
            ...drag.view,
            target: Vec3.add(
              drag.view.target,
              Vec3.add(
                Vec3.mulScalar(right, -dx * k),
                Vec3.mulScalar(screenUp, dy * k),
              ),
            ),
          });
        } else
          viewInput.schedule({
            ...drag.view,
            azimuth: drag.view.azimuth - dx * 0.008,
            polar: clamp(0.02, drag.view.polar - dy * 0.008, Math.PI - 0.02),
          });
        return;
      }

      if (!drag.started) {
        if (Math.hypot(dx, dy) < 2) return;
        dispatch({ type: "checkpoint" });
        drag.started = true;
        setDragKind(drag.kind);
      }
      if (drag.kind === "transform") {
        const patches = transformPatches(drag, at);
        if (patches)
          dispatch({ type: "updateMany", patches, transient: true });
      } else if (drag.kind === "point") {
        const patch = pointPatch(drag, at);
        if (patch)
          dispatch({
            type: "update",
            id: drag.point.id,
            patch,
            transient: true,
          });
      } else {
        dispatch({
          type: "update",
          id: drag.objectId,
          patch: {
            labelOffset: [
              Math.round(drag.start[0] + dx),
              Math.round(drag.start[1] + dy),
            ],
          },
          transient: true,
        });
      }
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      const drag = dragRef.current;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag) return;
      if (drag.kind === "pinch") {
        if (drag.ids.includes(event.pointerId)) {
          viewInput.flush();
          dragRef.current = null;
          setDragKind(null);
        }
        return;
      }
      if (drag.id !== event.pointerId) return;
      viewInput.flush();
      dragRef.current = null;
      setDragKind(null);
      if (
        drag.kind === "orbit" &&
        !drag.moved &&
        drag.click &&
        event.type === "pointerup"
      )
        clickPick(pointer(event), drag.additive);
    };

    const ghosts = useMemo(() => {
      const out: { id: string; d: string; strong: boolean }[] = [];
      const projectVec = (p: Vec3) => camera.projectToSvg(p, width, height);
      const draw = (objectId: string, strong: boolean) => {
        const item = scene.pickables.find(
          (p) => p.objectId === objectId && p.layer === 2,
        );
        if (!item) return;
        const d = curvesFromPrimitives([item.primitive], camera)
          .map((bez) => cubicPath(bez, projectVec))
          .join(" ");
        out.push({ id: objectId, d, strong });
      };
      for (const id of selection) {
        const object = byId.get(id);
        if (scene.consumed.has(id)) draw(id, true);
        else if (object?.kind === "boolean") {
          draw(object.a, false);
          draw(object.b, false);
        }
      }
      return out;
    }, [selection, byId, scene, camera, width, height]);

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
          selectedId={settings.shading ? (selection[0] ?? null) : null}
          tones={tones}
          interactive={dragging}
          className="ed-surface"
          ariaLabel="3차원 장면. 끌어서 회전, Shift나 오른쪽 단추로 끌어서 이동, 휠로 확대합니다. 누르면 고르고 Shift를 누르고 누르면 여럿을 고릅니다."
        />
        <Overlay
          objects={doc.objects}
          scene={scene}
          selection={selection}
          camera={camera}
          width={width}
          height={height}
          gizmo={gizmo}
          pivot={
            dragKind === null || dragKind === "transform" ? pivot : null
          }
          canRotate={targets.some(isRotated) || targets.length > 1}
          scaleAxes={axesForScale}
          labels={laid}
          showLabels={labels}
          ghosts={ghosts}
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
      i === 0 ? "ed-grid-axis" : i % 5 === 0 ? "ed-grid-major" : "ed-grid-minor";
    const a = project([i, 0, -extent]);
    const b = project([i, 0, extent]);
    const c = project([-extent, 0, i]);
    const d = project([extent, 0, i]);
    lines.push(
      <line key={`x${i}`} className={strong} x1={f(a.x)} y1={f(a.y)} x2={f(b.x)} y2={f(b.y)} />,
      <line key={`z${i}`} className={strong} x1={f(c.x)} y1={f(c.y)} x2={f(d.x)} y2={f(d.y)} />,
    );
  }
  return (
    <svg className="ed-grid" width={width} height={height} aria-hidden="true">
      {lines}
    </svg>
  );
}

function Overlay({
  objects,
  scene,
  selection,
  camera,
  width,
  height,
  gizmo,
  pivot,
  canRotate,
  scaleAxes,
  labels,
  showLabels,
  ghosts,
}: {
  objects: readonly EditorObject[];
  scene: BuiltScene;
  selection: readonly string[];
  camera: Camera;
  width: number;
  height: number;
  gizmo: GizmoMode;
  pivot: Tuple3 | null;
  canRotate: boolean;
  scaleAxes: (Tuple3 | null)[] | null;
  labels: readonly LaidLabel[];
  showLabels: boolean;
  ghosts: readonly { id: string; d: string; strong: boolean }[];
}) {
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const right = Vec3.normalize(Vec3.cross(camera.forward, UP));
  const screenUp = Vec3.cross(right, camera.forward);
  const selected = new Set(selection);
  const hits: React.ReactNode[] = [];
  const marks: React.ReactNode[] = [];

  for (const ghost of ghosts)
    marks.push(
      <path
        key={`ghost-${ghost.id}`}
        className={ghost.strong ? "ed-ghost is-strong" : "ed-ghost"}
        d={ghost.d}
      />,
    );

  // Labels can be dragged; points drawn later win where the two overlap.
  for (const label of labels) {
    const active = selected.has(label.id);
    hits.push(
      <rect
        key={`label-${label.id}`}
        className={active ? "ed-label-hit is-selected" : "ed-label-hit"}
        data-label={label.id}
        x={f(label.x - label.width / 2)}
        y={f(label.y - label.height / 2)}
        width={f(label.width)}
        height={f(label.height)}
        rx={3}
      />,
    );
  }

  // Hit targets for what the raycaster cannot see: lines, points and marks.
  for (const segment of scene.segments) {
    const a = project(segment.from);
    const b = project(segment.to);
    if (selected.has(segment.id))
      marks.push(
        <line
          key={`sel-${segment.id}`}
          className="ed-selected-line"
          x1={f(a.x)}
          y1={f(a.y)}
          x2={f(b.x)}
          y2={f(b.y)}
        />,
      );
    hits.push(
      <line
        key={`hit-${segment.id}`}
        className="ed-hit-line"
        data-pick={segment.id}
        x1={f(a.x)}
        y1={f(a.y)}
        x2={f(b.x)}
        y2={f(b.y)}
      />,
    );
  }
  for (const object of objects) {
    if (object.hidden || scene.consumed.has(object.id)) continue;
    if (object.kind === "angle") {
      const data = angleData(object, scene.points);
      if (!data) continue;
      const d = angleMarkPath(data, object.radius, project);
      if (selected.has(object.id))
        marks.push(<path key={`sel-${object.id}`} className="ed-selected-line" d={d} />);
      hits.push(<path key={`hit-${object.id}`} className="ed-hit-line" data-pick={object.id} d={d} />);
    } else if (object.kind === "measure") {
      const mark = measureMark(object, scene, camera, width, height, showLabels);
      if (!mark) continue;
      if (selected.has(object.id))
        marks.push(
          <path
            key={`sel-${object.id}`}
            className="ed-selected-measure"
            d={mark.path}
          />,
        );
      if (object.arc !== false)
        hits.push(
          <path
            key={`hit-${object.id}`}
            className="ed-hit-line"
            data-pick={object.id}
            d={mark.full}
          />,
        );
    } else if (object.kind === "face" && selected.has(object.id)) {
      const corners = object.points
        .map((id) => scene.points.get(id))
        .filter((p): p is Tuple3 => !!p)
        .map(project);
      if (corners.length >= 3)
        marks.push(
          <polygon
            key={`sel-${object.id}`}
            className="ed-selected-face"
            points={corners.map((c) => `${f(c.x)},${f(c.y)}`).join(" ")}
          />,
        );
    }
  }
  for (const object of objects) {
    if (object.kind !== "point" || object.hidden) continue;
    const p = project(scene.points.get(object.id) ?? object.position);
    const fixed =
      !!object.constraint &&
      object.constraint.type !== "onSegment" &&
      object.constraint.type !== "onSphere" &&
      object.constraint.type !== "onPlane";
    if (selected.has(object.id))
      marks.push(
        object.constraint ? (
          <rect
            key={`sel-${object.id}`}
            className="ed-selected-point"
            x={f(p.x - 6)}
            y={f(p.y - 6)}
            width={12}
            height={12}
            transform={`rotate(45 ${f(p.x)} ${f(p.y)})`}
          />
        ) : (
          <circle key={`sel-${object.id}`} className="ed-selected-point" cx={f(p.x)} cy={f(p.y)} r={7} />
        ),
      );
    hits.push(
      <circle
        key={`hit-${object.id}`}
        className={fixed ? "ed-hit-point is-fixed" : "ed-hit-point"}
        data-pick={object.id}
        cx={f(p.x)}
        cy={f(p.y)}
        r={9}
      />,
    );
  }
  // Brackets around selected shapes.
  for (const id of selection) {
    const object = objects.find((o) => o.id === id);
    if (
      !object ||
      object.hidden ||
      object.kind === "point" ||
      object.kind === "segment" ||
      object.kind === "angle" ||
      object.kind === "measure" ||
      object.kind === "face"
    )
      continue;
    const bounds = scene.bounds.get(id);
    if (!bounds) continue;
    const corners = boundsCorners(bounds).map(project);
    const x0 = Math.min(...corners.map((c) => c.x)) - 8;
    const x1 = Math.max(...corners.map((c) => c.x)) + 8;
    const y0 = Math.min(...corners.map((c) => c.y)) - 8;
    const y1 = Math.max(...corners.map((c) => c.y)) + 8;
    const l = Math.min(14, (x1 - x0) / 3, (y1 - y0) / 3);
    marks.push(
      <path
        key={`brackets-${id}`}
        className={scene.consumed.has(id) ? "ed-brackets is-operand" : "ed-brackets"}
        d={`M ${f(x0)} ${f(y0 + l)} V ${f(y0)} H ${f(x0 + l)} M ${f(x1 - l)} ${f(y0)} H ${f(x1)} V ${f(y0 + l)} M ${f(x1)} ${f(y1 - l)} V ${f(y1)} H ${f(x1 - l)} M ${f(x0 + l)} ${f(y1)} H ${f(x0)} V ${f(y1 - l)}`}
      />,
    );
  }

  const gizmoParts: React.ReactNode[] = [];
  if (pivot) {
    const c = project(pivot);
    const k = worldPerPixel(camera, pivot, height);
    if (gizmo === "rotate" && canRotate) {
      AXES.forEach((axis, index) => {
        const [b1, b2] = basisFor(axis);
        const d = Array.from({ length: 65 }, (_, i) => {
          const t = (i / 64) * Math.PI * 2;
          const q = project(
            add3(
              pivot,
              add3(scale3(b1, RING * k * Math.cos(t)), scale3(b2, RING * k * Math.sin(t))),
            ),
          );
          return `${i ? "L" : "M"} ${f(q.x)} ${f(q.y)}`;
        }).join(" ");
        const name = AXIS_NAMES[index]!.toLowerCase();
        gizmoParts.push(
          <g key={`ring-${name}`} className={`ed-gizmo-part axis-${name}`} data-gizmo={`rotate-${name}`}>
            <path className="ed-gizmo-hit" d={d} />
            <path className="ed-gizmo-line" d={d} />
          </g>,
        );
      });
    } else if (gizmo === "scale") {
      gizmoParts.push(
        <g key="scale-u" className="ed-gizmo-part" data-gizmo="scale-u">
          <circle className="ed-gizmo-hit" cx={f(c.x)} cy={f(c.y)} r={SCALE_RING} />
          <circle className="ed-gizmo-line ed-gizmo-dashed" cx={f(c.x)} cy={f(c.y)} r={SCALE_RING} />
        </g>,
      );
      scaleAxes?.forEach((axis, index) => {
        if (!axis) return;
        const tip = project(add3(pivot, scale3(axis, SCALE_ARM * k)));
        const dx = tip.x - c.x;
        const dy = tip.y - c.y;
        if (Math.hypot(dx, dy) < 14) return;
        const name = AXIS_NAMES[index]!.toLowerCase();
        gizmoParts.push(
          <g key={`scale-${name}`} className={`ed-gizmo-part axis-${name}`} data-gizmo={`scale-${name}`}>
            <line className="ed-gizmo-hit" x1={f(c.x)} y1={f(c.y)} x2={f(tip.x)} y2={f(tip.y)} />
            <line className="ed-gizmo-line" x1={f(c.x)} y1={f(c.y)} x2={f(tip.x)} y2={f(tip.y)} />
            <rect className="ed-gizmo-box" x={f(tip.x - 5)} y={f(tip.y - 5)} width={10} height={10} />
          </g>,
        );
      });
    } else if (gizmo === "move") {
      // Floor handle: drag on the horizontal plane through the pivot.
      const fx = project(add3(pivot, [18 * k, 0, 0]));
      const fz = project(add3(pivot, [0, 0, 18 * k]));
      const fxz = project(add3(pivot, [18 * k, 0, 18 * k]));
      gizmoParts.push(
        <g key="move-f" className="ed-gizmo-part" data-gizmo="move-f">
          <path
            className="ed-gizmo-floor"
            d={`M ${f(c.x)} ${f(c.y)} L ${f(fx.x)} ${f(fx.y)} L ${f(fxz.x)} ${f(fxz.y)} L ${f(fz.x)} ${f(fz.y)} Z`}
          />
        </g>,
      );
      AXES.forEach((axis, index) => {
        const tip = project(add3(pivot, scale3(axis, ARROW * k)));
        const dx = tip.x - c.x;
        const dy = tip.y - c.y;
        const length = Math.hypot(dx, dy);
        if (length < 14) return; // pointing at the viewer
        const ux = dx / length;
        const uy = dy / length;
        const head = `M ${f(tip.x)} ${f(tip.y)} L ${f(tip.x - ux * 10 - uy * 4)} ${f(tip.y - uy * 10 + ux * 4)} L ${f(tip.x - ux * 10 + uy * 4)} ${f(tip.y - uy * 10 - ux * 4)} Z`;
        const name = AXIS_NAMES[index]!;
        gizmoParts.push(
          <g key={`axis-${name}`} className={`ed-gizmo-part axis-${name.toLowerCase()}`} data-gizmo={`move-${name.toLowerCase()}`}>
            <line className="ed-gizmo-hit" x1={f(c.x)} y1={f(c.y)} x2={f(tip.x)} y2={f(tip.y)} />
            <line className="ed-gizmo-line" x1={f(c.x + ux * 8)} y1={f(c.y + uy * 8)} x2={f(tip.x - ux * 8)} y2={f(tip.y - uy * 8)} />
            <path className="ed-gizmo-head" d={head} />
            <text className="ed-gizmo-label" x={f(tip.x + ux * 12)} y={f(tip.y + uy * 12)}>
              {name}
            </text>
          </g>,
        );
      });
    }
    if (gizmo === "move" || gizmo === "scale")
      gizmoParts.push(
        <g key="center" className="ed-gizmo-part" data-gizmo={gizmo === "move" ? "move-c" : "scale-u"}>
          <rect className="ed-gizmo-center" x={f(c.x - 6)} y={f(c.y - 6)} width={12} height={12} />
        </g>,
      );
  }

  // View axes in the corner.
  const origin = { x: 44, y: height - 44 };
  const triad = AXES.map((axis, index) => ({
    name: AXIS_NAMES[index]!,
    x: origin.x + Vec3.dot(vec(axis), right) * 24,
    y: origin.y - Vec3.dot(vec(axis), screenUp) * 24,
  }));

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
      <g className="ed-marks">{marks}</g>
      <g className="ed-hits">{hits}</g>
      <g className="ed-gizmo">{gizmoParts}</g>
    </svg>
  );
}
