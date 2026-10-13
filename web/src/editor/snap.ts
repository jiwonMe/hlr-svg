import type { Camera } from "@hlr/camera/camera.js";
import { Csg } from "@hlr/scene/primitives/csg.js";
import type { Ray } from "@hlr/scene/ray.js";
import { anchorsOf } from "./anchors";
import type { BuiltScene } from "./build";
import {
  add3,
  dot3,
  formatNumber,
  frameOf,
  length3,
  lerp3,
  scale3,
  snapValue,
  sub3,
  tuple,
  vec,
  type Tuple3,
} from "./math";
import {
  canMerge,
  dependents,
  type EditorObject,
  type PointConstraint,
} from "./model";
import { sphereAngles, sphereDirection } from "./resolve";
import { worldPerPixel } from "./viewCamera";

export type Point2 = { x: number; y: number };

export type SnapKind =
  /** An existing point: picked when placing, merged into when dragging. */
  | "point"
  /** A corner, apex or base centre of a shape. */
  | "anchor"
  /** The centre of a sphere, disk or plane. */
  | "center"
  | "midpoint"
  /** Somewhere along a segment. */
  | "segment"
  /** On a sphere, plane or disk, following it. */
  | "surface"
  /** On another surface, as a free point that does not follow it. */
  | "solid"
  /** On the floor grid. */
  | "floor"
  /** Nothing nearby: where the cursor put it. */
  | "free";

/** Where a point lands and the rule it would follow there. */
export type Snap = {
  kind: SnapKind;
  position: Tuple3;
  /** Free points have none. */
  constraint?: PointConstraint;
  /** The existing point to use (or merge into) instead of a new one. */
  pointId?: string;
  /** The shape or segment to highlight. */
  hostId?: string;
  /** Short text shown by the cursor. */
  label: string;
};

export type SnapView = {
  objects: readonly EditorObject[];
  scene: BuiltScene;
  camera: Camera;
  width: number;
  height: number;
  /** Grid step; 0 rounds nothing. */
  grid: number;
  /** False while ⌥ is held: nothing attracts and nothing is rounded. */
  snapping: boolean;
};

/** What a dragged point may land on: not itself or what is built on it. */
export type DragTargets = {
  pointId: string;
  exclude: ReadonlySet<string>;
  mergeable: ReadonlySet<string>;
};

/** Screen distances in pixels. */
const POINT_PX = 10;
const LINE_PX = 7;
const RATIO_PX = 8;
const TOUCH_PX = 8;
/** Points win over shape corners they sit on. */
const POINT_BIAS = 4;

/** Ratios a point on a segment catches on, with how exams write them. */
const NICE_RATIOS: readonly { t: number; text: string }[] = [
  { t: 1 / 2, text: "1 : 1" },
  { t: 1 / 3, text: "1 : 2" },
  { t: 2 / 3, text: "2 : 1" },
  { t: 1 / 4, text: "1 : 3" },
  { t: 3 / 4, text: "3 : 1" },
];

const NONE: ReadonlySet<string> = new Set();

const coords = (p: Tuple3) =>
  `(${p.map((v) => formatNumber(v, 2)).join(", ")})`;

/** How the snap tag names an object. */
export function titleOf(
  object: EditorObject,
  byId: ReadonlyMap<string, EditorObject>,
): string {
  if (object.kind === "point")
    return object.label ? `점 ${object.label}` : object.name;
  if (object.kind === "segment") {
    const a = byId.get(object.from)?.label;
    const b = byId.get(object.to)?.label;
    return a && b ? `선분 ${a}${b}` : object.name;
  }
  return object.name;
}

/** Objects drawn in the figure: not hidden, and operands only of shown booleans. */
function shownIds(objects: readonly EditorObject[]): Set<string> {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const owner = new Map<string, string>();
  for (const object of objects)
    if (object.kind === "boolean") {
      owner.set(object.a, object.id);
      owner.set(object.b, object.id);
    }
  const shown = (id: string, depth: number): boolean => {
    const object = byId.get(id);
    if (!object || object.hidden || depth > 32) return false;
    const up = owner.get(id);
    return up ? shown(up, depth + 1) : true;
  };
  return new Set(objects.filter((o) => shown(o.id, 0)).map((o) => o.id));
}

