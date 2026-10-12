import type { CsgOperation } from "@hlr/scene/primitives/csg.js";
import type { HiddenLineMode } from "../exam/lineStyle";
import type { Tuple3 } from "./math";
import type { Projection } from "./viewCamera";

export type SolidKind = "sphere" | "cylinder" | "cone" | "box";
export type SurfaceKind = "plane" | "disk";
export type ObjectKind =
  | SolidKind
  | SurfaceKind
  | "boolean"
  | "point"
  | "segment"
  | "face"
  | "angle"
  | "measure";

type Base = {
  id: string;
  name: string;
  /** Text drawn in the figure, e.g. "A", "α" or "√6/2". Empty hides it. */
  label: string;
  hidden: boolean;
  /** Screen-pixel nudge applied to the automatic label position. */
  labelOffset?: readonly [number, number];
};

export type SphereObject = Base & { kind: "sphere"; position: Tuple3; radius: number };
export type CylinderObject = Base & {
  kind: "cylinder";
  position: Tuple3;
  rotation: Tuple3;
  radius: number;
  height: number;
};
export type ConeObject = Base & {
  kind: "cone";
  position: Tuple3;
  rotation: Tuple3;
  radius: number;
  height: number;
};
export type BoxObject = Base & {
  kind: "box";
  position: Tuple3;
  rotation: Tuple3;
  size: Tuple3;
};
export type PlaneObject = Base & {
  kind: "plane";
  position: Tuple3;
  rotation: Tuple3;
  width: number;
  depth: number;
  /** Opaque planes hide what lies behind them; clear ones are guides. */
  opaque: boolean;
};
export type DiskObject = Base & {
  kind: "disk";
  position: Tuple3;
  rotation: Tuple3;
  radius: number;
  opaque: boolean;
};
/** a ∪ b, a − b or a ∩ b of two solids (or other booleans). */
export type BooleanObject = Base & {
  kind: "boolean";
  op: CsgOperation;
  a: string;
  b: string;
};

/** How a point follows other objects. Free points have none. */
export type PointConstraint =
  | { type: "midpoint"; a: string; b: string }
  /** Foot of the perpendicular onto a plane, face or segment line. */
  | { type: "foot"; point: string; onto: string }
  /** Where a segment's line crosses a plane or face. */
  | { type: "intersection"; line: string; surface: string }
  | { type: "onSegment"; segment: string; t: number }
  | { type: "onSphere"; sphere: string; azimuth: number; elevation: number }
  | { type: "onPlane"; plane: string; u: number; v: number }
  | { type: "center"; of: string };

export type PointObject = Base & {
  kind: "point";
  /** Stored for free points; a cached fallback for constrained ones. */
  position: Tuple3;
  constraint?: PointConstraint;
};
export type SegmentObject = Base & {
  kind: "segment";
  from: string;
  to: string;
  arrow: boolean;
  /** "auto" lets hidden-line removal decide; the others force a style. */
  line: "auto" | "dashed" | "solid";
};
/** A flat polygon through three or more points. */
export type FaceObject = Base & { kind: "face"; points: string[]; opaque: boolean };
/** Angle mark at `vertex` between rays toward `from` and `to`. */
export type AngleObject = Base & {
  kind: "angle";
  vertex: string;
  from: string;
  to: string;
  mark: "auto" | "arc" | "right";
  /** Show the measured angle when the label is empty. */
  showValue: boolean;
  radius: number;
};
/** A length between two points: a dashed arc from end to end and its value. */
export type MeasureObject = Base & {
  kind: "measure";
  from: string;
  to: string;
  /** Draw the dashed arc; without it the label sits beside the segment. */
  arc: boolean;
};

export type EditorObject =
  | SphereObject
  | CylinderObject
  | ConeObject
  | BoxObject
  | PlaneObject
  | DiskObject
  | BooleanObject
  | PointObject
  | SegmentObject
  | FaceObject
  | AngleObject
  | MeasureObject;

export type PositionedObject = Extract<EditorObject, { position: Tuple3 }>;
export type RotatedObject = Extract<EditorObject, { rotation: Tuple3 }>;

