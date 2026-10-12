import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { circleToCubics3, lineToCubic3 } from "../../curves/builders.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { basisFromAxis, quadraticTrigRoots } from "./math.js";
import {
  traceQuadraticIntersection,
  type AngularQuadratic,
} from "./sampledCurves.js";

type CurvedPrimitive = Sphere | Cylinder | Cone;
type AngularSurface = {
  origin: (theta: number) => Vec3;
  direction: (theta: number) => Vec3;
};

export function intersectSphereSphere(s0: Sphere, s1: Sphere): CubicBezier3[] {
  const dVec = Vec3.sub(s1.center, s0.center);
  const d = Vec3.len(dVec);
  if (
    d <= 1e-9 ||
    d > s0.radius + s1.radius ||
    d < Math.abs(s0.radius - s1.radius)
  )
    return [];
  const x = (s0.radius * s0.radius - s1.radius * s1.radius + d * d) / (2 * d);
  const h2 = s0.radius * s0.radius - x * x;
  if (h2 <= 0) return [];
  const normal = Vec3.mulScalar(dVec, 1 / d);
  return circleToCubics3({
    center: Vec3.add(s0.center, Vec3.mulScalar(normal, x)),
    normal,
    radius: Math.sqrt(h2),
    maxSegmentAngleRad: Math.PI / 4,
  });
}

export function intersectSphereCylinder(
  sphere: Sphere,
  cylinder: Cylinder,
  samples: number,
  useBezierFit = true,
  _fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  return tracePair(cylinder, sphere, samples, useBezierFit);
}

export function intersectSphereCone(
  sphere: Sphere,
  cone: Cone,
  samples: number,
  useBezierFit = true,
  _fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  return tracePair(cone, sphere, samples, useBezierFit);
}

export function intersectCylinderCylinder(
  c0: Cylinder,
  c1: Cylinder,
  samples: number,
  useBezierFit = true,
  _fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  if (Vec3.lenSq(Vec3.cross(c0.axis, c1.axis)) <= 1e-20)
    return parallelCylinderIntersections(c0, c1);
  return tracePair(c0, c1, samples, useBezierFit);
}

export function intersectCylinderCone(
  cylinder: Cylinder,
  cone: Cone,
  samples: number,
  useBezierFit = true,
  _fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  return tracePair(cylinder, cone, samples, useBezierFit);
}

export function intersectConeCone(
  c0: Cone,
  c1: Cone,
  samples: number,
  useBezierFit = true,
  _fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  return tracePair(c0, c1, samples, useBezierFit);
}

function tracePair(
  primary: Cylinder | Cone,
  other: CurvedPrimitive,
  samples: number,
  useBezierFit: boolean,
): CubicBezier3[] {
  const surface = angularSurface(primary);
  const equation = (theta: number) =>
    equationAlongRay(surface.origin(theta), surface.direction(theta), other);
  const scale = Math.max(radiusOf(primary), radiusOf(other));
  const tolerance = Math.max(scale * 2e-5, 1e-10);
  const axialEps =
    Math.max(
      primary.height,
      other instanceof Sphere ? 0 : other.height,
      scale,
    ) * 1e-8;
  const boundaryEquations =
    other instanceof Sphere
      ? []
      : [0, other.height].map((height) => (theta: number) => {
          const relativeOrigin = Vec3.sub(
            surface.origin(theta),
            axialOrigin(other),
          );
          const y0 = Vec3.dot(relativeOrigin, other.axis);
          const y1 = Vec3.dot(surface.direction(theta), other.axis);
          const parameterNumerator = height - y0;
          const { a, b, c } = equation(theta);
          // Substitute parameter=(height-y0)/y1 without dividing near y1=0.
          return (
            a * parameterNumerator * parameterNumerator +
            b * parameterNumerator * y1 +
            c * y1 * y1
          );
        });
  const curves = traceQuadraticIntersection({
    samples,
    maxParameter: primary.height,
    equation,
    pointAt: (theta, parameter) =>
      Vec3.add(
        surface.origin(theta),
        Vec3.mulScalar(surface.direction(theta), parameter),
      ),
    inside: (point) =>
      insideAxial(point, primary, axialEps) &&
      (other instanceof Sphere || insideAxial(point, other, axialEps)),
    boundaryEquations,
    surfaceError: (point) =>
      Math.max(surfaceDistance(point, primary), surfaceDistance(point, other)),
    tolerance,
    useBezierFit,
  });
  return other instanceof Sphere
    ? curves
    : [
        ...curves,
        ...degenerateGeneratorIntersections(
          primary,
          other,
          surface,
          equation,
          tolerance,
        ),
      ];
}

