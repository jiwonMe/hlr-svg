import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { Disk } from "../primitives/disk.js";
import { PlaneRect } from "../primitives/planeRect.js";
import {
  basisFromAxis,
  mergeCyclicRuns,
  polylineRunsToLineCubics,
  splitRunsByJump,
  stitchRunsByEndpoints,
  tryMergeRunsToSinglePolyline,
} from "./math.js";
import { fitPolylineToCubics } from "./bezierFit.js";

type PlaneSurface =
  | { kind: "disk"; id: string; point: Vec3; normal: Vec3; contains: (p: Vec3) => boolean; typicalSize: number }
  | { kind: "rect"; id: string; point: Vec3; normal: Vec3; contains: (p: Vec3) => boolean; typicalSize: number };

export type OwnedCubic3 = { bez: CubicBezier3; ignorePrimitiveIds: readonly string[] };

export function planeSurfaceCurvesToCubics(
  planeSurfaces: readonly (Disk | PlaneRect)[],
  curved: readonly (Sphere | Cylinder | Cone)[],
): CubicBezier3[] {
  return planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved).map((x) => x.bez);
}

export function planeSurfaceCurvesToOwnedCubics(
  planeSurfaces: readonly (Disk | PlaneRect)[],
  curved: readonly (Sphere | Cylinder | Cone)[],
  opts?: { useBezierFit?: boolean; fitMode?: "perRun" | "stitchThenFit" },
): OwnedCubic3[] {
  const useBezierFit = opts?.useBezierFit ?? true;
  const fitMode = opts?.fitMode ?? "stitchThenFit";
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
        ? [pl.id, obj.id, parentId] as const
        : [pl.id, obj.id] as const;

      if (obj instanceof Sphere) out.push(...planeSphere(pl, obj, useBezierFit, fitMode).map((bez) => ({ bez, ignorePrimitiveIds })));
      if (obj instanceof Cylinder) out.push(...planeCylinder(pl, obj, useBezierFit, fitMode).map((bez) => ({ bez, ignorePrimitiveIds })));
      if (obj instanceof Cone) out.push(...planeCone(pl, obj, useBezierFit, fitMode).map((bez) => ({ bez, ignorePrimitiveIds })));
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
  if (p instanceof Disk) {
    return {
      kind: "disk",
      id: p.id,
      point: p.center,
      normal: p.normal,
      typicalSize: p.radius,
      contains: (x) => Vec3.distanceSq(x, p.center) <= p.radius * p.radius + 1e-7,
    };
  }
  // PlaneRect
  return {
    kind: "rect",
    id: p.id,
    point: p.center,
    normal: p.normal,
    typicalSize: Math.max(p.halfWidth, p.halfHeight),
    contains: (x) => {
      const d = Vec3.sub(x, p.center);
      const du = Vec3.dot(d, p.u);
      const dv = Vec3.dot(d, p.v);
      return Math.abs(du) <= p.halfWidth + 1e-7 && Math.abs(dv) <= p.halfHeight + 1e-7;
    },
  };
}

function planeSphere(pl: PlaneSurface, s: Sphere, useBezierFit: boolean, fitMode: "perRun" | "stitchThenFit"): CubicBezier3[] {
  // plane: n·(x-p0)=0
  const n = Vec3.normalize(pl.normal);
  const dist = Vec3.dot(n, Vec3.sub(s.center, pl.point));
  const ad = Math.abs(dist);
  if (ad > s.radius + 1e-7) return [];

  const circleCenter = Vec3.sub(s.center, Vec3.mulScalar(n, dist));
  const r2 = s.radius * s.radius - dist * dist;
  const r = Math.sqrt(Math.max(0, r2));
  if (r <= 1e-8) {
    // tangent: single point
    if (!pl.contains(circleCenter)) return [];
    return markerAt(circleCenter, n, Math.max(0.02, pl.typicalSize * 0.02));
  }

  return circleSampleToCubics(circleCenter, n, r, pl.contains, useBezierFit, fitMode);
}

function planeCylinder(pl: PlaneSurface, c: Cylinder, useBezierFit: boolean, fitMode: "perRun" | "stitchThenFit"): CubicBezier3[] {
  const n = Vec3.normalize(pl.normal);
  const dPlane = Vec3.dot(n, pl.point);

  const a = c.axis;
  const denom = Vec3.dot(n, a);
  const { u, v } = basisFromAxis(a);
  const N = 180;

  if (Math.abs(denom) <= 1e-10) {
    // plane parallel to axis -> intersection is 0/1/2 generators; sample θ solutions and emit line cubics
    const nu = Vec3.dot(n, u);
    const nv = Vec3.dot(n, v);
    const m = Math.hypot(nu, nv);
    if (m <= 1e-12) return [];
    const t = (dPlane - Vec3.dot(n, c.base)) / c.radius;
    const rhs = t / m;
    if (Math.abs(rhs) > 1) return [];
    const phi = Math.atan2(nv, nu);
    const delta = Math.acos(rhs);
    const th0 = phi + delta;
    const th1 = phi - delta;
    return [
      ...generatorLineAtTheta(pl, c, u, v, th0),
      ...generatorLineAtTheta(pl, c, u, v, th1),
    ];
  }

  const pts: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const baseOnCircle = Vec3.add(c.base, Vec3.mulScalar(w, c.radius));
    const sVal = (dPlane - Vec3.dot(n, baseOnCircle)) / denom;
    if (sVal < -1e-6 || sVal > c.height + 1e-6) continue;
    const p = Vec3.add(baseOnCircle, Vec3.mulScalar(a, sVal));
    if (!pl.contains(p)) continue;
    pts.push(p);
  }

  return polylineToCubics(pts, pl.typicalSize, useBezierFit, fitMode);
}

