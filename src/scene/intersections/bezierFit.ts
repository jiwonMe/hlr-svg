import { Vec3 } from "../../math/vec3.js";
import type { CubicBezier3 } from "../../curves/cubicBezier3.js";

export type BezierFitParams = {
  maxError: number; // world-space distance tolerance
  maxDepth: number; // recursion depth safety
  reparamIters: number; // Newton reparameterization iterations (0~5)
  minAlpha: number; // minimum handle length
  closeEps: number; // if end is close to start, close it
  maxAlphaFactor: number; // clamp handle length: alpha <= maxAlphaFactor * |p3-p0|
};

export const defaultBezierFitParams: BezierFitParams = {
  maxError: 0.02,
  maxDepth: 18,
  reparamIters: 3,
  minAlpha: 1e-4,
  closeEps: 1e-3,
  maxAlphaFactor: 2.0,
};

export function fitPolylineToCubics(pointsIn: Vec3[], params: Partial<BezierFitParams> = {}): CubicBezier3[] {
  const p = { ...defaultBezierFitParams, ...params };
  const pts = pointsIn.slice();
  if (pts.length < 2) return [];

  // close loop if endpoints near
  if (Vec3.distanceSq(pts[0]!, pts[pts.length - 1]!) <= p.closeEps * p.closeEps) {
    pts[pts.length - 1] = pts[0]!;
  }

  // remove consecutive duplicates
  const clean: Vec3[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i]!;
    if (Vec3.distanceSq(q, clean[clean.length - 1]!) > 1e-16) clean.push(q);
  }
  if (clean.length < 2) return [];

  const tanL = endpointTangentLeft(clean);
  const tanR = endpointTangentRight(clean);
  return fitCubicRecursive(clean, tanL, tanR, p.maxError, p, 0);
}

function fitCubicRecursive(
  pts: Vec3[],
  tanL: Vec3,
  tanR: Vec3,
  maxError: number,
  p: BezierFitParams,
  depth: number,
): CubicBezier3[] {
  const nPts = pts.length;
  if (nPts === 2) {
    const d = Vec3.distance(pts[0]!, pts[1]!);
    const alpha = Math.max(p.minAlpha, d / 3);
    return [{
      p0: pts[0]!,
      p1: Vec3.add(pts[0]!, Vec3.mulScalar(tanL, alpha)),
      p2: Vec3.add(pts[1]!, Vec3.mulScalar(tanR, alpha)),
      p3: pts[1]!,
    }];
  }

  // chord-length parameterization
  let u = chordLengthParams(pts);
  let bez = generateBezier(pts, u, tanL, tanR, p);
  let { maxDist, splitIndex } = maxErrorPoint(pts, u, bez);

  if (maxDist <= maxError) return [bez];
  if (depth >= p.maxDepth) return [bez];

  // try reparameterization
  if (p.reparamIters > 0) {
    for (let iter = 0; iter < p.reparamIters; iter++) {
      u = reparameterize(pts, u, bez);
      bez = generateBezier(pts, u, tanL, tanR, p);
      const e = maxErrorPoint(pts, u, bez);
      maxDist = e.maxDist;
      splitIndex = e.splitIndex;
      if (maxDist <= maxError) return [bez];
    }
  }

  // split and recurse
  const leftPts = pts.slice(0, splitIndex + 1);
  const rightPts = pts.slice(splitIndex);
  const tanM = centerTangent(pts, splitIndex);
  return [
    ...fitCubicRecursive(leftPts, tanL, tanM, maxError, p, depth + 1),
    ...fitCubicRecursive(rightPts, Vec3.mulScalar(tanM, -1), tanR, maxError, p, depth + 1),
  ];
}

function chordLengthParams(pts: Vec3[]): number[] {
  const u: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Vec3.distance(pts[i]!, pts[i - 1]!);
    u.push(total);
  }
  if (total <= 1e-12) return u.map(() => 0);
  return u.map((x) => x / total);
}

function centerTangent(pts: Vec3[], i: number): Vec3 {
  const p0 = pts[Math.max(0, i - 1)]!;
  const p2 = pts[Math.min(pts.length - 1, i + 1)]!;
  return Vec3.normalize(Vec3.sub(p2, p0));
}

function generateBezier(pts: Vec3[], u: number[], tanL: Vec3, tanR: Vec3, p: BezierFitParams): CubicBezier3 {
  const p0 = pts[0]!;
  const p3 = pts[pts.length - 1]!;

  // Build C and X (2x2) for least squares alphas
  let c00 = 0, c01 = 0, c11 = 0;
  let x0 = 0, x1 = 0;

  for (let i = 0; i < pts.length; i++) {
    const t = u[i]!;
    const b0 = B0(t);
    const b1 = B1(t);
    const b2 = B2(t);
    const b3 = B3(t);

    const a1 = Vec3.mulScalar(tanL, b1);
    const a2 = Vec3.mulScalar(tanR, b2);

    c00 += Vec3.dot(a1, a1);
    c01 += Vec3.dot(a1, a2);
    c11 += Vec3.dot(a2, a2);

    const tmp = Vec3.sub(
      pts[i]!,
      Vec3.add(Vec3.mulScalar(p0, b0 + b1), Vec3.mulScalar(p3, b2 + b3)),
    );
    x0 += Vec3.dot(a1, tmp);
    x1 += Vec3.dot(a2, tmp);
  }

  let alphaL = 0;
  let alphaR = 0;
  const det = c00 * c11 - c01 * c01;
  if (Math.abs(det) > 1e-12) {
    alphaL = (x0 * c11 - x1 * c01) / det;
    alphaR = (c00 * x1 - c01 * x0) / det;
  }

  const segLen = Vec3.distance(p0, p3);
  const eps = p.minAlpha;
  if (alphaL < eps || alphaR < eps) {
    const a = Math.max(eps, segLen / 3);
    alphaL = a;
    alphaR = a;
  }

  // Prevent overshoot: if handles become too long, curves "jump"
  const maxAlpha = Math.max(eps, segLen * p.maxAlphaFactor);
  alphaL = clamp(alphaL, eps, maxAlpha);
  alphaR = clamp(alphaR, eps, maxAlpha);

  const p1 = Vec3.add(p0, Vec3.mulScalar(tanL, alphaL));
  const p2 = Vec3.add(p3, Vec3.mulScalar(tanR, alphaR));
  return { p0, p1, p2, p3 };
}

