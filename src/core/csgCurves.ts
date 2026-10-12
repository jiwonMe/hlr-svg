import type { Camera } from "../camera/camera.js";
import {
  circleToCubics3,
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "../curves/builders.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import { splitCubicWhere } from "../curves/split.js";
import { Vec3 } from "../math/vec3.js";
import type { Primitive } from "../scene/primitive.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";
import { Cone } from "../scene/primitives/cone.js";
import { Csg, CSG_TOLERANCE, type CsgLeaf } from "../scene/primitives/csg.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { OrientedBox } from "../scene/primitives/orientedBox.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";

function boxCorners(b: BoxAabb): Vec3[] {
  return Array.from(
    { length: 8 },
    (_, i) =>
      new Vec3(
        i & 1 ? b.max.x : b.min.x,
        i & 2 ? b.max.y : b.min.y,
        i & 4 ? b.max.z : b.min.z,
      ),
  );
}

const BOX_EDGES: readonly [number, number][] = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Outline for the view, plus rims and edges, of one operand. */
function leafCurves(leaf: CsgLeaf, camera: Camera): CubicBezier3[] {
  const viewDirection =
    camera.kind === "orthographic" ? camera.forward : undefined;
  const cameraPos = camera.position;
  if (leaf instanceof Sphere)
    return sphereSilhouetteToCubics3({
      cameraPos,
      viewDirection,
      center: leaf.center,
      radius: leaf.radius,
    });
  if (leaf instanceof Cylinder) {
    const top = Vec3.add(leaf.base, Vec3.mulScalar(leaf.axis, leaf.height));
    return [
      ...cylinderSilhouetteToCubics3({
        cameraPos,
        viewDirection,
        base: leaf.base,
        axis: leaf.axis,
        height: leaf.height,
        radius: leaf.radius,
      }),
      ...circleToCubics3({
        center: leaf.base,
        normal: leaf.axis,
        radius: leaf.radius,
      }),
      ...circleToCubics3({
        center: top,
        normal: leaf.axis,
        radius: leaf.radius,
      }),
    ];
  }
  if (leaf instanceof Cone) {
    const base = Vec3.add(leaf.apex, Vec3.mulScalar(leaf.axis, leaf.height));
    return [
      ...coneSilhouetteToCubics3({
        cameraPos,
        viewDirection,
        apex: leaf.apex,
        axis: leaf.axis,
        height: leaf.height,
        baseRadius: leaf.baseRadius,
      }),
      ...circleToCubics3({
        center: base,
        normal: leaf.axis,
        radius: leaf.baseRadius,
      }),
    ];
  }
  if (leaf instanceof OrientedBox)
    return leaf.edges().map(([a, b]) => lineToCubic3(a, b));
  const corners = boxCorners(leaf);
  return BOX_EDGES.map(([a, b]) => lineToCubic3(corners[a]!, corners[b]!));
}

// Where operands meet does not depend on the view: compute it once per solid.
const seams = new WeakMap<Csg, readonly CubicBezier3[]>();

function operandSeams(csg: Csg): readonly CubicBezier3[] {
  let curves = seams.get(csg);
  if (!curves) {
    curves = intersectionCurvesToOwnedCubics(csg.leaves(), {
      angularSamples: 192,
    }).map((x) => x.bez);
    seams.set(csg, curves);
  }
  return curves;
}

/**
 * Visible-or-hidden candidates for a boolean solid: every operand outline,
 * rim, edge and seam, trimmed to where it lies on the combined boundary.
 * Hidden-line removal then splits them like any other curve.
 */
export function csgBoundaryCurves(csg: Csg, camera: Camera): CubicBezier3[] {
  const tolerance = csg.size() * CSG_TOLERANCE;
  const onBoundary = (p: Vec3) => csg.classify(p, tolerance) === 0;
  const candidates = [
    ...csg.leaves().flatMap((leaf) => leafCurves(leaf, camera)),
    ...operandSeams(csg),
  ];
  return candidates.flatMap((curve) => splitCubicWhere(curve, onBoundary));
}

export function csgCurvesForPrimitives(
  primitives: readonly Primitive[],
  camera: Camera,
): CubicBezier3[] {
  return primitives.flatMap((p) =>
    p instanceof Csg ? csgBoundaryCurves(p, camera) : [],
  );
}
