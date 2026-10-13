import {
  add3,
  applyMat,
  eulerToMatrix,
  frameOf,
  scale3,
  type Tuple3,
} from "./math";
import type { EditorObject } from "./model";

const MIN_SIZE = 0.01;
export const positive = (value: number) => Math.max(MIN_SIZE, value);

/** Corners of a box; bit 0, 1 and 2 of the index pick the +x, +y and +z side. */
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

/** A spot on a shape that a point can be pinned to, e.g. a corner. */
export type Anchor = { key: string; name: string; position: Tuple3 };

/** Corners, apexes and base centres: the spots exam figures letter. */
export function anchorsOf(object: EditorObject): Anchor[] {
  switch (object.kind) {
    case "box":
      return boxCorners(object.position, object.rotation, object.size).map(
        (position, i) => ({ key: `corner${i}`, name: "꼭짓점", position }),
      );
    case "plane":
      return planeCorners(object).map((position, i) => ({
        key: `corner${i}`,
        name: "꼭짓점",
        position,
      }));
    case "cone":
    case "cylinder": {
      const half = scale3(
        frameOf(object.rotation).up,
        positive(object.height) / 2,
      );
      const top = add3(object.position, half);
      const bottom = add3(object.position, scale3(half, -1));
      return object.kind === "cone"
        ? [
            { key: "apex", name: "꼭짓점", position: top },
            { key: "base", name: "밑면의 중심", position: bottom },
          ]
        : [
            { key: "top", name: "윗면의 중심", position: top },
            { key: "bottom", name: "밑면의 중심", position: bottom },
          ];
    }
    default:
      return [];
  }
}

export function anchorOf(object: EditorObject, key: string): Anchor | null {
  return anchorsOf(object).find((anchor) => anchor.key === key) ?? null;
}
