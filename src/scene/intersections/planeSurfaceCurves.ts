import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { Disk } from "../primitives/disk.js";
import { PlaneRect } from "../primitives/planeRect.js";
import { basisFromAxis, quadraticTrigRoots, solveQuadratic } from "./math.js";
import { traceQuadraticIntersection } from "./sampledCurves.js";

type PlaneSurface = {
  kind: "disk" | "rect";
  id: string;
  point: Vec3;
  normal: Vec3;
  contains: (p: Vec3) => boolean;
  boundaries: readonly ((p: Vec3) => number)[];
  typicalSize: number;
};

export type OwnedCubic3 = {
  bez: CubicBezier3;
  ignorePrimitiveIds: readonly string[];
};

export function planeSurfaceCurvesToCubics(
  planeSurfaces: readonly (Disk | PlaneRect)[],
  curved: readonly (Sphere | Cylinder | Cone)[],
): CubicBezier3[] {
  return planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved).map(
    (x) => x.bez,
  );
}

export function planeSurfaceCurvesToOwnedCubics(
  planeSurfaces: readonly (Disk | PlaneRect)[],
  curved: readonly (Sphere | Cylinder | Cone)[],
  opts?: {
    angularSamples?: number;
    useBezierFit?: boolean;
    fitMode?: "perRun" | "stitchThenFit";
  },
): OwnedCubic3[] {
  const angularSamples = Math.max(32, Math.floor(opts?.angularSamples ?? 160));
  const useBezierFit = opts?.useBezierFit ?? true;
  const planes = planeSurfaces.map(toPlaneSurface);
  const out: OwnedCubic3[] = [];

  for (const pl of planes) {
    for (const obj of curved) {
      // Skip if the plane surface is a cap disk of this curved surface (would duplicate the rim)
      // Cap disk ids have format: "${primitiveId}:cap:base" or "${primitiveId}:cap:top"
      if (isCapDiskOf(pl.id, obj.id)) continue;

      // Build ignorePrimitiveIds: include both the plane surface and the curved surface.
      // For cap disks, also include the parent primitive (e.g., "cone1:cap:base" → also include "cone1")
      // so that the parent's side surface doesn't incorrectly occlude the intersection curve.
      const parentId = getCapDiskParentId(pl.id);
      const ignorePrimitiveIds = parentId
        ? ([pl.id, obj.id, parentId] as const)
        : ([pl.id, obj.id] as const);

      if (obj instanceof Sphere)
        out.push(
          ...planeSphere(pl, obj, angularSamples, useBezierFit).map((bez) => ({
            bez,
            ignorePrimitiveIds,
          })),
        );
      if (obj instanceof Cylinder)
        out.push(
          ...planeCylinder(pl, obj, angularSamples, useBezierFit).map(
            (bez) => ({ bez, ignorePrimitiveIds }),
          ),
        );
      if (obj instanceof Cone)
        out.push(
          ...planeCone(pl, obj, angularSamples, useBezierFit).map((bez) => ({
            bez,
            ignorePrimitiveIds,
          })),
        );
    }
  }

  return out;
}

/** Check if diskId is a cap disk derived from primitiveId (format: "${primitiveId}:cap:...") */
function isCapDiskOf(diskId: string, primitiveId: string): boolean {
  return diskId.startsWith(`${primitiveId}:cap:`);
}

/** Extract parent primitive id from cap disk id (e.g., "cone1:cap:base" → "cone1"), or null if not a cap disk */
function getCapDiskParentId(diskId: string): string | null {
  const capIdx = diskId.indexOf(":cap:");
  if (capIdx < 0) return null;
  return diskId.slice(0, capIdx);
}

function toPlaneSurface(p: Disk | PlaneRect): PlaneSurface {
  const coordinateEps =
    Math.max(Math.abs(p.center.x), Math.abs(p.center.y), Math.abs(p.center.z)) *
    Number.EPSILON *
    32;
  if (p instanceof Disk) {
    const eps = Math.max(p.radius * 1e-10, coordinateEps);
    const boundary = (point: Vec3) =>
      Vec3.distanceSq(point, p.center) - p.radius * p.radius;
    return {
      kind: "disk",
      id: p.id,
      point: p.center,
      normal: p.normal,
      typicalSize: p.radius,
      contains: (point) => boundary(point) <= 2 * p.radius * eps + eps * eps,
      boundaries: [boundary],
    };
  }
  const du = (point: Vec3) => Vec3.dot(Vec3.sub(point, p.center), p.u);
  const dv = (point: Vec3) => Vec3.dot(Vec3.sub(point, p.center), p.v);
  return {
    kind: "rect",
    id: p.id,
    point: p.center,
    normal: p.normal,
    typicalSize: Math.max(p.halfWidth, p.halfHeight),
    contains: (point) =>
      Math.abs(du(point)) <=
        p.halfWidth + Math.max(p.halfWidth * 1e-10, coordinateEps) &&
      Math.abs(dv(point)) <=
        p.halfHeight + Math.max(p.halfHeight * 1e-10, coordinateEps),
    boundaries: [
      (point) => du(point) - p.halfWidth,
      (point) => du(point) + p.halfWidth,
      (point) => dv(point) - p.halfHeight,
      (point) => dv(point) + p.halfHeight,
    ],
  };
}

