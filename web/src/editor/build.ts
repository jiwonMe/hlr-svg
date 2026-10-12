import type { Camera } from "@hlr/camera/camera.js";
import { circleToCubics3, lineToCubic3 } from "@hlr/curves/builders.js";
import type { CubicBezier3 } from "@hlr/curves/cubicBezier3.js";
import type { StyledPiece } from "@hlr/hlr/splitByVisibility.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Csg, type CsgSolid } from "@hlr/scene/primitives/csg.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Disk } from "@hlr/scene/primitives/disk.js";
import { OrientedBox } from "@hlr/scene/primitives/orientedBox.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";
import {
  intersectionCurvesToOwnedCubics,
  type OwnedIntersectionCubic3,
} from "@hlr/scene/intersections/intersectionCurves.js";
import type { Scene as RaycastScene } from "@hlr/scene/scene.js";
import {
  projectPiecesToSvgPaths,
  projectedPathsToSvg,
  type SvgStyle,
} from "@hlr/svg/svgWriter.js";
import { isMathLabel, labelBoxEm, labelSvg } from "./labels";
import {
  add3,
  applyMat,
  dot3,
  eulerToMatrix,
  frameOf,
  isRightAngleRotation,
  length3,
  normalize3,
  scale3,
  sub3,
  vec,
  type Tuple3,
} from "./math";
import {
  consumedIds,
  type EditorObject,
  type RenderSettings,
} from "./model";
import { angleAt, resolvePoints } from "./resolve";

export type Bounds = { min: Tuple3; max: Tuple3 };

/** One library primitive and the editor object it came from. */
export type BuiltPrimitive = {
  objectId: string;
  primitive: Primitive;
  note?: string;
};

export type BuiltSegment = {
  id: string;
  from: Tuple3;
  to: Tuple3;
  arrow: boolean;
  line: "auto" | "dashed" | "solid";
};

/** Something a click can select, nearest layer first. */
export type Pickable = {
  objectId: string;
  primitive: Primitive;
  /** 0 drawn solids and opaque surfaces, 1 clear surfaces, 2 boolean operands. */
  layer: 0 | 1 | 2;
};

export type BuiltScene = {
  /** Occluders: solids, booleans and opaque planes, disks and faces. */
  primitives: Primitive[];
  built: BuiltPrimitive[];
  /** Clear planes and disks: drawn as outlines, never hide anything. */
  clear: BuiltPrimitive[];
  /** Extra lines for hidden-line removal: segments and clear outlines. */
  curves: CubicBezier3[];
  /** Lines lying on surfaces that must not hide them: clear sections, plane meets. */
  sections: OwnedIntersectionCubic3[];
  segments: BuiltSegment[];
  points: Map<string, Tuple3>;
  bounds: Map<string, Bounds>;
  sceneBounds: Bounds | null;
  /** Operands of booleans, drawn only as part of their result. */
  consumed: Set<string>;
  pickables: Pickable[];
};

const MIN_SIZE = 0.01;
const positive = (value: number) => Math.max(MIN_SIZE, value);

function ring(center: Tuple3, a: Tuple3, b: Tuple3, radius: number): Tuple3[] {
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return add3(
      center,
      add3(scale3(a, radius * Math.cos(t)), scale3(b, radius * Math.sin(t))),
    );
  });
}

export function boundsOf(points: readonly Tuple3[]): Bounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  return { min: min as unknown as Tuple3, max: max as unknown as Tuple3 };
}

export function boxCorners(
  position: Tuple3,
  rotation: Tuple3,
  size: Tuple3,
): Tuple3[] {
  const m = eulerToMatrix(rotation);
  return Array.from({ length: 8 }, (_, i) =>
    add3(
      position,
      applyMat(m, [
        ((i & 1 ? 1 : -1) * positive(size[0])) / 2,
        ((i & 2 ? 1 : -1) * positive(size[1])) / 2,
        ((i & 4 ? 1 : -1) * positive(size[2])) / 2,
      ]),
    ),
  );
}