/** The boolean an operand ends up in, or the object itself. */
function rootOf(objects: readonly EditorObject[], id: string): string {
  let root = id;
  for (let i = 0; i < 32; i++) {
    const up = objects.find(
      (o) => o.kind === "boolean" && (o.a === root || o.b === root),
    );
    if (!up) break;
    root = up.id;
  }
  return root;
}

type Feature = { snap: Snap; bias: number };

/** Points, corners, centres and midpoints a cursor can land on. */
function features(view: SnapView, targets: DragTargets | null): Feature[] {
  const { objects, scene } = view;
  const byId = new Map(objects.map((object) => [object.id, object]));
  const shown = shownIds(objects);
  const exclude = targets?.exclude ?? NONE;
  const out: Feature[] = [];
  for (const object of objects) {
    if (!shown.has(object.id) || exclude.has(object.id)) continue;
    const title = titleOf(object, byId);
    if (object.kind === "point") {
      if (targets && !targets.mergeable.has(object.id)) continue;
      const position = scene.points.get(object.id);
      if (position)
        out.push({
          snap: {
            kind: "point",
            position,
            pointId: object.id,
            label: targets ? `${title}에 합치기` : title,
          },
          bias: POINT_BIAS,
        });
      continue;
    }
    if (object.kind === "segment") {
      const a = scene.points.get(object.from);
      const b = scene.points.get(object.to);
      if (a && b)
        out.push({
          snap: {
            kind: "midpoint",
            position: lerp3(a, b, 0.5),
            constraint: { type: "midpoint", a: object.from, b: object.to },
            hostId: object.id,
            label: `중점 · ${title}`,
          },
          bias: 0,
        });
      continue;
    }
    // Corners of an operand count only where they are left on the result.
    let result: Csg | null = null;
    if (scene.consumed.has(object.id)) {
      const root = rootOf(objects, object.id);
      const built = scene.built.find((item) => item.objectId === root);
      result = built?.primitive instanceof Csg ? built.primitive : null;
      if (!result) continue;
    }
    for (const anchor of anchorsOf(object)) {
      if (
        result &&
        result.classify(
          vec(anchor.position),
          1e-4 * Math.max(1, result.size()),
        ) !== 0
      )
        continue;
      out.push({
        snap: {
          kind: "anchor",
          position: anchor.position,
          constraint: { type: "anchor", of: object.id, key: anchor.key },
          hostId: object.id,
          label: `${anchor.name} · ${title}`,
        },
        bias: 0,
      });
    }
    if (
      object.kind === "sphere" ||
      object.kind === "disk" ||
      object.kind === "plane"
    )
      out.push({
        snap: {
          kind: "center",
          position: object.position,
          constraint: { type: "center", of: object.id },
          hostId: object.id,
          label: `중심 · ${title}`,
        },
        bias: 0,
      });
  }
  return out;
}

/** The feature nearest the cursor on screen; the one in front wins a tie. */
function nearestFeature(
  view: SnapView,
  at: Point2,
  list: readonly Feature[],
): Snap | null {
  let best: Feature | null = null;
  let bestScore = Infinity;
  let bestDepth = Infinity;
  for (const feature of list) {
    const q = view.camera.projectToSvg(
      vec(feature.snap.position),
      view.width,
      view.height,
    );
    if (!(q.z >= -1 && q.z <= 1)) continue;
    const d = Math.hypot(q.x - at.x, q.y - at.y);
    if (d > POINT_PX) continue;
    const score = d - feature.bias;
    if (
      score < bestScore - 0.5 ||
      (score < bestScore + 0.5 && q.z < bestDepth)
    ) {
      best = feature;
      bestScore = score;
      bestDepth = q.z;
    }
  }
  return best?.snap ?? null;
}

