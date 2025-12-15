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

export type KeyedCandidate3 = { key: number; point: Vec3 };

/**
 * More stable branch assignment for "two-solution" intersection sampling.
 *
 * Why needed:
 * - The older distance-only assignment can "flip" labels when the two branches get close,
 *   producing zig-zag polylines -> splitRunsByJump -> broken + tangled fitted cubics.
 *
 * Strategy:
 * - When we have two candidates, choose the assignment that best matches the *previous scalar keys*.
 *   (keys are typically height/axial parameter roots returned by quadratic solving)
 * - When we have one candidate, continue the branch whose last key is closer.
 */
export function assignBranchesKeyed(
  branch0: Vec3[],
  branch1: Vec3[],
  keys0: number[],
  keys1: number[],
  candidates: readonly KeyedCandidate3[],
): void {
  if (candidates.length === 0) return;

  if (candidates.length === 1) {
    const c = candidates[0]!;
    // Prefer continuing an existing branch. If both exist, choose by key proximity.
    if (keys0.length === 0 && keys1.length === 0) {
      branch0.push(c.point);
      keys0.push(c.key);
      return;
    }
    if (keys0.length === 0) {
      branch1.push(c.point);
      keys1.push(c.key);
      return;
    }
    if (keys1.length === 0) {
      branch0.push(c.point);
      keys0.push(c.key);
      return;
    }
    const d0 = Math.abs(keys0[keys0.length - 1]! - c.key);
    const d1 = Math.abs(keys1[keys1.length - 1]! - c.key);
    if (d0 <= d1) {
      branch0.push(c.point);
      keys0.push(c.key);
    } else {
      branch1.push(c.point);
      keys1.push(c.key);
    }
    return;
  }

  // Keep only the 2 best candidates by key order (expected for quadratic roots).
  const sorted = [...candidates].sort((a, b) => a.key - b.key);
  const a = sorted[0]!;
  const b = sorted[1]!;

  // If no history, establish the convention: lower key -> branch0, higher -> branch1.
  if (keys0.length === 0 && keys1.length === 0) {
    branch0.push(a.point); keys0.push(a.key);
    branch1.push(b.point); keys1.push(b.key);
    return;
  }

  // If only one branch has history, continue it by key proximity and start the other.
  if (keys0.length === 0 && keys1.length > 0) {
    const k1 = keys1[keys1.length - 1]!;
    const da = Math.abs(k1 - a.key);
    const db = Math.abs(k1 - b.key);
    if (da <= db) {
      branch1.push(a.point); keys1.push(a.key);
      branch0.push(b.point); keys0.push(b.key);
    } else {
      branch1.push(b.point); keys1.push(b.key);
      branch0.push(a.point); keys0.push(a.key);
    }
    return;
  }
  if (keys1.length === 0 && keys0.length > 0) {
    const k0 = keys0[keys0.length - 1]!;
    const da = Math.abs(k0 - a.key);
    const db = Math.abs(k0 - b.key);
    if (da <= db) {
      branch0.push(a.point); keys0.push(a.key);
      branch1.push(b.point); keys1.push(b.key);
    } else {
      branch0.push(b.point); keys0.push(b.key);
      branch1.push(a.point); keys1.push(a.key);
    }
    return;
  }

  // Both have history: choose assignment that minimizes total key drift.
  const k0Prev = keys0[keys0.length - 1]!;
  const k1Prev = keys1[keys1.length - 1]!;
  const cost0 = Math.abs(k0Prev - a.key) + Math.abs(k1Prev - b.key);
  const cost1 = Math.abs(k0Prev - b.key) + Math.abs(k1Prev - a.key);
  if (cost0 <= cost1) {
    branch0.push(a.point); keys0.push(a.key);
    branch1.push(b.point); keys1.push(b.key);
  } else {
    branch0.push(b.point); keys0.push(b.key);
    branch1.push(a.point); keys1.push(a.key);
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

export function mergeCyclicRuns(runs: Vec3[][], closeEpsSq: number): Vec3[][] {
  if (runs.length < 2) return runs;
  const first = runs[0]!;
  const last = runs[runs.length - 1]!;
  if (first.length === 0 || last.length === 0) return runs;
  const a = first[0]!;
  const b = last[last.length - 1]!;
  // If the curve crosses the 0/2π seam, the first and last runs should be connected.
  if (Vec3.distanceSq(a, b) <= closeEpsSq) {
    const merged = [...last, ...first];
    return [merged, ...runs.slice(1, -1)];
  }
  return runs;
}

export function stitchRunsByEndpoints(runsIn: Vec3[][], closeEpsSq: number): Vec3[][] {
  // Greedily stitch runs whose endpoints are within closeEpsSq.
  // This helps when sampling/filters introduce small gaps that shouldn't break the curve.
  return stitchRunsByEndpointsWithDirection(runsIn, closeEpsSq);
}

export function stitchRunsByEndpointsWithDirection(
  runsIn: Vec3[][],
  closeEpsSq: number,
  opts?: { minTangentCos?: number },
): Vec3[][] {
  // If minTangentCos is set, only stitch when endpoint tangents are roughly aligned.
  const minTangentCos = opts?.minTangentCos ?? -1;
  let runs = runsIn.filter((r) => r.length >= 2).map((r) => r.slice());
  if (runs.length < 2) return runs;

  const distSq = (a: Vec3, b: Vec3) => Vec3.distanceSq(a, b);
  const head = (r: Vec3[]) => r[0]!;
  const tail = (r: Vec3[]) => r[r.length - 1]!;

  const unit = (v: Vec3) => {
    const l2 = Vec3.lenSq(v);
    return l2 > 1e-18 ? Vec3.mulScalar(v, 1 / Math.sqrt(l2)) : v;
  };

  const headTan = (r: Vec3[]) => unit(Vec3.sub(r[1]!, r[0]!));
  const tailTan = (r: Vec3[]) => unit(Vec3.sub(r[r.length - 1]!, r[r.length - 2]!));

  const okDir = (ta: Vec3, tb: Vec3) => {
    if (minTangentCos <= -0.999) return true;
    return Vec3.dot(ta, tb) >= minTangentCos;
  };

  while (true) {
    let bestI = -1;
    let bestJ = -1;
    let bestMode: "tail-head" | "tail-tail" | "head-head" | "head-tail" = "tail-head";
    let bestD = closeEpsSq;

    for (let i = 0; i < runs.length; i++) {
      for (let j = 0; j < runs.length; j++) {
        if (i === j) continue;
        const ri = runs[i]!;
        const rj = runs[j]!;

        const dTH = distSq(tail(ri), head(rj));
        if (dTH <= bestD && okDir(tailTan(ri), headTan(rj))) { bestD = dTH; bestI = i; bestJ = j; bestMode = "tail-head"; }

        const dTT = distSq(tail(ri), tail(rj));
        // tail-tail implies reversing rj, so compare tailTan(ri) with -tailTan(rj)
        if (dTT <= bestD && okDir(tailTan(ri), Vec3.mulScalar(tailTan(rj), -1))) { bestD = dTT; bestI = i; bestJ = j; bestMode = "tail-tail"; }

        const dHH = distSq(head(ri), head(rj));
        // head-head implies reversing ri, so compare -headTan(ri) with headTan(rj)
        if (dHH <= bestD && okDir(Vec3.mulScalar(headTan(ri), -1), headTan(rj))) { bestD = dHH; bestI = i; bestJ = j; bestMode = "head-head"; }

        const dHT = distSq(head(ri), tail(rj));
        // head-tail implies prepending rj to ri, so compare tailTan(rj) with headTan(ri)
        if (dHT <= bestD && okDir(tailTan(rj), headTan(ri))) { bestD = dHT; bestI = i; bestJ = j; bestMode = "head-tail"; }
      }
    }

    if (bestI < 0 || bestJ < 0) break;

    const a = runs[bestI]!;
    const b = runs[bestJ]!;
    let merged: Vec3[];
    if (bestMode === "tail-head") merged = [...a, ...b];
    else if (bestMode === "tail-tail") merged = [...a, ...b.slice().reverse()];
    else if (bestMode === "head-head") merged = [...a.slice().reverse(), ...b];
    else merged = [...b, ...a]; // head-tail => b tail connects to a head

    // Remove the two runs and push merged
    const next: Vec3[][] = [];
    for (let k = 0; k < runs.length; k++) if (k !== bestI && k !== bestJ) next.push(runs[k]!);
    next.push(merged);
    runs = next;
    if (runs.length < 2) break;
  }

  return runs;
}

export function tryMergeRunsToSinglePolyline(runs: Vec3[][], closeEpsSq: number): Vec3[] | null {
  const stitched = stitchRunsByEndpointsWithDirection(runs, closeEpsSq, { minTangentCos: 0.25 });
  if (stitched.length !== 1) return null;
  const only = stitched[0]!;
  return only.length >= 2 ? only : null;
}

export function medianConsecutiveStep(points: Vec3[], fallback: number): number {
  if (points.length < 2) return fallback;
  const ds: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = Math.sqrt(Vec3.distanceSq(a, b));
    if (Number.isFinite(d) && d > 1e-12) ds.push(d);
  }
  if (ds.length === 0) return fallback;
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length / 2)] ?? fallback;
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


