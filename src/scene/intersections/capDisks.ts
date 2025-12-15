import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import type { Primitive } from "../primitive.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { Disk } from "../primitives/disk.js";
import { basisFromAxis } from "./math.js";

export function derivedCapDisks(primitives: readonly Primitive[]): Disk[] {
  const out: Disk[] = [];
  for (const p of primitives) {
    if (p instanceof Cylinder) {
      const base = new Disk(`${p.id}:cap:base`, p.base, p.axis, p.radius);
      const topC = Vec3.add(p.base, Vec3.mulScalar(p.axis, p.height));
      const top = new Disk(`${p.id}:cap:top`, topC, p.axis, p.radius);
      out.push(base, top);
      continue;
    }
    if (p instanceof Cone) {
      const baseC = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(new Disk(`${p.id}:cap:base`, baseC, p.axis, p.baseRadius));
      continue;
    }
  }
  return out;
}

export function intersectDiskDisk(d0: Disk, d1: Disk): CubicBezier3[] {
  const n0 = d0.normal;
  const n1 = d1.normal;
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);
  if (dirLenSq <= 1e-12) {
    // parallel (including coplanar)
    const planeDist = Math.abs(Vec3.dot(n0, Vec3.sub(d1.center, d0.center)));
    if (planeDist > 1e-6) return []; // Different planes -> no intersection/intersection points
    return intersectCoplanarDisksAsCircleCircle(d0, d1);
  }

  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq));
  const dEq0 = Vec3.dot(n0, d0.center);
  const dEq1 = Vec3.dot(n1, d1.center);
  const a = Vec3.sub(Vec3.mulScalar(n1, dEq0), Vec3.mulScalar(n0, dEq1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);

  const i0 = clipLineToDisk(x0, dir, d0);
  if (!i0) return [];
  const i1 = clipLineToDisk(x0, dir, d1);
  if (!i1) return [];
  const tMin = Math.max(i0.tMin, i1.tMin);
  const tMax = Math.min(i0.tMax, i1.tMax);
  if (tMax < tMin) return [];

  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}

function clipLineToDisk(x0: Vec3, dir: Vec3, d: Disk): { tMin: number; tMax: number } | null {
  // |(x0 + dir*t - c)|^2 <= r^2  (dir is unit => A=1)
  const m = Vec3.sub(x0, d.center);
  const b = 2 * Vec3.dot(m, dir);
  const c = Vec3.dot(m, m) - d.radius * d.radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / 2;
  const t1 = (-b + s) / 2;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}

function intersectCoplanarDisksAsCircleCircle(d0: Disk, d1: Disk): CubicBezier3[] {
  // Find intersection points (0/1/2) of two circles (rims) on the same plane and output as "markers (short cross segments)".
  // Create 2 short line segments with lineToCubic3 to output everything as cubic(C).
  const n = Vec3.normalize(d0.normal);
  const { u, v } = basisFromAxis(n);

  const c0 = d0.center;
  const c1 = d1.center;
  const r0 = d0.radius;
  const r1 = d1.radius;

  const dc = Vec3.sub(c1, c0);
  const x = Vec3.dot(dc, u);
  const y = Vec3.dot(dc, v);
  const dist = Math.hypot(x, y);

  // coincident circles -> infinite intersections: cannot create markers here, so skip
  if (dist <= 1e-9 && Math.abs(r0 - r1) <= 1e-9) return [];
  if (dist > r0 + r1 + 1e-7) return [];
  if (dist < Math.abs(r0 - r1) - 1e-7) return [];
  if (dist <= 1e-9) return [];

  const a = (r0 * r0 - r1 * r1 + dist * dist) / (2 * dist);
  const h2 = r0 * r0 - a * a;
  const ex = x / dist;
  const ey = y / dist;

  const px = a * ex;
  const py = a * ey;

  const base = Vec3.add(c0, Vec3.add(Vec3.mulScalar(u, px), Vec3.mulScalar(v, py)));
  const markerSize = 0.03 * Math.max(0.1, Math.min(r0, r1)); // Not too small according to scene scale

  if (Math.abs(h2) <= 1e-8) {
    // tangent: 1 point
    return markerAt(base, u, v, markerSize);
  }

  const h = Math.sqrt(Math.max(0, h2));
  const ox = -ey * h;
  const oy = ex * h;
  const pA = Vec3.add(base, Vec3.add(Vec3.mulScalar(u, ox), Vec3.mulScalar(v, oy)));
  const pB = Vec3.sub(base, Vec3.add(Vec3.mulScalar(u, ox), Vec3.mulScalar(v, oy)));
  return [...markerAt(pA, u, v, markerSize), ...markerAt(pB, u, v, markerSize)];
}

function markerAt(p: Vec3, u: Vec3, v: Vec3, s: number): CubicBezier3[] {
  // cross marker: (p±u*s) and (p±v*s)
  const a0 = Vec3.sub(p, Vec3.mulScalar(u, s));
  const a1 = Vec3.add(p, Vec3.mulScalar(u, s));
  const b0 = Vec3.sub(p, Vec3.mulScalar(v, s));
  const b1 = Vec3.add(p, Vec3.mulScalar(v, s));
  return [lineToCubic3(a0, a1), lineToCubic3(b0, b1)];
}


