import type { BuiltScene } from "./build";
import { boundsCenter } from "./build";
import {
  add3,
  applyMat,
  clean,
  eulerToMatrix,
  matrixToEulerNear,
  mulMat,
  scale3,
  snapValue,
  sub3,
  type Mat3,
  type Tuple3,
} from "./math";
import {
  isPositioned,
  isRotated,
  references,
  type EditorObject,
  type PositionedObject,
} from "./model";
import type { ObjectPatch } from "./state";

const tidy = (p: Tuple3): Tuple3 =>
  p.map((value) => clean(value, 1e-9)) as unknown as Tuple3;

/**
 * What a move, turn or resize of the selection actually changes: placed
 * shapes, free points, the operands under a boolean and the free points a
 * segment or face runs through. Constrained points follow on their own.
 */
export function transformTargets(
  objects: readonly EditorObject[],
  selection: readonly string[],
): PositionedObject[] {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const out = new Map<string, PositionedObject>();
  const visit = (id: string, depth: number) => {
    const object = byId.get(id);
    if (!object || out.has(id) || depth > 32) return;
    if (object.kind === "point") {
      if (!object.constraint) out.set(id, object);
    } else if (isPositioned(object)) out.set(id, object);
    else if (object.kind === "boolean") {
      visit(object.a, depth + 1);
      visit(object.b, depth + 1);
    } else references(object).forEach((ref) => visit(ref, depth + 1));
  };
  for (const id of selection) visit(id, 0);
  return [...out.values()];
}

/** Where gizmos sit: the shape itself for one shape, else the middle of the group. */
export function pivotOf(
  objects: readonly EditorObject[],
  selection: readonly string[],
  scene: BuiltScene,
  targets: readonly PositionedObject[],
): Tuple3 | null {
  if (selection.length === 1) {
    const object = objects.find((o) => o.id === selection[0]);
    if (object?.kind === "point")
      return scene.points.get(object.id) ?? object.position;
    if (object && isPositioned(object)) return object.position;
    if (object?.kind === "boolean") {
      // Turn a boolean about its first operand: a drilled ball about the ball.
      let first: EditorObject | undefined = object;
      for (let i = 0; i < 32 && first?.kind === "boolean"; i++) {
        const operand: string = first.a;
        first = objects.find((o) => o.id === operand);
      }
      if (first && isPositioned(first)) return first.position;
    }
  }
  if (!targets.length) return null;
  const centers = selection
    .map((id) => scene.bounds.get(id))
    .filter((b) => !!b)
    .map(boundsCenter);
  const from = centers.length ? centers : targets.map((t) => t.position);
  return scale3(from.reduce(add3), 1 / from.length);
}

export function movePatches(
  targets: readonly PositionedObject[],
  delta: Tuple3,
): ObjectPatch[] {
  return targets.map((t) => ({
    id: t.id,
    patch: { position: tidy(add3(t.position, delta)) },
  }));
}

export function rotatePatches(
  targets: readonly PositionedObject[],
  pivot: Tuple3,
  turn: Mat3,
): ObjectPatch[] {
  return targets.map((t) => {
    const position = tidy(add3(pivot, applyMat(turn, sub3(t.position, pivot))));
    return {
      id: t.id,
      patch: isRotated(t)
        ? {
            position,
            rotation: matrixToEulerNear(
              mulMat(turn, eulerToMatrix(t.rotation)),
              t.rotation,
            ),
          }
        : { position },
    };
  });
}

const MIN = 0.01;
const grow = (value: number, k: number, step: number) => {
  const v = Math.max(MIN, value * k);
  return step > 0 ? Math.max(MIN, snapValue(v, step)) : clean(v, 1e-9);
};

/** Size fields scaled by `k`, keeping each shape's proportions. */
function sizePatch(
  t: PositionedObject,
  k: number,
  step: number,
): Partial<EditorObject> {
  switch (t.kind) {
    case "sphere":
    case "disk":
      return { radius: grow(t.radius, k, step) };
    case "cylinder":
    case "cone":
      return { radius: grow(t.radius, k, step), height: grow(t.height, k, step) };
    case "box":
      return {
        size: t.size.map((v) => grow(v, k, step)) as unknown as Tuple3,
      };
    case "plane":
      return { width: grow(t.width, k, step), depth: grow(t.depth, k, step) };
    default:
      return {};
  }
}

/** Uniform scale about the pivot. */
export function scalePatches(
  targets: readonly PositionedObject[],
  pivot: Tuple3,
  k: number,
  step = 0,
): ObjectPatch[] {
  return targets.map((t) => ({
    id: t.id,
    patch: {
      ...sizePatch(t, k, step),
      position: tidy(add3(pivot, scale3(sub3(t.position, pivot), k))),
    } as Partial<EditorObject>,
  }));
}

/** Which local axes of a shape have a size of their own to drag. */
export function scaleAxesOf(object: EditorObject): readonly boolean[] {
  switch (object.kind) {
    case "sphere":
    case "box":
    case "cylinder":
    case "cone":
      return [true, true, true];
    case "plane":
    case "disk":
      return [true, false, true];
    default:
      return [false, false, false];
  }
}

/** Stretch one local axis of a single shape. */
export function axisScalePatch(
  object: PositionedObject,
  axis: number,
  k: number,
  step = 0,
): Partial<EditorObject> {
  switch (object.kind) {
    case "sphere":
    case "disk":
      return { radius: grow(object.radius, k, step) };
    case "cylinder":
    case "cone":
      return axis === 1
        ? { height: grow(object.height, k, step) }
        : { radius: grow(object.radius, k, step) };
    case "box": {
      const size = [...object.size] as [number, number, number];
      size[axis] = grow(size[axis]!, k, step);
      return { size };
    }
    case "plane":
      return axis === 0
        ? { width: grow(object.width, k, step) }
        : { depth: grow(object.depth, k, step) };
    default:
      return {};
  }
}
