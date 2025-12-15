import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { circleToCubics3 } from "../../curves/builders.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { PlaneRect } from "../primitives/planeRect.js";
import {
  assignBranchesKeyed,
  basisFromAxis,
  medianConsecutiveStep,
  mergeCyclicRuns,
  polylineRunsToLineCubics,
  solveQuadratic,
  splitRunsByJump,
  stitchRunsByEndpoints,
  stitchRunsByEndpointsWithDirection,
  tryMergeRunsToSinglePolyline,
  type KeyedCandidate3,
} from "./math.js";
import { fitPolylineToCubics } from "./bezierFit.js";

function medianAbsDelta(keys: number[], fallback: number): number {
  if (keys.length < 2) return fallback;
  const ds: number[] = [];
  for (let i = 1; i < keys.length; i++) {
    const d = Math.abs(keys[i]! - keys[i - 1]!);
    if (Number.isFinite(d) && d > 1e-12) ds.push(d);
  }
  if (ds.length === 0) return fallback;
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length / 2)] ?? fallback;
}

function sliceKeysForRun(allPts: Vec3[], allKeys: number[], run: Vec3[]): number[] {
  // runs are slices from allPts in order; find the first matching index and slice by length.
  // (safe because runs are created by scanning allPts sequentially)
  if (run.length === 0) return [];
  let start = -1;
  for (let i = 0; i <= allPts.length - run.length; i++) {
    if (allPts[i] === run[0]) { start = i; break; }
  }
  if (start < 0) return [];
  return allKeys.slice(start, start + run.length);
}