function reparameterize(pts: Vec3[], u: number[], bez: CubicBezier3): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(newtonRaphson(bez, pts[i]!, u[i]!));
  }
  return out;
}

function newtonRaphson(bez: CubicBezier3, p: Vec3, u: number): number {
  // solve for u: (Q(u)-p)·Q'(u) = 0
  const q = evalBezier(bez, u);
  const q1 = evalBezierDer1(bez, u);
  const q2 = evalBezierDer2(bez, u);
  const diff = Vec3.sub(q, p);
  const num = Vec3.dot(diff, q1);
  const den = Vec3.dot(q1, q1) + Vec3.dot(diff, q2);
  if (Math.abs(den) <= 1e-12) return u;
  const u2 = u - num / den;
  return u2 < 0 ? 0 : u2 > 1 ? 1 : u2;
}

function maxErrorPoint(pts: Vec3[], u: number[], bez: CubicBezier3): { maxDist: number; splitIndex: number } {
  let maxDist = 0;
  let splitIndex = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const q = evalBezier(bez, u[i]!);
    const d = Vec3.distance(q, pts[i]!);
    if (d > maxDist) {
      maxDist = d;
      splitIndex = i;
    }
  }
  return { maxDist, splitIndex };
}

function evalBezier(b: CubicBezier3, t: number): Vec3 {
  const b0 = B0(t), b1 = B1(t), b2 = B2(t), b3 = B3(t);
  return Vec3.add(
    Vec3.add(Vec3.mulScalar(b.p0, b0), Vec3.mulScalar(b.p1, b1)),
    Vec3.add(Vec3.mulScalar(b.p2, b2), Vec3.mulScalar(b.p3, b3)),
  );
}

function evalBezierDer1(b: CubicBezier3, t: number): Vec3 {
  // 3 * ( (p1-p0)*(1-t)^2 + 2*(p2-p1)*(1-t)*t + (p3-p2)*t^2 )
  const mt = 1 - t;
  const a = Vec3.mulScalar(Vec3.sub(b.p1, b.p0), mt * mt);
  const c = Vec3.mulScalar(Vec3.sub(b.p2, b.p1), 2 * mt * t);
  const d = Vec3.mulScalar(Vec3.sub(b.p3, b.p2), t * t);
  return Vec3.mulScalar(Vec3.add(Vec3.add(a, c), d), 3);
}

function evalBezierDer2(b: CubicBezier3, t: number): Vec3 {
  // 6 * ( (p2 - 2p1 + p0)*(1-t) + (p3 - 2p2 + p1)*t )
  const mt = 1 - t;
  const a = Vec3.add(Vec3.sub(b.p2, Vec3.mulScalar(b.p1, 2)), b.p0);
  const c = Vec3.add(Vec3.sub(b.p3, Vec3.mulScalar(b.p2, 2)), b.p1);
  return Vec3.mulScalar(Vec3.add(Vec3.mulScalar(a, mt), Vec3.mulScalar(c, t)), 6);
}

function B0(t: number): number { const mt = 1 - t; return mt * mt * mt; }
function B1(t: number): number { const mt = 1 - t; return 3 * mt * mt * t; }
function B2(t: number): number { const mt = 1 - t; return 3 * mt * t * t; }
function B3(t: number): number { return t * t * t; }

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function endpointTangentLeft(pts: Vec3[]): Vec3 {
  const p0 = pts[0]!;
  const k = Math.min(4, pts.length - 1);
  let acc = Vec3.zero();
  for (let i = 1; i <= k; i++) {
    acc = Vec3.add(acc, Vec3.sub(pts[i]!, p0));
  }
  const t = Vec3.normalize(acc);
  return Vec3.lenSq(t) > 1e-18 ? t : Vec3.normalize(Vec3.sub(pts[1]!, pts[0]!));
}

function endpointTangentRight(pts: Vec3[]): Vec3 {
  const pN = pts[pts.length - 1]!;
  const k = Math.min(4, pts.length - 1);
  let acc = Vec3.zero();
  for (let i = 1; i <= k; i++) {
    acc = Vec3.add(acc, Vec3.sub(pts[pts.length - 1 - i]!, pN));
  }
  const t = Vec3.normalize(acc);
  return Vec3.lenSq(t) > 1e-18 ? t : Vec3.normalize(Vec3.sub(pts[pts.length - 2]!, pts[pts.length - 1]!));
}


