import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Vec3 } from "../../math/vec3.js";
import { PlaneRect } from "../primitives/planeRect.js";

export function intersectPlaneRectPlaneRect(p0: PlaneRect, p1: PlaneRect): CubicBezier3[] {
  // Two planes intersection line: dir = n0 × n1
  const n0 = p0.normal;
  const n1 = p1.normal;
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);
  if (dirLenSq <= 1e-12) return [];
  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq));

  // Plane equations: n·x = d
  const d0 = Vec3.dot(n0, p0.center);
  const d1 = Vec3.dot(n1, p1.center);

  // Point on line (formula): x0 = ((d0*n1 - d1*n0) × dir) / |dir|^2
  const a = Vec3.sub(Vec3.mulScalar(n1, d0), Vec3.mulScalar(n0, d1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);

  // clip by both rectangles: each gives constraints on t for
  // |dot(x(t)-c,u)|<=hw and |dot(x(t)-c,v)|<=hh
  const i0 = clipLineToRect(x0, dir, p0);
  if (!i0) return [];
  const i1 = clipLineToRect(x0, dir, p1);
  if (!i1) return [];
  const tMin = Math.max(i0.tMin, i1.tMin);
  const tMax = Math.min(i0.tMax, i1.tMax);
  if (tMax < tMin) return [];

  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}

function clipLineToRect(x0: Vec3, dir: Vec3, r: PlaneRect): { tMin: number; tMax: number } | null {
  let tMin = -Number.POSITIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;

  const c = r.center;
  const rel = Vec3.sub(x0, c);

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