function splitRunsByKeyJump(points: Vec3[], keys: number[], maxKeyJump: number): Vec3[][] {
  if (points.length < 2 || keys.length !== points.length) return points.length >= 2 ? [points] : [];
  const out: Vec3[][] = [];
  let cur: Vec3[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const dk = Math.abs(keys[i]! - keys[i - 1]!);
    if (dk > maxKeyJump) {
      if (cur.length >= 2) out.push(cur);
      cur = [points[i]!];
    } else {
      cur.push(points[i]!);
    }
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

function makeRunsForBranch(opts: {
  branch: Vec3[];
  keys: number[];
  maxJumpSq: number;
  keyJump: number;
  closeEpsSq: number;
}): Vec3[][] {
  const { branch, keys, maxJumpSq, keyJump, closeEpsSq } = opts;
  const baseRuns = splitRunsByJump(branch, maxJumpSq);
  const keyRuns = baseRuns.flatMap((r) => splitRunsByKeyJump(r, sliceKeysForRun(branch, keys, r), keyJump));
  // - mergeCyclicRuns: 0/2π seam 등으로 "처음/끝 run"이 자연스럽게 이어지는 경우를 붙인다
  // - stitchRunsByEndpointsWithDirection: 샘플/필터링 때문에 생긴 작은 갭을(방향 조건 포함) 메운다
  return stitchRunsByEndpointsWithDirection(mergeCyclicRuns(keyRuns, closeEpsSq), closeEpsSq, { minTangentCos: 0.25 });
}

export function intersectSphereSphere(s0: Sphere, s1: Sphere): CubicBezier3[] {
  const c0 = s0.center;
  const c1 = s1.center;
  const r0 = s0.radius;
  const r1 = s1.radius;
  const dVec = Vec3.sub(c1, c0);
  const d = Vec3.len(dVec);
  if (d <= 1e-9) return [];
  if (d > r0 + r1) return [];
  if (d < Math.abs(r0 - r1)) return [];

  const x = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - x * x;
  if (h2 < 0) return [];
  const n = Vec3.normalize(dVec);
  const center = Vec3.add(c0, Vec3.mulScalar(n, x));
  const r = Math.sqrt(Math.max(0, h2));
  return circleToCubics3({ center, normal: n, radius: r });
}

export function intersectSphereCylinder(
  s: Sphere,
  c: Cylinder,
  samples: number,
  useBezierFit = true,
  fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  const n = Math.max(32, Math.floor(samples));
  const a = c.axis; // unit
  const { u, v } = basisFromAxis(a);
  const base = c.base;

  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];
  const keys0: number[] = [];
  const keys1: number[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const q = Vec3.add(Vec3.sub(base, s.center), Vec3.mulScalar(w, c.radius));
    const b = 2 * Vec3.dot(a, q);
    const cc = Vec3.dot(q, q) - s.radius * s.radius;
    const roots = solveQuadratic(1, b, cc).filter((h) => h >= 0 && h <= c.height);
    const candidates: KeyedCandidate3[] = roots.map((h) => ({
      key: h,
      point: Vec3.add(Vec3.add(base, Vec3.mulScalar(a, h)), Vec3.mulScalar(w, c.radius)),
    }));
    assignBranchesKeyed(branch0, branch1, keys0, keys1, candidates);
  }

  const step = (2 * Math.PI * Math.max(1e-3, c.radius)) / n;
  const maxJumpSq = (step * 12) * (step * 12);
  const keyJump0 = Math.max(1e-6, medianAbsDelta(keys0, step) * 8);
  const keyJump1 = Math.max(1e-6, medianAbsDelta(keys1, step) * 8);
  const closeEpsSq = (step * 3) * (step * 3);
  const runs0 = makeRunsForBranch({ branch: branch0, keys: keys0, maxJumpSq, keyJump: keyJump0, closeEpsSq });
  const runs1 = makeRunsForBranch({ branch: branch1, keys: keys1, maxJumpSq, keyJump: keyJump1, closeEpsSq });
  if (!useBezierFit) return [...polylineRunsToLineCubics(runs0, closeEpsSq), ...polylineRunsToLineCubics(runs1, closeEpsSq)];
  if (fitMode === "stitchThenFit") {
    const m0 = tryMergeRunsToSinglePolyline(runs0, closeEpsSq);
    const m1 = tryMergeRunsToSinglePolyline(runs1, closeEpsSq);
    const maxError = step * 0.55;
    return [
      ...(m0 ? fitPolylineToCubics(m0, { maxError, closeEps: step * 3 }) : runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
      ...(m1 ? fitPolylineToCubics(m1, { maxError, closeEps: step * 3 }) : runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
    ];
  }
  const maxError = step * 0.55;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectSphereCone(
  s: Sphere,
  cone: Cone,
  samples: number,
  useBezierFit = true,
  fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  const n = Math.max(32, Math.floor(samples));
  const a = cone.axis; // unit, apex->base
  const k = cone.baseRadius / cone.height;
  const { u, v } = basisFromAxis(a);

  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];
  const keys0: number[] = [];
  const keys1: number[] = [];

  const d0 = Vec3.sub(cone.apex, s.center);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const ap = Vec3.add(a, Vec3.mulScalar(w, k));
    const A = 1 + k * k;
    const B = 2 * Vec3.dot(d0, ap);
    const C = Vec3.dot(d0, d0) - s.radius * s.radius;
    const roots = solveQuadratic(A, B, C).filter((y) => y >= 0 && y <= cone.height);
    const candidates: KeyedCandidate3[] = roots.map((y) => ({
      key: y,
      point: Vec3.add(Vec3.add(cone.apex, Vec3.mulScalar(a, y)), Vec3.mulScalar(w, k * y)),
    }));
    assignBranchesKeyed(branch0, branch1, keys0, keys1, candidates);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cone.baseRadius)) / n;
  const maxJumpSq = (step * 12) * (step * 12);
  const keyJump0 = Math.max(1e-6, medianAbsDelta(keys0, step) * 8);
  const keyJump1 = Math.max(1e-6, medianAbsDelta(keys1, step) * 8);
  const closeEpsSq = (step * 3) * (step * 3);
  const runs0 = makeRunsForBranch({ branch: branch0, keys: keys0, maxJumpSq, keyJump: keyJump0, closeEpsSq });
  const runs1 = makeRunsForBranch({ branch: branch1, keys: keys1, maxJumpSq, keyJump: keyJump1, closeEpsSq });
  if (!useBezierFit) return [...polylineRunsToLineCubics(runs0, closeEpsSq), ...polylineRunsToLineCubics(runs1, closeEpsSq)];
  if (fitMode === "stitchThenFit") {
    const m0 = tryMergeRunsToSinglePolyline(runs0, closeEpsSq);
    const m1 = tryMergeRunsToSinglePolyline(runs1, closeEpsSq);
    const maxError = step * 0.55;
    return [
      ...(m0 ? fitPolylineToCubics(m0, { maxError, closeEps: step * 3 }) : runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
      ...(m1 ? fitPolylineToCubics(m1, { maxError, closeEps: step * 3 }) : runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
    ];
  }
  const maxError = step * 0.55;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectCylinderCylinder(
  c0: Cylinder,
  c1: Cylinder,
  samples: number,
  useBezierFit = true,
  fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  // Parameterize points on cylinder0 side surface: X(s,θ)=b0 + a0*s + r0*w(θ), s∈[0,h0]
  // Plug into cylinder1 side equation -> quadratic in s for each θ.
  const n = Math.max(48, Math.floor(samples));
  const a0 = c0.axis;
  const { u, v } = basisFromAxis(a0);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];
  const keys0: number[] = [];
  const keys1: number[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const y0 = Vec3.add(Vec3.sub(c0.base, c1.base), Vec3.mulScalar(w, c0.radius));

    const roots = solveQuadraticCylinderConstraint(y0, a0, c1).filter((s) => s >= 0 && s <= c0.height);
    const candidates: KeyedCandidate3[] = roots
      .map((sVal) => ({ key: sVal, point: pointOnCylinder(c0, w, sVal) }))
      .filter((cnd) => insideCylinderAxial(cnd.point, c1));
    assignBranchesKeyed(branch0, branch1, keys0, keys1, candidates);
  }

  const step = (2 * Math.PI * Math.max(1e-3, c0.radius, c1.radius)) / n;
  const maxJumpSq = (step * 14) * (step * 14);
  const keyJump0 = Math.max(1e-6, medianAbsDelta(keys0, step) * 8);
  const keyJump1 = Math.max(1e-6, medianAbsDelta(keys1, step) * 8);
  const closeEpsSq = (step * 3) * (step * 3);
  const runs0 = makeRunsForBranch({ branch: branch0, keys: keys0, maxJumpSq, keyJump: keyJump0, closeEpsSq });
  const runs1 = makeRunsForBranch({ branch: branch1, keys: keys1, maxJumpSq, keyJump: keyJump1, closeEpsSq });
  if (!useBezierFit) return [...polylineRunsToLineCubics(runs0, closeEpsSq), ...polylineRunsToLineCubics(runs1, closeEpsSq)];
  if (fitMode === "stitchThenFit") {
    const m0 = tryMergeRunsToSinglePolyline(runs0, closeEpsSq);
    const m1 = tryMergeRunsToSinglePolyline(runs1, closeEpsSq);
    const maxError = step * 0.6;
    return [
      ...(m0 ? fitPolylineToCubics(m0, { maxError, closeEps: step * 3 }) : runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
      ...(m1 ? fitPolylineToCubics(m1, { maxError, closeEps: step * 3 }) : runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
    ];
  }
  const maxError = step * 0.6;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectCylinderCone(
  cyl: Cylinder,
  cone: Cone,
  samples: number,
  useBezierFit = true,
  fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  // Parameterize points on cylinder side: X(s,θ)=b + a*s + r*w(θ)
  // Plug into cone implicit -> quadratic in s.
  const n = Math.max(48, Math.floor(samples));
  const a = cyl.axis;
  const { u, v } = basisFromAxis(a);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];
  const keys0: number[] = [];
  const keys1: number[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const x0 = Vec3.add(cyl.base, Vec3.mulScalar(w, cyl.radius));
    const roots = solveQuadraticConeConstraint(x0, a, cone).filter((s) => s >= 0 && s <= cyl.height);
    const candidates: KeyedCandidate3[] = roots
      .map((sVal) => ({ key: sVal, point: Vec3.add(x0, Vec3.mulScalar(a, sVal)) }))
      .filter((cnd) => insideConeAxial(cnd.point, cone));
    assignBranchesKeyed(branch0, branch1, keys0, keys1, candidates);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cyl.radius, cone.baseRadius)) / n;
  const maxJumpSq = (step * 14) * (step * 14);
  const keyJump0 = Math.max(1e-6, medianAbsDelta(keys0, step) * 8);
  const keyJump1 = Math.max(1e-6, medianAbsDelta(keys1, step) * 8);
  const closeEpsSq = (step * 3) * (step * 3);
  const runs0 = makeRunsForBranch({ branch: branch0, keys: keys0, maxJumpSq, keyJump: keyJump0, closeEpsSq });
  const runs1 = makeRunsForBranch({ branch: branch1, keys: keys1, maxJumpSq, keyJump: keyJump1, closeEpsSq });
  if (!useBezierFit) return [...polylineRunsToLineCubics(runs0, closeEpsSq), ...polylineRunsToLineCubics(runs1, closeEpsSq)];
  if (fitMode === "stitchThenFit") {
    const m0 = tryMergeRunsToSinglePolyline(runs0, closeEpsSq);
    const m1 = tryMergeRunsToSinglePolyline(runs1, closeEpsSq);
    const maxError = step * 0.6;
    return [
      ...(m0 ? fitPolylineToCubics(m0, { maxError, closeEps: step * 3 }) : runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
      ...(m1 ? fitPolylineToCubics(m1, { maxError, closeEps: step * 3 }) : runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }))),
    ];
  }
  const maxError = step * 0.6;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectConeCone(
  cone0: Cone,
  cone1: Cone,
  samples: number,
  useBezierFit = true,
  fitMode: "perRun" | "stitchThenFit" = "stitchThenFit",
): CubicBezier3[] {
  // Parameterize points on cone0 side: X(y,θ)=apex0 + y*(a0 + k0*w(θ)), y∈[0,h0]
  // Plug into cone1 implicit -> quadratic in y.
  const n = Math.max(64, Math.floor(samples));
  const a0 = cone0.axis;
  const k0 = cone0.baseRadius / cone0.height;
  const { u, v } = basisFromAxis(a0);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];
  const keys0: number[] = [];
  const keys1: number[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const d = Vec3.add(a0, Vec3.mulScalar(w, k0)); // direction per unit y
    const roots = solveQuadraticConeRayConstraint(cone0.apex, d, cone1).filter((y) => y >= 0 && y <= cone0.height);
    const candidates: KeyedCandidate3[] = roots
      .map((yVal) => ({ key: yVal, point: Vec3.add(cone0.apex, Vec3.mulScalar(d, yVal)) }))
      .filter((cnd) => insideConeAxial(cnd.point, cone1));
    assignBranchesKeyed(branch0, branch1, keys0, keys1, candidates);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cone0.baseRadius, cone1.baseRadius)) / n;
  // Cone×Cone can have sharp branch births/deaths; use adaptive threshold to avoid
  // incorrectly connecting disjoint parts (which later looks like "tangled loops").
  const est0 = medianConsecutiveStep(branch0, step);
  const est1 = medianConsecutiveStep(branch1, step);
  const maxJump = Math.max(step * 6, Math.max(est0, est1) * 4);
  const maxJumpSq = maxJump * maxJump;
  const closeEpsSq = (step * 3) * (step * 3);
  const keyJump0 = Math.max(1e-6, medianAbsDelta(keys0, step) * 8);
  const keyJump1 = Math.max(1e-6, medianAbsDelta(keys1, step) * 8);
  const baseRuns0 = splitRunsByJump(branch0, maxJumpSq);
  const baseRuns1 = splitRunsByJump(branch1, maxJumpSq);
  const runs0 = stitchRunsByEndpointsWithDirection(
    mergeCyclicRuns(baseRuns0.flatMap((r) => splitRunsByKeyJump(r, sliceKeysForRun(branch0, keys0, r), keyJump0)), closeEpsSq),
    closeEpsSq,
    { minTangentCos: 0.25 },
  );
  const runs1 = stitchRunsByEndpointsWithDirection(
    mergeCyclicRuns(baseRuns1.flatMap((r) => splitRunsByKeyJump(r, sliceKeysForRun(branch1, keys1, r), keyJump1)), closeEpsSq),
    closeEpsSq,
    { minTangentCos: 0.25 },
  );
  if (!useBezierFit) return [...polylineRunsToLineCubics(runs0, closeEpsSq), ...polylineRunsToLineCubics(runs1, closeEpsSq)];
  if (fitMode === "stitchThenFit") {
    const m0 = tryMergeRunsToSinglePolyline(runs0, closeEpsSq);
    const m1 = tryMergeRunsToSinglePolyline(runs1, closeEpsSq);
    const maxError = step * 0.65;
    return [
      ...(m0 ? fitPolylineToCubics(m0, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 }) : runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 }))),
      ...(m1 ? fitPolylineToCubics(m1, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 }) : runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 }))),
    ];
  }
  const maxError = step * 0.65;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3, maxAlphaFactor: 1.2 })),
  ];
}