/** Corners of a plane rectangle, in order around its border. */
export function planeCorners(
  object: Extract<EditorObject, { kind: "plane" }>,
  scale = 1,
): Tuple3[] {
  const { right, forward } = frameOf(object.rotation);
  const hw = (positive(object.width) / 2) * scale;
  const hd = (positive(object.depth) / 2) * scale;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    add3(
      object.position,
      add3(scale3(right, a! * hw), scale3(forward, b! * hd)),
    ),
  );
}

/** The library solid for a closed shape; turned boxes become oriented boxes. */
export function solidPrimitive(
  object: EditorObject,
  byId: ReadonlyMap<string, EditorObject>,
  depth = 0,
): CsgSolid | null {
  const { id } = object;
  switch (object.kind) {
    case "sphere":
      return new Sphere(id, vec(object.position), positive(object.radius));
    case "cylinder":
    case "cone": {
      const { up } = frameOf(object.rotation);
      const h = positive(object.height);
      const r = positive(object.radius);
      return object.kind === "cylinder"
        ? new Cylinder(
            id,
            vec(add3(object.position, scale3(up, -h / 2))),
            vec(up),
            h,
            r,
            "both",
          )
        : new Cone(
            id,
            vec(add3(object.position, scale3(up, h / 2))),
            vec(scale3(up, -1)),
            h,
            r,
            "base",
          );
    }
    case "box": {
      if (isRightAngleRotation(object.rotation)) {
        const b = boundsOf(
          boxCorners(object.position, object.rotation, object.size),
        );
        return new BoxAabb(id, vec(b.min), vec(b.max));
      }
      const { right, up } = frameOf(object.rotation);
      return new OrientedBox(
        id,
        vec(object.position),
        new Vec3(
          positive(object.size[0]) / 2,
          positive(object.size[1]) / 2,
          positive(object.size[2]) / 2,
        ),
        vec(right),
        vec(up),
      );
    }
    case "boolean": {
      if (depth > 32) return null;
      const a = byId.get(object.a);
      const b = byId.get(object.b);
      const pa = a && solidPrimitive(a, byId, depth + 1);
      const pb = b && solidPrimitive(b, byId, depth + 1);
      return pa && pb ? new Csg(id, object.op, pa, pb) : null;
    }
    default:
      return null;
  }
}

/** The library surface for a plane or disk. */
function surfacePrimitive(object: EditorObject): PlaneRect | Disk | null {
  if (object.kind === "plane") {
    const { right, up } = frameOf(object.rotation);
    return new PlaneRect(
      object.id,
      vec(object.position),
      vec(up),
      vec(right),
      positive(object.width) / 2,
      positive(object.depth) / 2,
    );
  }
  if (object.kind === "disk")
    return new Disk(
      object.id,
      vec(object.position),
      vec(frameOf(object.rotation).up),
      positive(object.radius),
    );
  return null;
}

function overlap(a: Bounds, b: Bounds): Bounds | null {
  const min = a.min.map((v, i) => Math.max(v, b.min[i]!)) as unknown as Tuple3;
  const max = a.max.map((v, i) => Math.min(v, b.max[i]!)) as unknown as Tuple3;
  return min.every((v, i) => v <= max[i]!) ? { min, max } : null;
}

