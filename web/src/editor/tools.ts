import type { CsgOperation } from "@hlr/scene/primitives/csg.js";
import { formatLength } from "./labels";
import { length3, sub3, type Tuple3 } from "./math";
import {
  consumedIds,
  createAngle,
  createFace,
  createMeasure,
  createObject,
  createPoint,
  createSegment,
  isSolid,
  nextLabel,
  type EditorObject,
  type PointConstraint,
  type PointObject,
} from "./model";
import { resolvePoints } from "./resolve";
import type { EditorAction } from "./state";

export type ToolId =
  | "segment"
  | "face"
  | "midpoint"
  | "foot"
  | "intersection"
  | "center"
  | "onSegment"
  | "onSphere"
  | "onPlane"
  | CsgOperation
  | "angle"
  | "measure";

export type Tool = {
  id: ToolId;
  label: string;
  /** What to select for the tool to work. */
  needs: string;
};

export const POINT_TOOLS: readonly Tool[] = [
  { id: "segment", label: "선분", needs: "점 두 개 이상을 고르면 차례로 잇고, 아니면 새 점 두 개로 만듭니다" },
  { id: "face", label: "면", needs: "점 세 개 이상을 고르면 그 점들을 지나는 면, 아니면 새 삼각형" },
];

export const CONSTRUCT_TOOLS: readonly Tool[] = [
  { id: "midpoint", label: "중점", needs: "점 두 개나 선분 하나를 고르세요" },
  { id: "foot", label: "수선의 발", needs: "점 하나와 평면·면·선분 하나를 고르세요" },
  { id: "intersection", label: "교점", needs: "선분 하나와 평면·면 하나를 고르세요" },
  { id: "center", label: "중심", needs: "도형·면·선분 하나를 고르세요" },
  { id: "onSegment", label: "선분 위", needs: "선분 하나를 고르세요" },
  { id: "onSphere", label: "구 위", needs: "구 하나를 고르세요" },
  { id: "onPlane", label: "평면 위", needs: "평면 하나를 고르세요" },
];

export const BOOLEAN_TOOLS: readonly Tool[] = [
  { id: "union", label: "합치기", needs: "입체 두 개를 고르세요 (A ∪ B)" },
  { id: "subtract", label: "빼기", needs: "입체 두 개를 고르세요. 먼저 고른 것에서 나중 것을 뺍니다 (A − B)" },
  { id: "intersect", label: "교집합", needs: "입체 두 개를 고르세요 (A ∩ B)" },
];

export const MARK_TOOLS: readonly Tool[] = [
  { id: "angle", label: "각", needs: "점 세 개(A, 꼭짓점, B)나 한 점에서 만나는 선분 두 개를 고르세요" },
  { id: "measure", label: "길이", needs: "점 두 개나 선분 하나를 고르세요" },
];

export const ALL_TOOLS = [
  ...POINT_TOOLS,
  ...CONSTRUCT_TOOLS,
  ...BOOLEAN_TOOLS,
  ...MARK_TOOLS,
];

export type ToolContext = {
  objects: readonly EditorObject[];
  selection: readonly string[];
  /** Where new free points go when nothing is selected. */
  dropAt: Tuple3;
};

/** The first unused letter of `preferred`, else the next free capital. */
function letter(objects: readonly EditorObject[], preferred: string): string {
  const used = new Set(objects.map((o) => o.label));
  for (const l of preferred) if (!used.has(l)) return l;
  return nextLabel(objects, "point");
}

/** A constrained point with its rule already evaluated for the fallback. */
function constructed(
  objects: readonly EditorObject[],
  constraint: PointConstraint,
  preferred: string,
): PointObject | null {
  // A rule that cannot be evaluated (parallel lines, a zero-length segment)
  // falls back to this position, so NaN marks the construction as impossible.
  const draft = createPoint(objects, constraint, [NaN, NaN, NaN]);
  const position = resolvePoints([...objects, draft]).get(draft.id);
  if (!position || !position.every(Number.isFinite)) return null;
  const label = letter(objects, preferred);
  return { ...draft, label, name: `점 ${label}`, position };
}

const add = (objects: readonly EditorObject[]): EditorAction => ({
  type: "add",
  objects,
});

