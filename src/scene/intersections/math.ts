import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";

export function basisFromAxis(axisUnit: Vec3): { u: Vec3; v: Vec3 } {
  // axisUnit is normal; return any orthonormal basis (u,v) in plane ⟂ axis.
  const helper = Math.abs(axisUnit.z) < 0.9 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
  const u = Vec3.normalize(Vec3.cross(helper, axisUnit));
  const v = Vec3.normalize(Vec3.cross(axisUnit, u));
  return { u, v };
}

export function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= 1e-12) {
    if (Math.abs(b) <= 1e-12) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  // more stable roots (avoid catastrophic cancellation)
  const q = -0.5 * (b + Math.sign(b || 1) * s);
  const r0 = q / a;
  const r1 = c / q;
  const roots = [r0, r1].filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  const out: number[] = [];
  for (const x of roots) {
    if (out.length === 0 || Math.abs(x - out[out.length - 1]!) > 1e-6) out.push(x);
  }
  return out;
}

export function assignBranches(branch0: Vec3[], branch1: Vec3[], candidates: Vec3[]): void {
  if (candidates.length === 0) return;
  if (candidates.length === 1) {
    const p = candidates[0]!;
    const d0 = branch0.length ? Vec3.distanceSq(branch0[branch0.length - 1]!, p) : Number.POSITIVE_INFINITY;
    const d1 = branch1.length ? Vec3.distanceSq(branch1[branch1.length - 1]!, p) : Number.POSITIVE_INFINITY;
    (d0 <= d1 ? branch0 : branch1).push(p);
    return;
  }

  const pA = candidates[0]!;
  const pB = candidates[1]!;
  if (branch0.length === 0 && branch1.length === 0) {
    branch0.push(pA);
    branch1.push(pB);
    return;
  }
  const b0Prev = branch0.length ? branch0[branch0.length - 1]! : null;
  const b1Prev = branch1.length ? branch1[branch1.length - 1]! : null;
  if (!b0Prev) {
    branch1.push(pA);
    branch0.push(pB);
    return;
  }
  if (!b1Prev) {
    branch0.push(pA);
    branch1.push(pB);
    return;
  }

  const cost0 = Vec3.distanceSq(b0Prev, pA) + Vec3.distanceSq(b1Prev, pB);
  const cost1 = Vec3.distanceSq(b0Prev, pB) + Vec3.distanceSq(b1Prev, pA);
  if (cost0 <= cost1) {
    branch0.push(pA);
    branch1.push(pB);
  } else {
    branch0.push(pB);
    branch1.push(pA);
  }
}

export function splitRunsByJump(points: Vec3[], maxJumpSq: number): Vec3[][] {
  if (points.length === 0) return [];
  const runs: Vec3[][] = [];
  let cur: Vec3[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const prev = cur[cur.length - 1]!;
    if (Vec3.distanceSq(prev, p) > maxJumpSq) {
      if (cur.length >= 2) runs.push(cur);
      cur = [p];
    } else {
      cur.push(p);
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

export function polylineRunsToLineCubics(runs: Vec3[][], closeEpsSq: number): CubicBezier3[] {
  const out: CubicBezier3[] = [];
  for (const pts of runs) {
    for (let i = 0; i < pts.length - 1; i++) out.push(lineToCubic3(pts[i]!, pts[i + 1]!));
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (Vec3.distanceSq(a, b) <= closeEpsSq) out.push(lineToCubic3(b, a));
  }
  return out;
}