function objectBounds(
  object: EditorObject,
  byId: ReadonlyMap<string, EditorObject>,
  points: ReadonlyMap<string, Tuple3>,
  depth = 0,
): Bounds | null {
  switch (object.kind) {
    case "sphere": {
      const r = positive(object.radius);
      return {
        min: add3(object.position, [-r, -r, -r]),
        max: add3(object.position, [r, r, r]),
      };
    }
    case "cylinder":
    case "cone": {
      const { right, up, forward } = frameOf(object.rotation);
      const h = positive(object.height);
      const r = positive(object.radius);
      const top = add3(object.position, scale3(up, h / 2));
      const bottom = add3(object.position, scale3(up, -h / 2));
      return boundsOf([
        ...ring(bottom, right, forward, r),
        ...(object.kind === "cylinder" ? ring(top, right, forward, r) : [top]),
      ]);
    }
    case "box":
      return boundsOf(boxCorners(object.position, object.rotation, object.size));
    case "plane":
      return boundsOf(planeCorners(object));
    case "disk": {
      const { right, forward } = frameOf(object.rotation);
      return boundsOf(
        ring(object.position, right, forward, positive(object.radius)),
      );
    }
    case "boolean": {
      if (depth > 32) return null;
      const operand = (id: string) => {
        const o = byId.get(id);
        return o ? objectBounds(o, byId, points, depth + 1) : null;
      };
      const a = operand(object.a);
      const b = operand(object.b);
      if (!a || !b) return a ?? b;
      if (object.op === "subtract") return a;
      if (object.op === "intersect") return overlap(a, b) ?? a;
      return boundsOf([a.min, a.max, b.min, b.max]);
    }
    case "point":
      return boundsOf([points.get(object.id) ?? object.position]);
    default: {
      const ids =
        object.kind === "face"
          ? object.points
          : object.kind === "angle"
            ? [object.vertex, object.from, object.to]
            : [object.from, object.to];
      const corners = ids
        .map((id) => points.get(id))
        .filter((p): p is Tuple3 => !!p);
      return corners.length ? boundsOf(corners) : null;
    }
  }
}

/** Where two plane rectangles meet: a segment clipped to both, if any. */
export function rectRectSegment(a: PlaneRect, b: PlaneRect): CubicBezier3 | null {
  const d = Vec3.cross(a.normal, b.normal);
  const d2 = Vec3.lenSq(d);
  if (d2 < 1e-10) return null;
  const ha = Vec3.dot(a.normal, a.center);
  const hb = Vec3.dot(b.normal, b.center);
  // The point of both planes nearest the origin.
  const p0 = Vec3.mulScalar(
    Vec3.add(
      Vec3.mulScalar(Vec3.cross(b.normal, d), ha),
      Vec3.mulScalar(Vec3.cross(d, a.normal), hb),
    ),
    1 / d2,
  );
  const dir = Vec3.mulScalar(d, 1 / Math.sqrt(d2));
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const r of [a, b])
    for (const [axis, half] of [
      [r.u, r.halfWidth],
      [r.v, r.halfHeight],
    ] as const) {
      const s0 = Vec3.dot(Vec3.sub(p0, r.center), axis);
      const ds = Vec3.dot(dir, axis);
      if (Math.abs(ds) < 1e-12) {
        if (Math.abs(s0) > half + 1e-9) return null;
        continue;
      }
      const lo = (-half - s0) / ds;
      const hi = (half - s0) / ds;
      t0 = Math.max(t0, Math.min(lo, hi));
      t1 = Math.min(t1, Math.max(lo, hi));
    }
  if (!(t1 - t0 > 1e-6)) return null;
  return lineToCubic3(
    Vec3.add(p0, Vec3.mulScalar(dir, t0)),
    Vec3.add(p0, Vec3.mulScalar(dir, t1)),
  );
}

const isSurface = (p: Primitive): p is PlaneRect | Disk =>
  p instanceof PlaneRect || p instanceof Disk;