/** The action a tool takes on the current selection, or null when it cannot. */
export function toolAction(id: ToolId, ctx: ToolContext): EditorAction | null {
  const { objects, selection, dropAt } = ctx;
  const byId = new Map(objects.map((o) => [o.id, o]));
  const picked = selection
    .map((s) => byId.get(s))
    .filter((o): o is EditorObject => !!o);
  const kinds = picked.map((o) => o.kind);
  const points = picked.filter((o) => o.kind === "point");
  const only = (...wanted: string[]) =>
    picked.length === wanted.length && wanted.every((k, i) => kinds[i] === k);
  const one = picked.length === 1 ? picked[0]! : null;
  const positions = resolvePoints(objects);

  /** New free points spread around the drop point. */
  const freshPoints = (count: number): PointObject[] => {
    const made: PointObject[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / 6;
      made.push(
        createObject([...objects, ...made], "point", [
          dropAt[0] + 1.5 * Math.cos(angle),
          dropAt[1],
          dropAt[2] + 1.5 * Math.sin(angle),
        ]) as PointObject,
      );
    }
    return made;
  };

  switch (id) {
    case "segment": {
      if (points.length >= 2 && points.length === picked.length) {
        const made: EditorObject[] = [];
        for (let i = 0; i + 1 < points.length; i++)
          made.push(
            createSegment([...objects, ...made], points[i]!.id, points[i + 1]!.id),
          );
        return add(made);
      }
      const ends = freshPoints(2);
      return add([
        ...ends,
        createSegment([...objects, ...ends], ends[0]!.id, ends[1]!.id),
      ]);
    }
    case "face": {
      if (points.length >= 3 && points.length === picked.length)
        return add([createFace(objects, points.map((p) => p.id))]);
      const corners = freshPoints(3);
      return add([
        ...corners,
        createFace(
          [...objects, ...corners],
          corners.map((p) => p.id),
        ),
      ]);
    }
    case "midpoint": {
      const constraint: PointConstraint | null = only("point", "point")
        ? { type: "midpoint", a: picked[0]!.id, b: picked[1]!.id }
        : one?.kind === "segment"
          ? { type: "midpoint", a: one.from, b: one.to }
          : null;
      const point = constraint && constructed(objects, constraint, "MN");
      return point ? add([point]) : null;
    }
    case "foot": {
      if (picked.length !== 2) return null;
      const p = picked.find((o) => o.kind === "point");
      const onto = picked.find(
        (o) =>
          o !== p &&
          (o.kind === "plane" ||
            o.kind === "disk" ||
            o.kind === "face" ||
            o.kind === "segment"),
      );
      if (!p || !onto) return null;
      const point = constructed(
        objects,
        { type: "foot", point: p.id, onto: onto.id },
        "HIK",
      );
      return point ? add([point]) : null;
    }
    case "intersection": {
      if (picked.length !== 2) return null;
      const line = picked.find((o) => o.kind === "segment");
      const surface = picked.find(
        (o) => o.kind === "plane" || o.kind === "disk" || o.kind === "face",
      );
      if (line?.kind !== "segment" || !surface) return null;
      const point = constructed(
        objects,
        { type: "intersection", line: line.id, surface: surface.id },
        "PQR",
      );
      return point ? add([point]) : null;
    }
    case "center": {
      if (!one || one.kind === "point" || one.kind === "angle" || one.kind === "measure")
        return null;
      const point = constructed(
        objects,
        { type: "center", of: one.id },
        one.kind === "face" ? "G" : one.kind === "segment" ? "M" : "OC",
      );
      return point ? add([point]) : null;
    }
    case "onSegment": {
      if (one?.kind !== "segment") return null;
      const point = constructed(
        objects,
        { type: "onSegment", segment: one.id, t: 1 / 3 },
        "PQ",
      );
      return point ? add([point]) : null;
    }
    case "onSphere": {
      if (one?.kind !== "sphere") return null;
      const point = constructed(
        objects,
        { type: "onSphere", sphere: one.id, azimuth: 30, elevation: 35 },
        "PQ",
      );
      return point ? add([point]) : null;
    }
    case "onPlane": {
      if (one?.kind !== "plane") return null;
      const point = constructed(
        objects,
        { type: "onPlane", plane: one.id, u: one.width / 4, v: one.depth / 4 },
        "PQ",
      );
      return point ? add([point]) : null;
    }
    case "union":
    case "subtract":
    case "intersect": {
      if (picked.length !== 2 || !picked.every(isSolid)) return null;
      const consumed = consumedIds(objects);
      if (picked.some((o) => consumed.has(o.id))) return null;
      return { type: "boolean", op: id, a: picked[0]!.id, b: picked[1]!.id };
    }
    case "angle": {
      if (only("point", "point", "point"))
        return add([
          createAngle(objects, picked[0]!.id, picked[1]!.id, picked[2]!.id),
        ]);
      if (only("segment", "segment")) {
        const [s, t] = picked as Extract<EditorObject, { kind: "segment" }>[];
        const shared = [s!.from, s!.to].find((p) => p === t!.from || p === t!.to);
        if (!shared) return null;
        const a = s!.from === shared ? s!.to : s!.from;
        const b = t!.from === shared ? t!.to : t!.from;
        if (a === b) return null;
        return add([createAngle(objects, a, shared, b)]);
      }
      return null;
    }
    case "measure": {
      const ends = only("point", "point")
        ? [picked[0]!.id, picked[1]!.id]
        : one?.kind === "segment"
          ? [one.from, one.to]
          : null;
      if (!ends) return null;
      const a = positions.get(ends[0]!);
      const b = positions.get(ends[1]!);
      if (!a || !b) return null;
      return add([
        createMeasure(objects, ends[0]!, ends[1]!, formatLength(length3(sub3(b, a)))),
      ]);
    }
  }
}

