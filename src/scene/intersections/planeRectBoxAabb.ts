import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Vec3 } from "../../math/vec3.js";
import { BoxAabb } from "../primitives/boxAabb.js";
import { PlaneRect } from "../primitives/planeRect.js";

export function intersectPlaneRectBoxAabb(r: PlaneRect, b: BoxAabb): CubicBezier3[] {
  const n = Vec3.normalize(r.normal);
  const c = r.center;

  const verts = boxVerts(b);
  const edges = boxEdges(verts);

  const pts: Vec3[] = [];
  const coplanarSegs: Array<[Vec3, Vec3]> = [];

  for (const [a, bb] of edges) {
    const da = Vec3.dot(n, Vec3.sub(a, c));
    const db = Vec3.dot(n, Vec3.sub(bb, c));
    const ada = Math.abs(da);
    const adb = Math.abs(db);

    if (ada <= 1e-9 && adb <= 1e-9) {
      coplanarSegs.push([a, bb]);
      continue;
    }
    if (da * db > 0) continue;

    const t = da / (da - db); // in [0,1] if segment crosses plane
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const p = Vec3.lerp(a, bb, clamp01(t));
    pts.push(p);
  }

  const out: CubicBezier3[] = [];
  for (const [a, bb] of coplanarSegs) {
    const clipped = clipSegmentToRectUV(a, bb, r);
    if (clipped) out.push(lineToCubic3(clipped.a, clipped.b));
  }

  const poly = uniquePointsOnPlane(pts, r);
  if (poly.length < 2) return out;

  const ordered = poly.length >= 3 ? orderPolygonOnRectPlane(poly, r) : poly;
  const pairs = ordered.length === 2 ? [[ordered[0]!, ordered[1]!]] : cyclicPairs(ordered);
  for (const [a, bb] of pairs) {
    const clipped = clipSegmentToRectUV(a, bb, r);
    if (!clipped) continue;
    out.push(lineToCubic3(clipped.a, clipped.b));
  }

  return out;
}

function boxVerts(b: BoxAabb): Vec3[] {
  const x0 = b.min.x, y0 = b.min.y, z0 = b.min.z;
  const x1 = b.max.x, y1 = b.max.y, z1 = b.max.z;
  return [
    new Vec3(x0, y0, z0), new Vec3(x1, y0, z0), new Vec3(x0, y1, z0), new Vec3(x1, y1, z0),
    new Vec3(x0, y0, z1), new Vec3(x1, y0, z1), new Vec3(x0, y1, z1), new Vec3(x1, y1, z1),
  ];
}

function boxEdges(v: Vec3[]): Array<[Vec3, Vec3]> {
  const [v000, v100, v010, v110, v001, v101, v011, v111] = v;
  return [
    [v000, v100], [v010, v110], [v001, v101], [v011, v111],
    [v000, v010], [v100, v110], [v001, v011], [v101, v111],
    [v000, v001], [v100, v101], [v010, v011], [v110, v111],
  ];
}

function uniquePointsOnPlane(points: Vec3[], r: PlaneRect): Vec3[] {
  // dedupe in (u,v) plane coords
  const uv = points.map((p) => {
    const d = Vec3.sub(p, r.center);
    return { p, u: Vec3.dot(d, r.u), v: Vec3.dot(d, r.v) };
  });
  const out: Vec3[] = [];
  for (const x of uv) {
    let ok = true;
    for (const y of out) {
      const d = Vec3.sub(y, x.p);
      const du = Vec3.dot(d, r.u);
      const dv = Vec3.dot(d, r.v);
      if (du * du + dv * dv <= 1e-12) { ok = false; break; }
    }
    if (ok) out.push(x.p);
  }
  return out;
}

function orderPolygonOnRectPlane(points: Vec3[], r: PlaneRect): Vec3[] {
  const uv = points.map((p) => {
    const d = Vec3.sub(p, r.center);
    return { p, u: Vec3.dot(d, r.u), v: Vec3.dot(d, r.v) };
  });
  const cu = uv.reduce((s, x) => s + x.u, 0) / uv.length;
  const cv = uv.reduce((s, x) => s + x.v, 0) / uv.length;
  uv.sort((a, b) => Math.atan2(a.v - cv, a.u - cu) - Math.atan2(b.v - cv, b.u - cu));
  return uv.map((x) => x.p);
}

function cyclicPairs(points: Vec3[]): Array<[Vec3, Vec3]> {
  const out: Array<[Vec3, Vec3]> = [];
  for (let i = 0; i < points.length; i++) {
    out.push([points[i]!, points[(i + 1) % points.length]!]);
  }
  return out;
}

function clipSegmentToRectUV(a: Vec3, b: Vec3, r: PlaneRect): { a: Vec3; b: Vec3 } | null {
  const da = Vec3.sub(a, r.center);
  const db = Vec3.sub(b, r.center);

  const u0 = Vec3.dot(da, r.u);
  const v0 = Vec3.dot(da, r.v);
  const u1 = Vec3.dot(db, r.u);
  const v1 = Vec3.dot(db, r.v);

  let tMin = 0;
  let tMax = 1;

  const uInt = slabSeg1D(u0, u1 - u0, r.halfWidth);
  if (!uInt) return null;
  tMin = Math.max(tMin, uInt.tMin);
  tMax = Math.min(tMax, uInt.tMax);
  if (tMax < tMin) return null;

  const vInt = slabSeg1D(v0, v1 - v0, r.halfHeight);
  if (!vInt) return null;
  tMin = Math.max(tMin, vInt.tMin);
  tMax = Math.min(tMax, vInt.tMax);
  if (tMax < tMin) return null;

  const A = Vec3.lerp(a, b, tMin);
  const B = Vec3.lerp(a, b, tMax);
  return { a: A, b: B };
}

function slabSeg1D(x0: number, dx: number, half: number): { tMin: number; tMax: number } | null {
  // segment param t in [0,1], with constraint -half <= x0 + dx*t <= half
  if (Math.abs(dx) <= 1e-12) {
    if (Math.abs(x0) > half) return null;
    return { tMin: 0, tMax: 1 };
  }
  const t0 = (-half - x0) / dx;
  const t1 = (half - x0) / dx;
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  return { tMin: Math.max(0, lo), tMax: Math.min(1, hi) };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}