/** Turns the editor document into primitives, curves and annotation data. */
export function buildScene(doc: {
  objects: readonly EditorObject[];
}): BuiltScene {
  const objects = doc.objects;
  const byId = new Map(objects.map((object) => [object.id, object]));
  const points = resolvePoints(objects);
  const consumed = consumedIds(objects);

  const built: BuiltPrimitive[] = [];
  const clear: BuiltPrimitive[] = [];
  const curves: CubicBezier3[] = [];
  const segments: BuiltSegment[] = [];
  const bounds = new Map<string, Bounds>();
  const pickables: Pickable[] = [];

  for (const object of objects) {
    const b = objectBounds(object, byId, points);
    if (b) bounds.set(object.id, b);
    if (object.hidden) continue;
    if (consumed.has(object.id)) {
      const operand = solidPrimitive(object, byId);
      if (operand)
        pickables.push({ objectId: object.id, primitive: operand, layer: 2 });
      continue;
    }
    switch (object.kind) {
      case "sphere":
      case "cylinder":
      case "cone":
      case "box":
      case "boolean": {
        const primitive = solidPrimitive(object, byId);
        if (primitive) built.push({ objectId: object.id, primitive });
        break;
      }
      case "plane":
      case "disk": {
        const surface = surfacePrimitive(object);
        if (!surface) break;
        if (object.opaque) {
          built.push({ objectId: object.id, primitive: surface });
          break;
        }
        clear.push({ objectId: object.id, primitive: surface });
        curves.push(
          ...(object.kind === "plane"
            ? planeCorners(object).map((p, i, all) =>
                lineToCubic3(vec(p), vec(all[(i + 1) % 4]!)),
              )
            : circleToCubics3({
                center: vec(object.position),
                normal: vec(frameOf(object.rotation).up),
                radius: positive(object.radius),
              })),
        );
        break;
      }
      case "segment": {
        const from = points.get(object.from);
        const to = points.get(object.to);
        if (!from || !to) break;
        segments.push({
          id: object.id,
          from,
          to,
          arrow: object.arrow,
          line: object.line,
        });
        if (object.line === "auto") curves.push(lineToCubic3(vec(from), vec(to)));
        break;
      }
      case "face": {
        const corners = object.points
          .map((id) => points.get(id))
          .filter((p): p is Tuple3 => !!p);
        if (corners.length < 3) break;
        const triangles = corners
          .slice(2)
          .map((_, i) => [0, i + 1, i + 2] as [number, number, number]);
        const mesh = new TriangleMesh(object.id, corners.map(vec), triangles);
        if (object.opaque)
          built.push({
            objectId: object.id,
            primitive: mesh,
            note: "불투명한 면은 뒤쪽 선을 가립니다. 메시라서 다른 도형과의 교선은 그리지 않습니다.",
          });
        else {
          clear.push({ objectId: object.id, primitive: mesh });
          curves.push(
            ...corners.map((p, i) =>
              lineToCubic3(vec(p), vec(corners[(i + 1) % corners.length]!)),
            ),
          );
        }
        break;
      }
      default:
        break;
    }
  }
  for (const item of built)
    pickables.push({ objectId: item.objectId, primitive: item.primitive, layer: 0 });
  for (const item of clear)
    pickables.push({ objectId: item.objectId, primitive: item.primitive, layer: 1 });

  // Lines the renderer does not find on its own: where clear surfaces cut
  // anything, and where two planes meet.
  const sections: BuiltScene["sections"] = [];
  const pair = (a: Primitive, b: Primitive) => {
    for (const x of intersectionCurvesToOwnedCubics([a, b], {
      angularSamples: 160,
    }))
      sections.push(x);
  };
  const clearIds = new Set(clear.map((item) => item.objectId));
  const surfaces = [...built, ...clear]
    .map((item) => item.primitive)
    .filter(isSurface);
  for (let i = 0; i < surfaces.length; i++)
    for (let j = i + 1; j < surfaces.length; j++) {
      const a = surfaces[i]!;
      const b = surfaces[j]!;
      if (a instanceof PlaneRect && b instanceof PlaneRect) {
        const line = rectRectSegment(a, b);
        if (line) sections.push({ bez: line, ignorePrimitiveIds: [a.id, b.id] });
      } else if (clearIds.has(a.id) || clearIds.has(b.id)) pair(a, b);
    }
  const solids = built
    .map((item) => item.primitive)
    .filter((p) => !isSurface(p) && !(p instanceof TriangleMesh));
  for (const item of clear)
    if (isSurface(item.primitive))
      for (const solid of solids) pair(item.primitive, solid);

  const framed = objects
    .filter((object) => !object.hidden && !consumed.has(object.id))
    .map((object) => bounds.get(object.id))
    .filter((b): b is Bounds => !!b);
  return {
    primitives: built.map((item) => item.primitive),
    built,
    clear,
    curves,
    sections,
    segments,
    points,
    bounds,
    sceneBounds: framed.length
      ? boundsOf(framed.flatMap((b) => [b.min, b.max]))
      : null,
    consumed,
    pickables,
  };
}