/** Parameter on the line through a and b closest to the ray. */
function closestOnLine(a: Tuple3, b: Tuple3, ray: Ray): number | null {
  const u = sub3(b, a);
  const v = tuple(ray.dir);
  const w0 = sub3(a, tuple(ray.origin));
  const A = dot3(u, u);
  const B = dot3(u, v);
  const C = dot3(v, v);
  const den = A * C - B * B;
  if (A < 1e-18 || Math.abs(den) < 1e-12 * A * C) return null;
  return (B * dot3(v, w0) - C * dot3(u, w0)) / den;
}

/**
 * A ratio along a segment from a to b, caught by the nice ratios near it and
 * otherwise rounded to twentieths while the grid is on.
 */
export function segmentRatio(
  view: SnapView,
  a: Tuple3,
  b: Tuple3,
  t: number,
): { t: number; text: string | null } {
  const clamped = Math.min(1, Math.max(0, t));
  if (!view.snapping) return { t: clamped, text: null };
  const project = (s: number) =>
    view.camera.projectToSvg(vec(lerp3(a, b, s)), view.width, view.height);
  const here = project(clamped);
  for (const ratio of NICE_RATIOS) {
    const there = project(ratio.t);
    if (Math.hypot(there.x - here.x, there.y - here.y) <= RATIO_PX)
      return { t: ratio.t, text: ratio.text };
  }
  return {
    t: view.grid > 0 ? Math.round(clamped * 20) / 20 : clamped,
    text: null,
  };
}

/** The label a sliding point shows while it is dragged. */
export function slideLabel(
  objects: readonly EditorObject[],
  c: PointConstraint,
  ratio: string | null = null,
): string {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const host = (id: string) => {
    const object = byId.get(id);
    return object ? titleOf(object, byId) : id;
  };
  if (c.type === "onSegment")
    return `${host(c.segment)} 위${ratio ? ` · ${ratio}` : ""}`;
  if (c.type === "onSphere")
    return `${host(c.sphere)} 위 · 방위 ${formatNumber(c.azimuth, 1)}° 고도 ${formatNumber(c.elevation, 1)}°`;
  if (c.type === "onPlane") return `${host(c.plane)} 위`;
  return "";
}

/** A point along the segment under the cursor. */
function segmentSnap(
  view: SnapView,
  ray: Ray,
  at: Point2,
  exclude: ReadonlySet<string>,
): Snap | null {
  const { objects, scene, camera, width, height } = view;
  const byId = new Map(objects.map((object) => [object.id, object]));
  let best: { id: string; a: Tuple3; b: Tuple3; s: number; d: number } | null =
    null;
  for (const segment of scene.segments) {
    if (exclude.has(segment.id)) continue;
    const p = camera.projectToSvg(vec(segment.from), width, height);
    const q = camera.projectToSvg(vec(segment.to), width, height);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    const s = Math.min(
      1,
      Math.max(0, ((at.x - p.x) * dx + (at.y - p.y) * dy) / len2),
    );
    const d = Math.hypot(p.x + dx * s - at.x, p.y + dy * s - at.y);
    if (d <= LINE_PX && (!best || d < best.d))
      best = { id: segment.id, a: segment.from, b: segment.to, s, d };
  }
  const segment = best && byId.get(best.id);
  if (!best || segment?.kind !== "segment") return null;
  const { t, text } = segmentRatio(
    view,
    best.a,
    best.b,
    closestOnLine(best.a, best.b, ray) ?? best.s,
  );
  const constraint: PointConstraint = {
    type: "onSegment",
    segment: best.id,
    t,
  };
  return {
    kind: "segment",
    position: lerp3(best.a, best.b, t),
    constraint,
    hostId: best.id,
    label: slideLabel(objects, constraint, text),
  };
}