function pointOnCylinder(c: Cylinder, wUnit: Vec3, s: number): Vec3 {
  return Vec3.add(Vec3.add(c.base, Vec3.mulScalar(c.axis, s)), Vec3.mulScalar(wUnit, c.radius));
}

function insideCylinderAxial(p: Vec3, c: Cylinder): boolean {
  const y = Vec3.dot(Vec3.sub(p, c.base), c.axis);
  return y >= -1e-6 && y <= c.height + 1e-6;
}

function insideConeAxial(p: Vec3, c: Cone): boolean {
  const y = Vec3.dot(Vec3.sub(p, c.apex), c.axis);
  return y >= -1e-6 && y <= c.height + 1e-6;
}

function solveQuadraticCylinderConstraint(y0: Vec3, d: Vec3, c: Cylinder): number[] {
  // y(s) = y0 + d*s (relative to cylinder base)
  // enforce |y⊥|^2 = r^2 where y⊥ = y - a*(y·a), with a=c.axis
  const a = c.axis;
  const t0 = Vec3.dot(y0, a);
  const t1 = Vec3.dot(d, a);
  const p0 = Vec3.sub(y0, Vec3.mulScalar(a, t0));
  const p1 = Vec3.sub(d, Vec3.mulScalar(a, t1));
  const A = Vec3.dot(p1, p1);
  const B = 2 * Vec3.dot(p0, p1);
  const C = Vec3.dot(p0, p0) - c.radius * c.radius;
  return solveQuadratic(A, B, C);
}