export function boundsCenter(b: Bounds): Tuple3 {
  return scale3(add3(b.min, b.max), 0.5);
}

export function boundsRadius(b: Bounds): number {
  return Math.max(
    0.5,
    Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) /
      2,
  );
}

export function boundsCorners(b: Bounds): Tuple3[] {
  return Array.from({ length: 8 }, (_, i) => [
    i & 1 ? b.max[0] : b.min[0],
    i & 2 ? b.max[1] : b.min[1],
    i & 4 ? b.max[2] : b.min[2],
  ]);
}

/* ── Line styles ───────────────────────────────────────────────────────── */

export function lineStyle(
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

function svgChildren(svg: string): string {
  return svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
}

/** Segments whose style is forced: always dashed or always solid. */
export function forcedLinesSvg(
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
  strokeWidth: number,
): string {
  const pieces: StyledPiece[] = scene.segments
    .filter((segment) => segment.line !== "auto")
    .map((segment) => ({
      bez: lineToCubic3(vec(segment.from), vec(segment.to)),
      visible: segment.line === "solid",
    }));
  if (!pieces.length) return "";
  return svgChildren(
    projectedPathsToSvg(projectPiecesToSvgPaths(pieces, camera, width, height), {
      width,
      height,
      background: false,
      style: lineStyle("dashed", strokeWidth),
    }),
  );
}

/* ── Annotations: dots, arrowheads, angle marks and labels ─────────────── */

type Point2 = { x: number; y: number };

export type LaidLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  italic: boolean;
  /** Hit box in px. */
  width: number;
  height: number;
};

const fmt = (n: number) => n.toFixed(2);

function unit(v: Point2, fallback: Point2 = { x: 0.7071, y: -0.7071 }): Point2 {
  const length = Math.hypot(v.x, v.y);
  return length < 1e-6 ? fallback : { x: v.x / length, y: v.y / length };
}

/** Exam lettering: points upright, variables and figure names italic, numbers upright. */
function italicFor(object: EditorObject, text: string): boolean {
  if (isMathLabel(text) || /^[0-9.]/.test(text) || text.endsWith("°"))
    return false;
  if (object.kind === "point") return /^[a-zα-ω]/.test(text);
  return /^[A-Za-zα-ωΑ-Ω]/.test(text);
}

export function annotationFontSize(width: number, height: number): number {
  return Math.round(Math.min(18, Math.max(13, Math.min(width, height) * 0.028)));
}

/** The angle at a vertex as it should be marked. */
export function angleData(
  object: Extract<EditorObject, { kind: "angle" }>,
  points: ReadonlyMap<string, Tuple3>,
) {
  const o = points.get(object.vertex);
  const a = points.get(object.from);
  const b = points.get(object.to);
  if (!o || !a || !b) return null;
  const u = normalize3(sub3(a, o));
  const toB = normalize3(sub3(b, o));
  if (length3(u) < 0.5 || length3(toB) < 0.5) return null;
  const w = normalize3(sub3(toB, scale3(u, dot3(toB, u))));
  const degrees = angleAt(o, a, b);
  if (length3(w) < 0.5 || degrees < 0.05) return null;
  const right =
    object.mark === "right" ||
    (object.mark === "auto" && Math.abs(degrees - 90) < 0.01);
  return { o, u, w, b: toB, degrees, right };
}