/** Homogeneous clipping equations avoid poles where a plane is parallel to a generator. */
function planeBoundaryEquations(
  pl: PlaneSurface,
  baseAt: (theta: number) => Vec3,
  directionAt: (theta: number) => Vec3,
): ((theta: number) => number)[] {
  // Each boundary is linear (rectangle) or quadratic (disk). Recover its
  // homogeneous form from F(base), F(base + direction), and F(base - direction).
  return pl.boundaries.map((boundary) => (theta) => {
    const base = baseAt(theta),
      direction = directionAt(theta);
    const b = Vec3.dot(pl.normal, direction);
    const c = Vec3.dot(pl.normal, Vec3.sub(base, pl.point));
    const f0 = boundary(base),
      f1 = boundary(Vec3.add(base, direction));
    const fm = boundary(Vec3.sub(base, direction));
    const quadratic = (f1 + fm) / 2 - f0;
    const linear = (f1 - fm) / 2;
    // Multiplying a linear boundary by b (rather than b²) keeps the
    // expression's harmonics <= 2, as required by quadraticTrigRoots.
    if (pl.kind === "rect") return f0 * b - linear * c;
    return f0 * b * b - linear * c * b + quadratic * c * c;
  });
}

function planeSphere(
  pl: PlaneSurface,
  s: Sphere,
  samples: number,
  useBezierFit: boolean,
): CubicBezier3[] {
  const n = Vec3.normalize(pl.normal);
  const dist = Vec3.dot(n, Vec3.sub(s.center, pl.point));
  if (Math.abs(dist) > s.radius) return [];
  const center = Vec3.sub(s.center, Vec3.mulScalar(n, dist));
  const radius = Math.sqrt(Math.max(0, s.radius * s.radius - dist * dist));
  if (radius <= s.radius * 1e-10)
    return pl.contains(center)
      ? markerAt(center, n, Math.max(0.02, pl.typicalSize * 0.02))
      : [];
  const { u, v } = basisFromAxis(n);
  const pointAt = (theta: number) =>
    Vec3.add(
      center,
      Vec3.add(
        Vec3.mulScalar(u, radius * Math.cos(theta)),
        Vec3.mulScalar(v, radius * Math.sin(theta)),
      ),
    );
  return traceQuadraticIntersection({
    samples,
    maxParameter: 1,
    equation: () => ({ a: 0, b: 1, c: -1 }),
    pointAt,
    inside: pl.contains,
    boundaryEquations: pl.boundaries.map(
      (boundary) => (theta) => boundary(pointAt(theta)),
    ),
    surfaceError: (point) =>
      Math.max(
        Math.abs(Vec3.distance(point, s.center) - s.radius),
        Math.abs(Vec3.dot(n, Vec3.sub(point, pl.point))),
      ),
    tolerance: s.radius * 2e-5,
    useBezierFit,
  });
}

function planeCylinder(
  pl: PlaneSurface,
  c: Cylinder,
  samples: number,
  useBezierFit: boolean,
): CubicBezier3[] {
  const { u, v } = basisFromAxis(c.axis);
  const baseAt = (theta: number) =>
    Vec3.add(
      c.base,
      Vec3.add(
        Vec3.mulScalar(u, c.radius * Math.cos(theta)),
        Vec3.mulScalar(v, c.radius * Math.sin(theta)),
      ),
    );
  const denom = Vec3.dot(pl.normal, c.axis);
  if (Math.abs(denom) <= 1e-12) {
    return quadraticTrigRoots((theta) =>
      Vec3.dot(pl.normal, Vec3.sub(baseAt(theta), pl.point)),
    ).flatMap((theta) =>
      clipGenerator(
        pl,
        baseAt(theta),
        Vec3.add(baseAt(theta), Vec3.mulScalar(c.axis, c.height)),
      ),
    );
  }
  return tracePlaneGenerators(
    pl,
    baseAt,
    () => c.axis,
    c.height,
    Math.max(c.radius, c.height),
    (point) => {
      const offset = Vec3.sub(point, c.base);
      return Math.abs(
        Vec3.len(
          Vec3.sub(offset, Vec3.mulScalar(c.axis, Vec3.dot(offset, c.axis))),
        ) - c.radius,
      );
    },
    samples,
    useBezierFit,
  );
}