export type RenderSettings = {
  hiddenLines: HiddenLineMode;
  intersections: boolean;
  shading: boolean;
  lightAzimuth: number;
  lightElevation: number;
  ambient: number;
  strokeWidth: number;
  labels: boolean;
  pointDots: boolean;
  grid: boolean;
};

export type SavedView = {
  target: Tuple3;
  radius: number;
  azimuth: number;
  polar: number;
  projection: Projection;
};

export type EditorDoc = {
  version: 1;
  title: string;
  objects: EditorObject[];
  settings: RenderSettings;
};

export const DEFAULT_SETTINGS: RenderSettings = {
  hiddenLines: "dashed",
  intersections: true,
  shading: false,
  lightAzimuth: 135,
  lightElevation: 45,
  ambient: 0.3,
  strokeWidth: 1.4,
  labels: true,
  pointDots: true,
  grid: true,
};

export const KIND_NAMES: Record<ObjectKind, string> = {
  sphere: "구",
  cylinder: "원기둥",
  cone: "원뿔",
  box: "직육면체",
  plane: "평면",
  disk: "원판",
  boolean: "불리언",
  point: "점",
  segment: "선분",
  face: "면",
  angle: "각",
  measure: "길이",
};

export const OPERATION_NAMES: Record<CsgOperation, string> = {
  union: "합치기",
  subtract: "빼기",
  intersect: "교집합",
};

export const OPERATION_SYMBOLS: Record<CsgOperation, string> = {
  union: "∪",
  subtract: "−",
  intersect: "∩",
};

export function isPositioned(object: EditorObject): object is PositionedObject {
  return "position" in object;
}

export function isRotated(object: EditorObject): object is RotatedObject {
  return "rotation" in object;
}

/** Closed solids that can be booleaned. */
export function isSolid(object: EditorObject | undefined): boolean {
  return (
    !!object &&
    (object.kind === "sphere" ||
      object.kind === "cylinder" ||
      object.kind === "cone" ||
      object.kind === "box" ||
      object.kind === "boolean")
  );
}

/** Points the user can drag freely (constrained points follow their rules). */
export function isFreePoint(object: EditorObject | undefined): boolean {
  return object?.kind === "point" && !object.constraint;
}

/** Ids an object reads from; they must exist for it to make sense. */
export function references(object: EditorObject): string[] {
  switch (object.kind) {
    case "segment":
    case "measure":
      return [object.from, object.to];
    case "face":
      return [...object.points];
    case "boolean":
      return [object.a, object.b];
    case "angle":
      return [object.vertex, object.from, object.to];
    case "point": {
      const c = object.constraint;
      if (!c) return [];
      if (c.type === "midpoint") return [c.a, c.b];
      if (c.type === "foot") return [c.point, c.onto];
      if (c.type === "intersection") return [c.line, c.surface];
      if (c.type === "onSegment") return [c.segment];
      if (c.type === "onSphere") return [c.sphere];
      if (c.type === "onPlane") return [c.plane];
      return [c.of];
    }
    default:
      return [];
  }
}

/** Everything that depends on any of `ids`, transitively (deleted with them). */
export function dependents(objects: readonly EditorObject[], ids: Iterable<string>): Set<string> {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const object of objects)
      if (!out.has(object.id) && references(object).some((id) => out.has(id))) {
        out.add(object.id);
        grew = true;
      }
  }
  return out;
}

/** Operands of booleans: drawn only as part of their boolean. */
export function consumedIds(objects: readonly EditorObject[]): Set<string> {
  const out = new Set<string>();
  for (const object of objects)
    if (object.kind === "boolean") {
      out.add(object.a);
      out.add(object.b);
    }
  return out;
}

/** True when `id` is `root` or one of its boolean operands, at any depth. */
export function containsOperand(
  objects: readonly EditorObject[],
  root: string,
  id: string,
): boolean {
  if (root === id) return true;
  const object = objects.find((o) => o.id === root);
  return (
    object?.kind === "boolean" &&
    (containsOperand(objects, object.a, id) || containsOperand(objects, object.b, id))
  );
}