/** SVG path for an angle mark: an arc, or a small square at 90°. */
export function angleMarkPath(
  data: NonNullable<ReturnType<typeof angleData>>,
  radius: number,
  project: (p: Tuple3) => Point2,
): string {
  const r = Math.max(0.05, radius);
  if (data.right) {
    const s = r * 0.62;
    const p1 = project(add3(data.o, scale3(data.u, s)));
    const p2 = project(add3(data.o, add3(scale3(data.u, s), scale3(data.b, s))));
    const p3 = project(add3(data.o, scale3(data.b, s)));
    return `M ${fmt(p1.x)} ${fmt(p1.y)} L ${fmt(p2.x)} ${fmt(p2.y)} L ${fmt(p3.x)} ${fmt(p3.y)}`;
  }
  const theta = (data.degrees * Math.PI) / 180;
  const steps = Math.max(8, Math.ceil(data.degrees / 4));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * theta;
    const q = project(
      add3(
        data.o,
        add3(scale3(data.u, r * Math.cos(t)), scale3(data.w, r * Math.sin(t))),
      ),
    );
    return `${i ? "L" : "M"} ${fmt(q.x)} ${fmt(q.y)}`;
  }).join(" ");
}

function angleText(object: Extract<EditorObject, { kind: "angle" }>, degrees: number, right: boolean) {
  if (object.label) return object.label;
  if (right || !object.showValue) return "";
  return `${Math.round(degrees * 10) / 10}°`;
}

/** Where every label goes on screen; shared by drawing and dragging. */
export function layoutLabels(
  objects: readonly EditorObject[],
  settings: Pick<RenderSettings, "labels">,
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
): LaidLabel[] {
  if (!settings.labels) return [];
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const size = annotationFontSize(width, height);
  const center = scene.sceneBounds
    ? project(boundsCenter(scene.sceneBounds))
    : { x: width / 2, y: height / 2 };
  const right = Vec3.normalize(Vec3.cross(camera.forward, camera.up));

  // Labels at arrow tips sit past the tip, along the arrow.
  const arrowTail = new Map<string, Tuple3>();
  for (const object of objects)
    if (object.kind === "segment" && object.arrow && !object.hidden) {
      const from = scene.points.get(object.from);
      if (from) arrowTail.set(object.to, from);
    }

  /** Beside a segment, on the side away from the figure's centre. */
  const beside = (a: Tuple3, b: Tuple3, text: string): Point2 => {
    const pa = project(a);
    const pb = project(b);
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const d = unit({ x: pb.x - pa.x, y: pb.y - pa.y }, { x: 1, y: 0 });
    let normal = { x: -d.y, y: d.x };
    if (normal.x * (mid.x - center.x) + normal.y * (mid.y - center.y) < 0)
      normal = { x: -normal.x, y: -normal.y };
    const box = labelBoxEm(text);
    const gap =
      size *
      (0.45 +
        Math.abs(normal.y) * box.height * 0.5 +
        Math.abs(normal.x) * box.width * 0.5);
    return { x: mid.x + normal.x * gap, y: mid.y + normal.y * gap };
  };

  const out: LaidLabel[] = [];
  for (const object of objects) {
    if (object.hidden || scene.consumed.has(object.id)) continue;
    let text = object.label;
    let at: Point2;
    switch (object.kind) {
      case "point": {
        const p = project(scene.points.get(object.id) ?? object.position);
        const tail = arrowTail.get(object.id);
        const from = tail ? project(tail) : center;
        const away = unit({ x: p.x - from.x, y: p.y - from.y });
        at = { x: p.x + away.x * size * 0.95, y: p.y + away.y * size * 0.95 };
        break;
      }
      case "sphere": {
        const c = project(object.position);
        const edge = project(
          add3(object.position, [
            right.x * object.radius,
            right.y * object.radius,
            right.z * object.radius,
          ]),
        );
        const r = Math.hypot(edge.x - c.x, edge.y - c.y);
        at = { x: c.x + r * 0.74 + size * 0.45, y: c.y - r * 0.74 - size * 0.2 };
        break;
      }
      case "plane":
        at = planeCorners(object, 0.84)
          .map(project)
          .sort((a, b) => a.x - b.x || a.y - b.y)[0]!;
        break;
      case "angle": {
        const data = angleData(object, scene.points);
        if (!data) continue;
        text = angleText(object, data.degrees, data.right);
        const bisector = normalize3(add3(data.u, data.b));
        const r = Math.max(0.05, object.radius);
        const o = project(data.o);
        const arc = project(add3(data.o, scale3(bisector, r)));
        const away = unit({ x: arc.x - o.x, y: arc.y - o.y });
        const box = labelBoxEm(text);
        const gap = size * (0.35 + Math.max(box.width, box.height) * 0.5);
        at = { x: arc.x + away.x * gap, y: arc.y + away.y * gap };
        break;
      }
      case "measure":
      case "segment": {
        const a = scene.points.get(object.from);
        const b = scene.points.get(object.to);
        if (!a || !b || !text) continue;
        at = beside(a, b, text);
        break;
      }
      default: {
        const b = scene.bounds.get(object.id);
        if (!b) continue;
        const corners = boundsCorners(b).map(project);
        at = {
          x: Math.max(...corners.map((c) => c.x)) + size * 0.5,
          y: Math.min(...corners.map((c) => c.y)) + size * 0.3,
        };
      }
    }
    if (!text) continue;
    const offset = object.labelOffset ?? [0, 0];
    const box = labelBoxEm(text);
    out.push({
      id: object.id,
      text,
      x: at.x + offset[0],
      y: at.y + offset[1],
      italic: italicFor(object, text),
      width: box.width * size + 10,
      height: box.height * size + 6,
    });
  }
  return out;
}

