import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Vec3 } from "../../math/vec3.js";
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

export function intersectDiskPlaneRect(
  d: Disk,
  r: PlaneRect,
  opts?: { useBezierFit?: boolean; fitMode?: "perRun" | "stitchThenFit" },
): CubicBezier3[] {
  const useBezierFit = opts?.useBezierFit ?? true;
  const fitMode = opts?.fitMode ?? "stitchThenFit";
  const n0 = Vec3.normalize(d.normal);
  const n1 = Vec3.normalize(r.normal);
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);

  // parallel (including coplanar)
  if (dirLenSq <= 1e-12) {
    const planeDist = Math.abs(Vec3.dot(n1, Vec3.sub(d.center, r.center)));
    if (planeDist > 1e-6) return [];
    return intersectCoplanarDiskRect(d, r, useBezierFit, fitMode);
  }

  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq)); // unit
  const d0 = Vec3.dot(n0, d.center);
  const d1 = Vec3.dot(n1, r.center);
  const a = Vec3.sub(Vec3.mulScalar(n1, d0), Vec3.mulScalar(n0, d1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);

  const iDisk = clipLineToDisk(x0, dir, d);
  if (!iDisk) return [];
  const iRect = clipLineToRect(x0, dir, r);
  if (!iRect) return [];

  const tMin = Math.max(iDisk.tMin, iRect.tMin);
  const tMax = Math.min(iDisk.tMax, iRect.tMax);
  if (tMax < tMin) return [];
  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}

function clipLineToDisk(x0: Vec3, dirUnit: Vec3, d: Disk): { tMin: number; tMax: number } | null {
  // |(x0 + dir*t - c)|^2 <= r^2  (dir is unit => A=1)
  const m = Vec3.sub(x0, d.center);
  const b = 2 * Vec3.dot(m, dirUnit);
  const c = Vec3.dot(m, m) - d.radius * d.radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / 2;
  const t1 = (-b + s) / 2;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}

function clipLineToRect(x0: Vec3, dir: Vec3, r: PlaneRect): { tMin: number; tMax: number } | null {
  // constraints on t for |dot(x(t)-c,u)|<=hw and |dot(x(t)-c,v)|<=hh
  let tMin = -Number.POSITIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  const rel = Vec3.sub(x0, r.center);
  const du0 = Vec3.dot(rel, r.u);
  const du1 = Vec3.dot(dir, r.u);
  const dv0 = Vec3.dot(rel, r.v);
  const dv1 = Vec3.dot(dir, r.v);

  const uInt = slab1D(du0, du1, r.halfWidth);
  if (!uInt) return null;
  const vInt = slab1D(dv0, dv1, r.halfHeight);
  if (!vInt) return null;

  tMin = Math.max(tMin, uInt.tMin, vInt.tMin);
  tMax = Math.min(tMax, uInt.tMax, vInt.tMax);
  if (tMax < tMin) return null;
  return { tMin, tMax };
}

function slab1D(x0: number, dx: number, half: number): { tMin: number; tMax: number } | null {
  // -half <= x0 + dx*t <= half
  if (Math.abs(dx) <= 1e-12) {
    if (Math.abs(x0) > half) return null;
    return { tMin: -Number.POSITIVE_INFINITY, tMax: Number.POSITIVE_INFINITY };
  }
  const t0 = (-half - x0) / dx;
  const t1 = (half - x0) / dx;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}

function intersectCoplanarDiskRect(
  d: Disk,
  r: PlaneRect,
  useBezierFit: boolean,
  fitMode: "perRun" | "stitchThenFit",
): CubicBezier3[] {
  // Intersection = "circle (rim) ∩ rectangular patch" => sample the circle and connect only inside rect, then fit to cubic
  const n = Vec3.normalize(r.normal);
  const { u, v } = basisFromAxis(n);
  const N = 260;

  const pts: Vec3[] = [];
  const step = (2 * Math.PI * d.radius) / N;
  const maxJumpSq = (step * 10) * (step * 10);

  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const p = Vec3.add(d.center, Vec3.add(Vec3.mulScalar(u, d.radius * Math.cos(th)), Vec3.mulScalar(v, d.radius * Math.sin(th))));
    if (rectContains(r, p)) pts.push(p);
  }
  if (pts.length < 2) return [];

  const closeEpsSq = (step * 3) * (step * 3);
  const runs = stitchRunsByEndpoints(mergeCyclicRuns(splitRunsByJump(pts, maxJumpSq), closeEpsSq), closeEpsSq);
  if (!useBezierFit) return polylineRunsToLineCubics(runs, closeEpsSq);
  if (fitMode === "stitchThenFit") {
    const merged = tryMergeRunsToSinglePolyline(runs, closeEpsSq);
    if (merged) {
      const maxError = step * 0.6;
      return fitPolylineToCubics(merged, { maxError, closeEps: step * 3 });
    }
  }
  const maxError = step * 0.6;
  return runs.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }));
}

function rectContains(r: PlaneRect, p: Vec3): boolean {
  const d = Vec3.sub(p, r.center);
  const du = Vec3.dot(d, r.u);
  const dv = Vec3.dot(d, r.v);
  return Math.abs(du) <= r.halfWidth + 1e-7 && Math.abs(dv) <= r.halfHeight + 1e-7;
}