/** The same object reading from other ids, e.g. after copying. */
export function mapReferences(
  object: EditorObject,
  f: (id: string) => string,
): EditorObject {
  switch (object.kind) {
    case "segment":
    case "measure":
      return { ...object, from: f(object.from), to: f(object.to) };
    case "face":
      return { ...object, points: object.points.map(f) };
    case "boolean":
      return { ...object, a: f(object.a), b: f(object.b) };
    case "angle":
      return { ...object, vertex: f(object.vertex), from: f(object.from), to: f(object.to) };
    case "point": {
      const c = object.constraint;
      if (!c) return object;
      const constraint: PointConstraint =
        c.type === "midpoint"
          ? { ...c, a: f(c.a), b: f(c.b) }
          : c.type === "foot"
            ? { ...c, point: f(c.point), onto: f(c.onto) }
            : c.type === "intersection"
              ? { ...c, line: f(c.line), surface: f(c.surface) }
              : c.type === "onSegment"
                ? { ...c, segment: f(c.segment) }
                : c.type === "onSphere"
                  ? { ...c, sphere: f(c.sphere) }
                  : c.type === "onPlane"
                    ? { ...c, plane: f(c.plane) }
                    : { ...c, of: f(c.of) };
      return { ...object, constraint };
    }
    default:
      return object;
  }
}

/** A constrained point let go where it currently is. */
export function freePoint(point: PointObject, position: Tuple3): PointObject {
  const { id, name, label, hidden, labelOffset } = point;
  return {
    id,
    name,
    label,
    hidden,
    ...(labelOffset ? { labelOffset } : {}),
    kind: "point",
    position,
  };
}

const POINT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLANE_LETTERS = "αβγδεζηθ";

function nextLetter(used: Set<string>, letters: string): string {
  for (const letter of letters) if (!used.has(letter)) return letter;
  for (let n = 1; ; n++)
    for (const letter of letters)
      if (!used.has(`${letter}${n}`)) return `${letter}${n}`;
}

export function nextId(objects: readonly EditorObject[], kind: ObjectKind): string {
  const ids = new Set(objects.map((object) => object.id));
  for (let n = 1; ; n++) if (!ids.has(`${kind}-${n}`)) return `${kind}-${n}`;
}

export function nextName(objects: readonly EditorObject[], kind: ObjectKind): string {
  const names = new Set(objects.map((object) => object.name));
  for (let n = 1; ; n++) {
    const name = `${KIND_NAMES[kind]} ${n}`;
    if (!names.has(name)) return name;
  }
}

export function nextLabel(objects: readonly EditorObject[], kind: ObjectKind): string {
  const used = new Set(objects.map((object) => object.label));
  if (kind === "point") return nextLetter(used, POINT_LETTERS);
  if (kind === "plane") return nextLetter(used, PLANE_LETTERS);
  return "";
}

export function baseFor(objects: readonly EditorObject[], kind: ObjectKind) {
  return {
    id: nextId(objects, kind),
    name: nextName(objects, kind),
    label: nextLabel(objects, kind),
    hidden: false,
  };
}

/** A new shape with exam-figure proportions, resting at `at`. */
export function createObject(
  objects: readonly EditorObject[],
  kind: SolidKind | SurfaceKind | "point",
  at: Tuple3 = [0, 0, 0],
): EditorObject {
  const b = baseFor(objects, kind);
  const lifted: Tuple3 = [at[0], at[1] + 1, at[2]];
  switch (kind) {
    case "sphere":
      return { ...b, kind, position: lifted, radius: 1 };
    case "cylinder":
      return { ...b, kind, position: lifted, rotation: [0, 0, 0], radius: 0.8, height: 2 };
    case "cone":
      return { ...b, kind, position: lifted, rotation: [0, 0, 0], radius: 1, height: 2 };
    case "box":
      return { ...b, kind, position: lifted, rotation: [0, 0, 0], size: [2, 2, 2] };
    case "plane":
      return { ...b, kind, position: at, rotation: [0, 0, 0], width: 4, depth: 4, opaque: true };
    case "disk":
      return { ...b, kind, position: [at[0], at[1] + 0.01, at[2]], rotation: [0, 0, 0], radius: 1.2, opaque: true };
    case "point":
      return { ...b, kind, position: lifted };
  }
}

export function createSegment(objects: readonly EditorObject[], from: string, to: string): SegmentObject {
  return { ...baseFor(objects, "segment"), label: "", kind: "segment", from, to, arrow: false, line: "auto" };
}