function solveQuadraticConeConstraint(x0: Vec3, d: Vec3, cone: Cone): number[] {
  // x(s)=x0 + d*s
  // z = x - apex, y = z·a, z⊥ = z - a*y, enforce |z⊥|^2 = (k*y)^2
  const a = cone.axis;
  const k = cone.baseRadius / cone.height;
  const z0 = Vec3.sub(x0, cone.apex);
  const y0 = Vec3.dot(z0, a);
  const y1 = Vec3.dot(d, a);
  const p0 = Vec3.sub(z0, Vec3.mulScalar(a, y0));
  const p1 = Vec3.sub(d, Vec3.mulScalar(a, y1));
  const A = Vec3.dot(p1, p1) - (k * k) * (y1 * y1);
  const B = 2 * Vec3.dot(p0, p1) - 2 * (k * k) * (y0 * y1);
  const C = Vec3.dot(p0, p0) - (k * k) * (y0 * y0);
  return solveQuadratic(A, B, C);
}

function solveQuadraticConeRayConstraint(origin: Vec3, d: Vec3, cone: Cone): number[] {
  // x(t)=origin + d*t
  // same as solveQuadraticConeConstraint with x0=origin, direction=d, but variable name differs
  return solveQuadraticConeConstraint(origin, d, cone);
}