function angularSurface(primitive: Cylinder | Cone): AngularSurface {
  const { u, v } = basisFromAxis(primitive.axis);
  const radial = (theta: number) =>
    Vec3.add(
      Vec3.mulScalar(u, Math.cos(theta)),
      Vec3.mulScalar(v, Math.sin(theta)),
    );
  if (primitive instanceof Cylinder) {
    return {
      origin: (theta) =>
        Vec3.add(
          primitive.base,
          Vec3.mulScalar(radial(theta), primitive.radius),
        ),
      direction: () => primitive.axis,
    };
  }
  const slope = primitive.baseRadius / primitive.height;
  return {
    origin: () => primitive.apex,
    direction: (theta) =>
      Vec3.add(primitive.axis, Vec3.mulScalar(radial(theta), slope)),
  };
}

function equationAlongRay(
  origin: Vec3,
  direction: Vec3,
  primitive: CurvedPrimitive,
): AngularQuadratic {
  if (primitive instanceof Sphere) {
    const relative = Vec3.sub(origin, primitive.center);
    return {
      a: Vec3.lenSq(direction),
      b: 2 * Vec3.dot(relative, direction),
      c: Vec3.lenSq(relative) - primitive.radius * primitive.radius,
    };
  }
  const relative = Vec3.sub(origin, axialOrigin(primitive));
  const y0 = Vec3.dot(relative, primitive.axis);
  const y1 = Vec3.dot(direction, primitive.axis);
  const perpendicularOrigin = Vec3.sub(
    relative,
    Vec3.mulScalar(primitive.axis, y0),
  );
  const perpendicularDirection = Vec3.sub(
    direction,
    Vec3.mulScalar(primitive.axis, y1),
  );
  const slopeSq =
    primitive instanceof Cone
      ? (primitive.baseRadius / primitive.height) ** 2
      : 0;
  return {
    a: Vec3.lenSq(perpendicularDirection) - slopeSq * y1 * y1,
    b:
      2 *
      (Vec3.dot(perpendicularOrigin, perpendicularDirection) -
        slopeSq * y0 * y1),
    c:
      Vec3.lenSq(perpendicularOrigin) -
      slopeSq * y0 * y0 -
      (primitive instanceof Cylinder ? primitive.radius * primitive.radius : 0),
  };
}

function axialOrigin(primitive: Cylinder | Cone): Vec3 {
  return primitive instanceof Cylinder ? primitive.base : primitive.apex;
}

function radiusOf(primitive: CurvedPrimitive): number {
  return primitive instanceof Cone ? primitive.baseRadius : primitive.radius;
}

function insideAxial(
  point: Vec3,
  primitive: Cylinder | Cone,
  eps: number,
): boolean {
  const height = Vec3.dot(
    Vec3.sub(point, axialOrigin(primitive)),
    primitive.axis,
  );
  return height >= -eps && height <= primitive.height + eps;
}

function surfaceDistance(point: Vec3, primitive: CurvedPrimitive): number {
  if (primitive instanceof Sphere)
    return Math.abs(Vec3.distance(point, primitive.center) - primitive.radius);
  const relative = Vec3.sub(point, axialOrigin(primitive));
  const height = Vec3.dot(relative, primitive.axis);
  const radial = Vec3.len(
    Vec3.sub(relative, Vec3.mulScalar(primitive.axis, height)),
  );
  if (primitive instanceof Cylinder) return Math.abs(radial - primitive.radius);
  const slope = primitive.baseRadius / primitive.height;
  return Math.abs(radial - slope * height) / Math.sqrt(1 + slope * slope);
}