function generatorLineAtTheta(pl: PlaneSurface, c: Cylinder, u: Vec3, v: Vec3, th: number): CubicBezier3[] {
  const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
  const p0 = Vec3.add(c.base, Vec3.mulScalar(w, c.radius));
  const p1 = Vec3.add(p0, Vec3.mulScalar(c.axis, c.height));
  // clip by plane surface region by sampling ends only (good enough for demo)
  if (!pl.contains(p0) && !pl.contains(p1)) return [];
  return [lineToCubic3(p0, p1)];
}

function planeCone(pl: PlaneSurface, c: Cone, useBezierFit: boolean, fitMode: "perRun" | "stitchThenFit"): CubicBezier3[] {
  const n = Vec3.normalize(pl.normal);
  const dPlane = Vec3.dot(n, pl.point);

  const a = c.axis;
  const k = c.baseRadius / c.height;
  const { u, v } = basisFromAxis(a);
  const N = 220;

  const pts: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const denom = Vec3.dot(n, Vec3.add(a, Vec3.mulScalar(w, k)));
    if (Math.abs(denom) <= 1e-8) continue;
    const y = (dPlane - Vec3.dot(n, c.apex)) / denom;
    if (y < -1e-6 || y > c.height + 1e-6) continue;
    const p = Vec3.add(Vec3.add(c.apex, Vec3.mulScalar(a, y)), Vec3.mulScalar(w, k * y));
    if (!pl.contains(p)) continue;
    pts.push(p);
  }

  return polylineToCubics(pts, pl.typicalSize, useBezierFit, fitMode);
}

function polylineToCubics(points: Vec3[], scale: number, useBezierFit: boolean, fitMode: "perRun" | "stitchThenFit"): CubicBezier3[] {
  if (points.length < 2) return [];
  const step = (Math.PI * 2 * Math.max(1e-3, scale)) / Math.max(32, points.length);
  const maxJumpSq = (step * 14) * (step * 14);
  const closeEpsSq = (step * 3) * (step * 3);
  const runs = stitchRunsByEndpoints(mergeCyclicRuns(splitRunsByJump(points, maxJumpSq), closeEpsSq), closeEpsSq);
  if (!useBezierFit) return polylineRunsToLineCubics(runs, closeEpsSq);
  if (fitMode === "stitchThenFit") {
    const merged = tryMergeRunsToSinglePolyline(runs, closeEpsSq);
    if (merged) {
      const maxError = step * 0.65;
      return fitPolylineToCubics(merged, { maxError, closeEps: step * 3 });
    }
  }
  const maxError = step * 0.65;
  return runs.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }));
}

function circleSampleToCubics(
  center: Vec3,
  n: Vec3,
  r: number,
  inside: (p: Vec3) => boolean,
  useBezierFit: boolean,
  fitMode: "perRun" | "stitchThenFit",
): CubicBezier3[] {
  const { u, v } = basisFromAxis(n);
  const N = 220;
  const step = (2 * Math.PI * r) / N;
  const closeEpsSq = (step * 3) * (step * 3);
  // run split by inside flag
  const runs: Vec3[][] = [];
  let cur: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const p = Vec3.add(center, Vec3.add(Vec3.mulScalar(u, r * Math.cos(th)), Vec3.mulScalar(v, r * Math.sin(th))));
    const ok = inside(p);
    if (ok) cur.push(p);
    else {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) runs.push(cur);

  const mergedRuns = stitchRunsByEndpoints(mergeCyclicRuns(runs, closeEpsSq), closeEpsSq);
  if (!useBezierFit) return polylineRunsToLineCubics(mergedRuns, closeEpsSq);
  if (fitMode === "stitchThenFit") {
    const merged = tryMergeRunsToSinglePolyline(mergedRuns, closeEpsSq);
    if (merged) {
      const maxError = step * 0.6;
      return fitPolylineToCubics(merged, { maxError, closeEps: step * 3 });
    }
  }
  const maxError = step * 0.6;
  return mergedRuns.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }));
}

function markerAt(p: Vec3, normal: Vec3, size: number): CubicBezier3[] {
  const { u, v } = basisFromAxis(Vec3.normalize(normal));
  const a0 = Vec3.sub(p, Vec3.mulScalar(u, size));
  const a1 = Vec3.add(p, Vec3.mulScalar(u, size));
  const b0 = Vec3.sub(p, Vec3.mulScalar(v, size));
  const b1 = Vec3.add(p, Vec3.mulScalar(v, size));
  return [lineToCubic3(a0, a1), lineToCubic3(b0, b1)];
}

// mergeCyclicRuns / stitchRunsByEndpoints are shared in intersections/math.ts


