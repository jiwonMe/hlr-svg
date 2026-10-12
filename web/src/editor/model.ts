import type { HiddenLineMode } from "../exam/lineStyle";
import type { Tuple3 } from "./math";

export type SolidKind =
  | "sphere"
  | "cylinder"
  | "cone"
  | "box"
  | "plane"
  | "disk";
export type ObjectKind = SolidKind | "point" | "segment" | "face";

type Base = {
  id: string;
  name: string;
  /** Text drawn in the figure, e.g. "A" or "α". Empty hides it. */
  label: string;
  hidden: boolean;
};

export type SphereObject = Base & {
  kind: "sphere";
  position: Tuple3;
  radius: number;
};
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
};
export type DiskObject = Base & {
  kind: "disk";
  position: Tuple3;
  rotation: Tuple3;
  radius: number;
};
export type PointObject = Base & { kind: "point"; position: Tuple3 };
/** Joins two point objects; follows them when they move. */
export type SegmentObject = Base & {
  kind: "segment";
  from: string;
  to: string;
  arrow: boolean;
};
/** A flat polygon through three or more point objects. */
export type FaceObject = Base & { kind: "face"; points: string[] };

export type EditorObject =
  | SphereObject
  | CylinderObject
  | ConeObject
  | BoxObject
  | PlaneObject
  | DiskObject
  | PointObject
  | SegmentObject
  | FaceObject;

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
  point: "점",
  segment: "선분",
  face: "면",
};

export function isPositioned(object: EditorObject): object is PositionedObject {
  return "position" in object;
}

export function isRotated(object: EditorObject): object is RotatedObject {
  return "rotation" in object;
}

export function isSolid(object: EditorObject): boolean {
  return (
    object.kind !== "point" &&
    object.kind !== "segment" &&
    object.kind !== "face"
  );
}

/** Points, segments and faces that refer to `id`, removed along with it. */
export function dependents(
  objects: readonly EditorObject[],
  id: string,
): string[] {
  return objects
    .filter(
      (object) =>
        (object.kind === "segment" &&
          (object.from === id || object.to === id)) ||
        (object.kind === "face" && object.points.includes(id)),
    )
    .map((object) => object.id);
}

const POINT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLANE_LETTERS = "αβγδεζηθ";

function nextLetter(used: Set<string>, letters: string): string {
  for (const letter of letters) if (!used.has(letter)) return letter;
  for (let n = 1; ; n++)
    for (const letter of letters)
      if (!used.has(`${letter}${n}`)) return `${letter}${n}`;
}

export function nextId(
  objects: readonly EditorObject[],
  kind: ObjectKind,
): string {
  const ids = new Set(objects.map((object) => object.id));
  for (let n = 1; ; n++) if (!ids.has(`${kind}-${n}`)) return `${kind}-${n}`;
}

function nextName(objects: readonly EditorObject[], kind: ObjectKind): string {
  const names = new Set(objects.map((object) => object.name));
  for (let n = 1; ; n++) {
    const name = `${KIND_NAMES[kind]} ${n}`;
    if (!names.has(name)) return name;
  }
}

export function nextLabel(
  objects: readonly EditorObject[],
  kind: ObjectKind,
): string {
  const used = new Set(objects.map((object) => object.label));
  if (kind === "point") return nextLetter(used, POINT_LETTERS);
  if (kind === "plane") return nextLetter(used, PLANE_LETTERS);
  return "";
}

function base(objects: readonly EditorObject[], kind: ObjectKind) {
  return {
    id: nextId(objects, kind),
    name: nextName(objects, kind),
    label: nextLabel(objects, kind),
    hidden: false,
  };
}

/**
 * A new object with sensible exam-figure proportions. Segments and faces use
 * the most recent points, so "점, 점, 선분" builds a segment between them.
 */
export function createObject(
  objects: readonly EditorObject[],
  kind: Exclude<ObjectKind, "segment" | "face">,
  at: Tuple3 = [0, 0, 0],
): EditorObject {
  const b = base(objects, kind);
  switch (kind) {
    case "sphere":
      return { ...b, kind, position: [at[0], at[1] + 1, at[2]], radius: 1 };
    case "cylinder":
      return {
        ...b,
        kind,
        position: [at[0], at[1] + 1, at[2]],
        rotation: [0, 0, 0],
        radius: 0.8,
        height: 2,
      };
    case "cone":
      return {
        ...b,
        kind,
        position: [at[0], at[1] + 1, at[2]],
        rotation: [0, 0, 0],
        radius: 1,
        height: 2,
      };
    case "box":
      return {
        ...b,
        kind,
        position: [at[0], at[1] + 1, at[2]],
        rotation: [0, 0, 0],
        size: [2, 2, 2],
      };
    case "plane":
      return {
        ...b,
        kind,
        position: at,
        rotation: [0, 0, 0],
        width: 4,
        depth: 4,
      };
    case "disk":
      return {
        ...b,
        kind,
        position: [at[0], at[1] + 0.01, at[2]],
        rotation: [0, 0, 0],
        radius: 1.2,
      };
    case "point":
      return { ...b, kind, position: [at[0], at[1] + 1, at[2]] };
  }
}

export function createSegment(
  objects: readonly EditorObject[],
  from: string,
  to: string,
): SegmentObject {
  return {
    ...base(objects, "segment"),
    label: "",
    kind: "segment",
    from,
    to,
    arrow: false,
  };
}

export function createFace(
  objects: readonly EditorObject[],
  points: string[],
): FaceObject {
  return { ...base(objects, "face"), label: "", kind: "face", points };
}

/** Rejects anything that is not a well-formed editor document. */
export function parseDoc(value: unknown): EditorDoc | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<EditorDoc>;
  if (doc.version !== 1 || !Array.isArray(doc.objects)) return null;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const isTuple = (t: unknown) =>
    Array.isArray(t) && t.length === 3 && t.every(finite);
  const ids = new Set<string>();
  for (const object of doc.objects as EditorObject[]) {
    if (!object || typeof object.id !== "string" || ids.has(object.id))
      return null;
    if (!(object.kind in KIND_NAMES)) return null;
    if (isPositioned(object) && !isTuple(object.position)) return null;
    if (isRotated(object) && !isTuple(object.rotation)) return null;
    if (object.kind === "box" && !isTuple(object.size)) return null;
    ids.add(object.id);
  }
  for (const object of doc.objects as EditorObject[]) {
    if (
      object.kind === "segment" &&
      (!ids.has(object.from) || !ids.has(object.to))
    )
      return null;
    if (
      object.kind === "face" &&
      (object.points.length < 3 || !object.points.every((id) => ids.has(id)))
    )
      return null;
  }
  return {
    version: 1,
    title: typeof doc.title === "string" ? doc.title : "제목 없는 장면",
    objects: doc.objects as EditorObject[],
    settings: { ...DEFAULT_SETTINGS, ...(doc.settings ?? {}) },
  };
}
