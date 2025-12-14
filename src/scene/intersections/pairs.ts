import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { circleToCubics3 } from "../../curves/builders.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { PlaneRect } from "../primitives/planeRect.js";
import { assignBranches, basisFromAxis, solveQuadratic, splitRunsByJump } from "./math.js";
import { fitPolylineToCubics } from "./bezierFit.js";

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

export function intersectSphereCylinder(s: Sphere, c: Cylinder, samples: number): CubicBezier3[] {
  const n = Math.max(32, Math.floor(samples));
  const a = c.axis; // unit
  const { u, v } = basisFromAxis(a);
  const base = c.base;

  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const q = Vec3.add(Vec3.sub(base, s.center), Vec3.mulScalar(w, c.radius));
    const b = 2 * Vec3.dot(a, q);
    const cc = Vec3.dot(q, q) - s.radius * s.radius;
    const roots = solveQuadratic(1, b, cc).filter((h) => h >= 0 && h <= c.height);
    const pts = roots.map((h) => Vec3.add(Vec3.add(base, Vec3.mulScalar(a, h)), Vec3.mulScalar(w, c.radius)));
    assignBranches(branch0, branch1, pts);
  }

  const step = (2 * Math.PI * Math.max(1e-3, c.radius)) / n;
  const maxJumpSq = (step * 12) * (step * 12);
  const runs0 = splitRunsByJump(branch0, maxJumpSq);
  const runs1 = splitRunsByJump(branch1, maxJumpSq);
  const maxError = step * 0.55;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectSphereCone(s: Sphere, cone: Cone, samples: number): CubicBezier3[] {
  const n = Math.max(32, Math.floor(samples));
  const a = cone.axis; // unit, apex->base
  const k = cone.baseRadius / cone.height;
  const { u, v } = basisFromAxis(a);

  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];

  const d0 = Vec3.sub(cone.apex, s.center);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const ap = Vec3.add(a, Vec3.mulScalar(w, k));
    const A = 1 + k * k;
    const B = 2 * Vec3.dot(d0, ap);
    const C = Vec3.dot(d0, d0) - s.radius * s.radius;
    const roots = solveQuadratic(A, B, C).filter((y) => y >= 0 && y <= cone.height);
    const pts = roots.map((y) =>
      Vec3.add(Vec3.add(cone.apex, Vec3.mulScalar(a, y)), Vec3.mulScalar(w, k * y)),
    );
    assignBranches(branch0, branch1, pts);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cone.baseRadius)) / n;
  const maxJumpSq = (step * 12) * (step * 12);
  const runs0 = splitRunsByJump(branch0, maxJumpSq);
  const runs1 = splitRunsByJump(branch1, maxJumpSq);
  const maxError = step * 0.55;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectCylinderCylinder(c0: Cylinder, c1: Cylinder, samples: number): CubicBezier3[] {
  // Parameterize points on cylinder0 side surface: X(s,θ)=b0 + a0*s + r0*w(θ), s∈[0,h0]
  // Plug into cylinder1 side equation -> quadratic in s for each θ.
  const n = Math.max(48, Math.floor(samples));
  const a0 = c0.axis;
  const { u, v } = basisFromAxis(a0);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const y0 = Vec3.add(Vec3.sub(c0.base, c1.base), Vec3.mulScalar(w, c0.radius));

    const roots = solveQuadraticCylinderConstraint(y0, a0, c1).filter((s) => s >= 0 && s <= c0.height);
    const pts = roots.map((s) => pointOnCylinder(c0, w, s)).filter((p) => insideCylinderAxial(p, c1));
    assignBranches(branch0, branch1, pts);
  }

  const step = (2 * Math.PI * Math.max(1e-3, c0.radius, c1.radius)) / n;
  const maxJumpSq = (step * 14) * (step * 14);
  const runs0 = splitRunsByJump(branch0, maxJumpSq);
  const runs1 = splitRunsByJump(branch1, maxJumpSq);
  const maxError = step * 0.6;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectCylinderCone(cyl: Cylinder, cone: Cone, samples: number): CubicBezier3[] {
  // Parameterize points on cylinder side: X(s,θ)=b + a*s + r*w(θ)
  // Plug into cone implicit -> quadratic in s.
  const n = Math.max(48, Math.floor(samples));
  const a = cyl.axis;
  const { u, v } = basisFromAxis(a);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const x0 = Vec3.add(cyl.base, Vec3.mulScalar(w, cyl.radius));
    const roots = solveQuadraticConeConstraint(x0, a, cone).filter((s) => s >= 0 && s <= cyl.height);
    const pts = roots.map((s) => Vec3.add(x0, Vec3.mulScalar(a, s))).filter((p) => insideConeAxial(p, cone));
    assignBranches(branch0, branch1, pts);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cyl.radius, cone.baseRadius)) / n;
  const maxJumpSq = (step * 14) * (step * 14);
  const runs0 = splitRunsByJump(branch0, maxJumpSq);
  const runs1 = splitRunsByJump(branch1, maxJumpSq);
  const maxError = step * 0.6;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
  ];
}

export function intersectConeCone(cone0: Cone, cone1: Cone, samples: number): CubicBezier3[] {
  // Parameterize points on cone0 side: X(y,θ)=apex0 + y*(a0 + k0*w(θ)), y∈[0,h0]
  // Plug into cone1 implicit -> quadratic in y.
  const n = Math.max(64, Math.floor(samples));
  const a0 = cone0.axis;
  const k0 = cone0.baseRadius / cone0.height;
  const { u, v } = basisFromAxis(a0);
  const branch0: Vec3[] = [];
  const branch1: Vec3[] = [];

  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const w = Vec3.add(Vec3.mulScalar(u, Math.cos(th)), Vec3.mulScalar(v, Math.sin(th)));
    const d = Vec3.add(a0, Vec3.mulScalar(w, k0)); // direction per unit y
    const roots = solveQuadraticConeRayConstraint(cone0.apex, d, cone1).filter((y) => y >= 0 && y <= cone0.height);
    const pts = roots.map((y) => Vec3.add(cone0.apex, Vec3.mulScalar(d, y))).filter((p) => insideConeAxial(p, cone1));
    assignBranches(branch0, branch1, pts);
  }

  const step = (2 * Math.PI * Math.max(1e-3, cone0.baseRadius, cone1.baseRadius)) / n;
  const maxJumpSq = (step * 16) * (step * 16);
  const runs0 = splitRunsByJump(branch0, maxJumpSq);
  const runs1 = splitRunsByJump(branch1, maxJumpSq);
  const maxError = step * 0.65;
  return [
    ...runs0.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
    ...runs1.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 })),
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