function parallelCylinderIntersections(
  c0: Cylinder,
  c1: Cylinder,
): CubicBezier3[] {
  const offset = Vec3.sub(c1.base, c0.base);
  const axialOffset = Vec3.dot(offset, c0.axis);
  const perpendicularOffset = Vec3.sub(
    offset,
    Vec3.mulScalar(c0.axis, axialOffset),
  );
  const distance = Vec3.len(perpendicularOffset);
  const eps = Math.max(c0.radius, c1.radius, c0.height, c1.height) * 1e-10;
  if (
    distance <= eps ||
    distance > c0.radius + c1.radius + eps ||
    distance < Math.abs(c0.radius - c1.radius) - eps
  )
    return [];
  const along =
    (c0.radius * c0.radius - c1.radius * c1.radius + distance * distance) /
    (2 * distance);
  const heightSq = c0.radius * c0.radius - along * along;
  if (heightSq < -eps * Math.max(c0.radius, c1.radius)) return [];
  const c1End = axialOffset + Vec3.dot(c0.axis, c1.axis) * c1.height;
  const start = Math.max(0, Math.min(axialOffset, c1End));
  const end = Math.min(c0.height, Math.max(axialOffset, c1End));
  if (end - start <= eps) return [];
  const u = Vec3.mulScalar(perpendicularOffset, 1 / distance);
  const v = Vec3.normalize(Vec3.cross(c0.axis, u));
  const side = Math.sqrt(Math.max(0, heightSq));
  const offsets = side <= eps ? [0] : [-side, side];
  return offsets.map((lateral) => {
    const radial = Vec3.add(
      Vec3.mulScalar(u, along),
      Vec3.mulScalar(v, lateral),
    );
    const point = Vec3.add(c0.base, radial);
    return lineToCubic3(
      Vec3.add(point, Vec3.mulScalar(c0.axis, start)),
      Vec3.add(point, Vec3.mulScalar(c0.axis, end)),
    );
  });
}

function degenerateGeneratorIntersections(
  primary: Cylinder | Cone,
  other: Cylinder | Cone,
  surface: AngularSurface,
  equation: (theta: number) => AngularQuadratic,
  tolerance: number,
): CubicBezier3[] {
  const normalizedEquation = (theta: number) => {
    const { a, b, c } = equation(theta);
    return [a * primary.height * primary.height, b * primary.height, c];
  };
  const scale = Math.max(
    ...[0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].flatMap(
      (theta) => normalizedEquation(theta).map(Math.abs),
    ),
  );
  if (scale === 0) return []; // Coincident surfaces have no unique intersection curve.
  const angles = [
    0,
    ...[0, 1, 2].flatMap((coefficient) =>
      quadraticTrigRoots((theta) => normalizedEquation(theta)[coefficient]!),
    ),
  ]
    .map((theta) => (theta > 2 * Math.PI - 1e-9 ? 0 : theta))
    .sort((a, b) => a - b)
    .filter((theta, i, all) => i === 0 || theta - all[i - 1]! > 1e-9);
  return angles.flatMap((theta) => {
    if (
      normalizedEquation(theta).some(
        (coefficient) => Math.abs(coefficient) > scale * 1e-11,
      )
    )
      return [];
    // All coefficients vanish: this entire generator lies on both infinite
    // surfaces. The usual quadratic root solver cannot represent that interval.
    const origin = surface.origin(theta);
    const direction = surface.direction(theta);
    const offset = Vec3.dot(Vec3.sub(origin, axialOrigin(other)), other.axis);
    const rate = Vec3.dot(direction, other.axis);
    let start = 0;
    let end = primary.height;
    if (Math.abs(rate) <= 1e-12) {
      if (offset < 0 || offset > other.height) return [];
    } else {
      const t0 = -offset / rate;
      const t1 = (other.height - offset) / rate;
      start = Math.max(start, Math.min(t0, t1));
      end = Math.min(end, Math.max(t0, t1));
    }
    if (!(end > start)) return [];
    const p0 = Vec3.add(origin, Vec3.mulScalar(direction, start));
    const p3 = Vec3.add(origin, Vec3.mulScalar(direction, end));
    if (
      surfaceDistance(p0, other) > tolerance ||
      surfaceDistance(p3, other) > tolerance
    )
      return [];
    return [lineToCubic3(p0, p3)];
  });
}