/** The rule for a point at `p` on a sphere, plane or disk, rounded like drags round it. */
function onSurface(
  view: SnapView,
  host: EditorObject,
  p: Tuple3,
  label: string,
): Snap | null {
  const round = view.snapping && view.grid > 0;
  if (host.kind === "sphere") {
    const offset = sub3(p, host.position);
    if (length3(offset) < 1e-9) return null;
    let { azimuth, elevation } = sphereAngles(offset);
    if (round) {
      azimuth = Math.round(azimuth / 5) * 5;
      elevation = Math.round(elevation / 5) * 5;
    }
    return {
      kind: "surface",
      position: add3(
        host.position,
        scale3(sphereDirection(azimuth, elevation), host.radius),
      ),
      constraint: { type: "onSphere", sphere: host.id, azimuth, elevation },
      hostId: host.id,
      label,
    };
  }
  if (host.kind === "plane" || host.kind === "disk") {
    const { right, forward } = frameOf(host.rotation);
    const offset = sub3(p, host.position);
    let u = dot3(offset, right);
    let v = dot3(offset, forward);
    if (round) {
      u = snapValue(u, view.grid / 2);
      v = snapValue(v, view.grid / 2);
    }
    return {
      kind: "surface",
      position: add3(host.position, add3(scale3(right, u), scale3(forward, v))),
      constraint: { type: "onPlane", plane: host.id, u, v },
      hostId: host.id,
      label,
    };
  }
  return null;
}

/** The surface under the cursor, nearest first. */
function surfaceSnap(view: SnapView, ray: Ray): Snap | null {
  const { objects, scene, camera } = view;
  const byId = new Map(objects.map((object) => [object.id, object]));
  const depth = dot3(tuple(ray.dir), tuple(camera.forward));
  const tMin = camera.kind === "perspective" ? camera.near / depth : 0;
  const tMax =
    camera.kind === "perspective"
      ? camera.far / depth
      : camera.far - camera.near;
  let best: { id: string; t: number; point: Tuple3 } | null = null;
  for (const item of scene.pickables) {
    if (item.layer === 2) continue;
    const hit = item.primitive.intersect(ray, tMin, tMax);
    if (hit && (!best || hit.t < best.t))
      best = { id: item.objectId, t: hit.t, point: tuple(hit.point) };
  }
  const object = best && byId.get(best.id);
  if (!best || !object) return null;
  const p = best.point;
  if (!view.snapping)
    return { kind: "free", position: p, label: `자유 점 ${coords(p)}` };
  const title = titleOf(object, byId);
  const direct = onSurface(view, object, p, `${title} 위`);
  if (direct) return direct;
  if (object.kind === "boolean") {
    // On a ball that is part of the result: follow that ball.
    const stack = [object.a, object.b];
    for (let i = 0; i < 64 && stack.length; i++) {
      const operand = byId.get(stack.pop()!);
      if (operand?.kind === "boolean") stack.push(operand.a, operand.b);
      else if (
        operand?.kind === "sphere" &&
        Math.abs(length3(sub3(p, operand.position)) - operand.radius) <
          1e-3 * Math.max(1, operand.radius)
      )
        return onSurface(view, operand, p, `${titleOf(operand, byId)} 위`);
    }
  }
  return {
    kind: "solid",
    position: p,
    hostId: object.id,
    label: `${title} ${object.kind === "face" ? "위" : "겉면"} · 자유 점`,
  };
}

/** Where the cursor ray meets the floor (y = 0), on the grid. */
function floorSnap(view: SnapView, ray: Ray): Snap | null {
  if (Math.abs(ray.dir.y) < 1e-6) return null;
  const t = -ray.origin.y / ray.dir.y;
  if (t < 0 && view.camera.kind === "perspective") return null;
  const hit = add3(tuple(ray.origin), scale3(tuple(ray.dir), t));
  const round = view.snapping && view.grid > 0;
  const position: Tuple3 = [
    round ? snapValue(hit[0], view.grid) : hit[0],
    0,
    round ? snapValue(hit[2], view.grid) : hit[2],
  ];
  return { kind: "floor", position, label: `바닥 ${coords(position)}` };
}