export function createFace(objects: readonly EditorObject[], points: string[]): FaceObject {
  return { ...baseFor(objects, "face"), label: "", kind: "face", points, opaque: true };
}

export function createBoolean(
  objects: readonly EditorObject[],
  op: CsgOperation,
  a: string,
  b: string,
): BooleanObject {
  const first = objects.find((o) => o.id === a);
  const second = objects.find((o) => o.id === b);
  return {
    ...baseFor(objects, "boolean"),
    name: `${first?.name ?? a} ${OPERATION_SYMBOLS[op]} ${second?.name ?? b}`,
    label: "",
    kind: "boolean",
    op,
    a,
    b,
  };
}

export function createPoint(
  objects: readonly EditorObject[],
  constraint: PointConstraint,
  position: Tuple3 = [0, 0, 0],
): PointObject {
  return { ...baseFor(objects, "point"), kind: "point", position, constraint };
}

export function createAngle(
  objects: readonly EditorObject[],
  from: string,
  vertex: string,
  to: string,
): AngleObject {
  return {
    ...baseFor(objects, "angle"),
    label: "",
    kind: "angle",
    vertex,
    from,
    to,
    mark: "auto",
    showValue: true,
    radius: 0.4,
  };
}

export function createMeasure(
  objects: readonly EditorObject[],
  from: string,
  to: string,
  label: string,
): MeasureObject {
  return { ...baseFor(objects, "measure"), label, kind: "measure", from, to, arc: true };
}

const isTuple = (t: unknown): t is Tuple3 =>
  Array.isArray(t) && t.length === 3 && t.every((n) => typeof n === "number" && Number.isFinite(n));

/** Fills fields added after a document was saved (or left out by a template). */
export function withDefaults(object: EditorObject): EditorObject {
  switch (object.kind) {
    case "segment":
      return { ...object, arrow: object.arrow ?? false, line: object.line ?? "auto" };
    case "plane":
    case "disk":
    case "face":
      return { ...object, opaque: object.opaque ?? true };
    case "angle":
      return {
        ...object,
        mark: object.mark ?? "auto",
        showValue: object.showValue ?? true,
        radius: object.radius ?? 0.4,
      };
    case "measure":
      return { ...object, arc: object.arc ?? true };
    default:
      return object;
  }
}

/** Rejects anything that is not a well-formed editor document. */
export function parseDoc(value: unknown): EditorDoc | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<EditorDoc>;
  if (doc.version !== 1 || !Array.isArray(doc.objects)) return null;
  const ids = new Set<string>();
  for (const object of doc.objects as EditorObject[]) {
    if (!object || typeof object.id !== "string" || ids.has(object.id)) return null;
    if (!(object.kind in KIND_NAMES)) return null;
    if (isPositioned(object) && !isTuple(object.position)) return null;
    if (isRotated(object) && !isTuple(object.rotation)) return null;
    if (object.kind === "box" && !isTuple(object.size)) return null;
    ids.add(object.id);
  }
  const objects = (doc.objects as EditorObject[]).map(withDefaults);
  for (const object of objects) {
    if (!references(object).every((id) => ids.has(id))) return null;
    if (object.kind === "face" && object.points.length < 3) return null;
    if (object.kind === "boolean") {
      const a = objects.find((o) => o.id === object.a);
      const b = objects.find((o) => o.id === object.b);
      if (!isSolid(a) || !isSolid(b) || object.a === object.b) return null;
      if (containsOperand(objects, object.a, object.id) || containsOperand(objects, object.b, object.id))
        return null;
    }
  }
  return {
    version: 1,
    title: typeof doc.title === "string" ? doc.title : "제목 없는 장면",
    objects,
    settings: { ...DEFAULT_SETTINGS, ...(doc.settings ?? {}) },
  };
}

export function parseView(value: unknown): SavedView | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SavedView>;
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  if (!isTuple(v.target) || !finite(v.radius) || !finite(v.azimuth) || !finite(v.polar)) return null;
  return {
    target: v.target,
    radius: v.radius,
    azimuth: v.azimuth,
    polar: v.polar,
    projection: v.projection === "perspective" ? "perspective" : "orthographic",
  };
}