function planeCone(
  pl: PlaneSurface,
  c: Cone,
  samples: number,
  useBezierFit: boolean,
): CubicBezier3[] {
  const { u, v } = basisFromAxis(c.axis),
    slope = c.baseRadius / c.height;
  const directionAt = (theta: number) =>
    Vec3.add(
      c.axis,
      Vec3.add(
        Vec3.mulScalar(u, slope * Math.cos(theta)),
        Vec3.mulScalar(v, slope * Math.sin(theta)),
      ),
    );
  const offset = Vec3.dot(pl.normal, Vec3.sub(c.apex, pl.point));
  if (Math.abs(offset) <= Math.max(c.height, c.baseRadius) * 1e-12) {
    return quadraticTrigRoots((theta) =>
      Vec3.dot(pl.normal, directionAt(theta)),
    ).flatMap((theta) =>
      clipGenerator(
        pl,
        c.apex,
        Vec3.add(c.apex, Vec3.mulScalar(directionAt(theta), c.height)),
      ),
    );
  }
  return tracePlaneGenerators(
    pl,
    () => c.apex,
    directionAt,
    c.height,
    Math.max(c.baseRadius, c.height),
    (point) => {
      const d = Vec3.sub(point, c.apex),
        h = Vec3.dot(d, c.axis);
      return Math.abs(
        Vec3.len(Vec3.sub(d, Vec3.mulScalar(c.axis, h))) - slope * h,
      );
    },
    samples,
    useBezierFit,
  );
}

function tracePlaneGenerators(
  pl: PlaneSurface,
  baseAt: (theta: number) => Vec3,
  directionAt: (theta: number) => Vec3,
  height: number,
  scale: number,
  surfaceError: (point: Vec3) => number,
  samples: number,
  useBezierFit: boolean,
): CubicBezier3[] {
  return traceQuadraticIntersection({
    samples,
    maxParameter: height,
    equation: (theta) => ({
      a: 0,
      b: Vec3.dot(pl.normal, directionAt(theta)),
      c: Vec3.dot(pl.normal, Vec3.sub(baseAt(theta), pl.point)),
    }),
    pointAt: (theta, parameter) =>
      Vec3.add(baseAt(theta), Vec3.mulScalar(directionAt(theta), parameter)),
    inside: pl.contains,
    boundaryEquations: planeBoundaryEquations(pl, baseAt, directionAt),
    surfaceError: (point) =>
      Math.max(
        surfaceError(point),
        Math.abs(Vec3.dot(pl.normal, Vec3.sub(point, pl.point))),
      ),
    tolerance: scale * 2e-5,
    useBezierFit,
  });
}

/** Clip a whole generator, including when both endpoints lie outside the finite plane. */
function clipGenerator(pl: PlaneSurface, p0: Vec3, p1: Vec3): CubicBezier3[] {
  const direction = Vec3.sub(p1, p0);
  const pointAt = (t: number) => Vec3.add(p0, Vec3.mulScalar(direction, t));
  const cuts = [0, 1];
  for (const boundary of pl.boundaries) {
    const f0 = boundary(p0),
      f1 = boundary(p1),
      fm = boundary(pointAt(0.5));
    const a = 2 * f0 + 2 * f1 - 4 * fm;
    cuts.push(
      ...solveQuadratic(a, f1 - f0 - a, f0).filter((t) => t > 0 && t < 1),
    );
  }
  cuts.sort((a, b) => a - b);
  const out: CubicBezier3[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const left = cuts[i - 1],
      right = cuts[i];
    if (right - left > 1e-12 && pl.contains(pointAt((left + right) / 2)))
      out.push(lineToCubic3(pointAt(left), pointAt(right)));
  }
  return out;
}

function markerAt(p: Vec3, normal: Vec3, size: number): CubicBezier3[] {
  const { u, v } = basisFromAxis(Vec3.normalize(normal));
  const a0 = Vec3.sub(p, Vec3.mulScalar(u, size));
  const a1 = Vec3.add(p, Vec3.mulScalar(u, size));
  const b0 = Vec3.sub(p, Vec3.mulScalar(v, size));
  const b1 = Vec3.add(p, Vec3.mulScalar(v, size));
  return [lineToCubic3(a0, a1), lineToCubic3(b0, b1)];
}