export function annotationSvg(
  objects: readonly EditorObject[],
  settings: Pick<RenderSettings, "labels" | "pointDots">,
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
  occluders: RaycastScene,
): string {
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const size = annotationFontSize(width, height);
  const visible = (p: Tuple3) => occluders.visibleAtPoint(vec(p));
  const parts: string[] = [];

  const arrowTips = new Set<string>();
  for (const object of objects)
    if (object.kind === "segment" && object.arrow && !object.hidden)
      arrowTips.add(object.to);
  for (const segment of scene.segments) {
    if (!segment.arrow) continue;
    const tail = project(segment.from);
    const tip = project(segment.to);
    const d = unit({ x: tip.x - tail.x, y: tip.y - tail.y });
    const s = size * 0.62;
    const base = { x: tip.x - d.x * s, y: tip.y - d.y * s };
    const w = s * 0.36;
    parts.push(
      `<path d="M ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(base.x - d.y * w)} ${fmt(base.y + d.x * w)} L ${fmt(base.x + d.y * w)} ${fmt(base.y - d.x * w)} Z" fill="#0a0a0a" stroke="none"${visible(segment.to) ? "" : ' opacity="0.45"'}/>`,
    );
  }

  for (const object of objects) {
    if (object.kind !== "angle" || object.hidden) continue;
    const data = angleData(object, scene.points);
    if (!data) continue;
    parts.push(
      `<path d="${angleMarkPath(data, object.radius, project)}" fill="none" stroke="#0a0a0a" stroke-width="1" stroke-linejoin="round"/>`,
    );
  }

  if (settings.pointDots)
    for (const object of objects) {
      if (object.kind !== "point" || object.hidden || arrowTips.has(object.id))
        continue;
      const position = scene.points.get(object.id) ?? object.position;
      const p = project(position);
      parts.push(
        `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="2.3" fill="#0a0a0a" stroke="none"${visible(position) ? "" : ' opacity="0.45"'}/>`,
      );
    }

  const labels = layoutLabels(objects, settings, scene, camera, width, height);
  if (labels.length)
    parts.push(
      `<g class="fig-labels" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="#0a0a0a" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${labels
        .map((label) => labelSvg(label.text, label.x, label.y, size, label.italic))
        .join("")}</g>`,
    );
  return parts.length
    ? `<g data-editor-annotations="true">${parts.join("")}</g>`
    : "";
}