/** Looking along the floor: the plane through the view target facing us. */
function facingSnap(view: SnapView, ray: Ray): Snap {
  const n = tuple(view.camera.forward);
  const denom = dot3(tuple(ray.dir), n);
  const t =
    Math.abs(denom) < 1e-9
      ? 0
      : dot3(sub3(tuple(view.camera.target), tuple(ray.origin)), n) / denom;
  const position = add3(tuple(ray.origin), scale3(tuple(ray.dir), t));
  return { kind: "free", position, label: coords(position) };
}

/** Where a click at `at` puts a new point, and the rule it follows there. */
export function placementSnap(view: SnapView, at: Point2): Snap {
  const ray = view.camera.screenToRay(at.x, at.y, view.width, view.height);
  if (view.snapping) {
    const feature = nearestFeature(view, at, features(view, null));
    if (feature) return feature;
    const along = segmentSnap(view, ray, at, NONE);
    if (along) return along;
  }
  return (
    surfaceSnap(view, ray) ?? floorSnap(view, ray) ?? facingSnap(view, ray)
  );
}

export function dragTargets(
  objects: readonly EditorObject[],
  pointId: string,
): DragTargets {
  const exclude = dependents(objects, [pointId]);
  const mergeable = new Set(
    objects
      .filter((o) => o.kind === "point" && canMerge(objects, pointId, o.id))
      .map((o) => o.id),
  );
  return { pointId, exclude, mergeable };
}

/** A sphere, plane or disk the dragged point touches in space. */
function touchSnap(
  view: SnapView,
  p: Tuple3,
  exclude: ReadonlySet<string>,
): Snap | null {
  const { objects, scene, camera, height } = view;
  const byId = new Map(objects.map((object) => [object.id, object]));
  const shown = shownIds(objects);
  const reach = TOUCH_PX * worldPerPixel(camera, p, height);
  let best: { host: EditorObject; q: Tuple3; d: number } | null = null;
  for (const host of objects) {
    if (
      !shown.has(host.id) ||
      exclude.has(host.id) ||
      scene.consumed.has(host.id)
    )
      continue;
    let q: Tuple3 | null = null;
    if (host.kind === "sphere") {
      const offset = sub3(p, host.position);
      const r = length3(offset);
      if (r > 1e-9) q = add3(host.position, scale3(offset, host.radius / r));
    } else if (host.kind === "plane" || host.kind === "disk") {
      const { right, up, forward } = frameOf(host.rotation);
      const offset = sub3(p, host.position);
      const u = dot3(offset, right);
      const v = dot3(offset, forward);
      const inside =
        host.kind === "plane"
          ? Math.abs(u) <= host.width / 2 + reach &&
            Math.abs(v) <= host.depth / 2 + reach
          : Math.hypot(u, v) <= host.radius + reach;
      if (inside) q = sub3(p, scale3(up, dot3(offset, up)));
    }
    if (!q) continue;
    const d = length3(sub3(p, q));
    if (d <= reach && (!best || d < best.d)) best = { host, q, d };
  }
  return (
    best && onSurface(view, best.host, best.q, `${titleOf(best.host, byId)} 위`)
  );
}

/**
 * Where a free point dragged to `candidate` (on its drag plane) lands: on a
 * point to merge into, a corner, a segment or a surface it touches, else on
 * the grid along the axes in `round`.
 */
export function dragSnap(
  view: SnapView,
  targets: DragTargets,
  candidate: Tuple3,
  round: readonly [boolean, boolean, boolean],
): Snap {
  if (view.snapping) {
    const at = view.camera.projectToSvg(
      vec(candidate),
      view.width,
      view.height,
    );
    const feature = nearestFeature(view, at, features(view, targets));
    if (feature) return feature;
    const ray = view.camera.screenToRay(at.x, at.y, view.width, view.height);
    const along = segmentSnap(view, ray, at, targets.exclude);
    if (along) return along;
    const touch = touchSnap(view, candidate, targets.exclude);
    if (touch) return touch;
  }
  const grid = view.snapping ? view.grid : 0;
  const position = candidate.map((v, i) =>
    grid > 0 && round[i] ? snapValue(v, grid) : v,
  ) as unknown as Tuple3;
  return { kind: "free", position, label: coords(position) };
}
