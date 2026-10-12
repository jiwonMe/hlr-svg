import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";
import { BoxAabb } from "./boxAabb.js";
import { Cone } from "./cone.js";
import { Cylinder } from "./cylinder.js";
import { OrientedBox } from "./orientedBox.js";
import { Sphere } from "./sphere.js";

export type CsgOperation = "union" | "subtract" | "intersect";

/** "On the boundary" tolerance, relative to the largest operand's size. */
export const CSG_TOLERANCE = 3e-3;

/** Closed solids that can take part in a boolean operation. */
export type CsgLeaf = Sphere | Cylinder | Cone | BoxAabb | OrientedBox;
export type CsgSolid = CsgLeaf | Csg;

/** Where a ray crosses a surface, with that surface's normal (any sign). */
type Crossing = { t: number; normal: Vec3 };
/** A stretch of a ray that lies inside a solid. */
export type CsgSpan = { start: Crossing; end: Crossing };

/** -1 inside, 0 on the surface (within tolerance), 1 outside. */
export type CsgClass = -1 | 0 | 1;

const INF = Number.POSITIVE_INFINITY;

/**
 * A boolean combination of two solids: `a ∪ b`, `a − b` or `a ∩ b`.
 *
 * Rays are clipped exactly: every operand reports the stretch of a ray it
 * contains, and the stretches are merged per operation. Surface curves are
 * kept only where they lie on the resulting boundary (see `classify`).
 */
export class Csg implements Primitive {
  constructor(
    public readonly id: string,
    public readonly operation: CsgOperation,
    public readonly a: CsgSolid,
    public readonly b: CsgSolid,
  ) {}

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    for (const span of csgSpans(this, ray)) {
      for (const crossing of [span.start, span.end]) {
        const t = crossing.t;
        if (t <= EPS || t < tMin) continue;
        if (t > tMax) return null;
        // Outward normal: against the ray where it enters, along it where it leaves.
        const entering = crossing === span.start;
        const along = Vec3.dot(crossing.normal, ray.dir) > 0;
        const normal =
          entering === along
            ? Vec3.mulScalar(crossing.normal, -1)
            : crossing.normal;
        return {
          t,
          point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
          normal,
          primitiveId: this.id,
        };
      }
    }
    return null;
  }

  /** Point classification against the combined solid. */
  classify(p: Vec3, tolerance: number): CsgClass {
    return classifySolid(this, p, tolerance);
  }

  /** The primitive operands, depth first. */
  leaves(): CsgLeaf[] {
    const out: CsgLeaf[] = [];
    const walk = (solid: CsgSolid) => {
      if (solid instanceof Csg) {
        walk(solid.a);
        walk(solid.b);
      } else out.push(solid);
    };
    walk(this);
    return out;
  }

  /** Size of the largest operand, for scale-aware tolerances. */
  size(): number {
    let size = 0;
    for (const leaf of this.leaves()) size = Math.max(size, leafSize(leaf));
    return size;
  }
}

/* ── Ray spans ──────────────────────────────────────────────────────────── */

export function csgSpans(solid: CsgSolid, ray: Ray): CsgSpan[] {
  if (!(solid instanceof Csg)) {
    const span = leafSpan(solid, ray);
    return span ? [span] : [];
  }
  const a = csgSpans(solid.a, ray);
  const b = csgSpans(solid.b, ray);
  if (solid.operation === "union") return unionSpans(a, b);
  if (solid.operation === "intersect") return intersectSpans(a, b);
  return subtractSpans(a, b);
}

function span(t0: number, n0: Vec3, t1: number, n1: Vec3): CsgSpan | null {
  if (!(t0 < t1) || !Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return { start: { t: t0, normal: n0 }, end: { t: t1, normal: n1 } };
}

/** Tracks the tightest entry and exit while intersecting convex constraints. */
class Clip {
  t0 = -INF;
  t1 = INF;
  n0 = new Vec3(0, 0, 0);
  n1 = new Vec3(0, 0, 0);
  empty = false;
  enter(t: number, n: Vec3) {
    if (t > this.t0) {
      this.t0 = t;
      this.n0 = n;
    }
  }
  leave(t: number, n: Vec3) {
    if (t < this.t1) {
      this.t1 = t;
      this.n1 = n;
    }
  }
  /** Keeps `lo ≤ s(t) ≤ hi` for an affine s(t) = s0 + ds·t. */
  slab(s0: number, ds: number, lo: number, hi: number, nLo: Vec3, nHi: Vec3) {
    if (Math.abs(ds) <= EPS) {
      if (s0 < lo || s0 > hi) this.empty = true;
      return;
    }
    const ta = (lo - s0) / ds;
    const tb = (hi - s0) / ds;
    if (ta < tb) {
      this.enter(ta, nLo);
      this.leave(tb, nHi);
    } else {
      this.enter(tb, nHi);
      this.leave(ta, nLo);
    }
  }
  result(): CsgSpan | null {
    return this.empty ? null : span(this.t0, this.n0, this.t1, this.n1);
  }
  copy(): Clip {
    const c = new Clip();
    c.t0 = this.t0;
    c.t1 = this.t1;
    c.n0 = this.n0;
    c.n1 = this.n1;
    c.empty = this.empty;
    return c;
  }
}

function leafSpan(leaf: CsgLeaf, ray: Ray): CsgSpan | null {
  const { origin: o, dir: d } = ray;
  if (leaf instanceof Sphere) {
    const oc = Vec3.sub(o, leaf.center);
    const a = Vec3.dot(d, d);
    const b = 2 * Vec3.dot(oc, d);
    const c = Vec3.dot(oc, oc) - leaf.radius * leaf.radius;
    const disc = b * b - 4 * a * c;
    if (disc <= 0) return null;
    const s = Math.sqrt(disc);
    const t0 = (-b - s) / (2 * a);
    const t1 = (-b + s) / (2 * a);
    const at = (t: number) =>
      Vec3.normalize(Vec3.sub(Vec3.add(o, Vec3.mulScalar(d, t)), leaf.center));
    return span(t0, at(t0), t1, at(t1));
  }
  if (leaf instanceof BoxAabb) {
    const clip = new Clip();
    const axes: ["x" | "y" | "z", Vec3][] = [
      ["x", new Vec3(1, 0, 0)],
      ["y", new Vec3(0, 1, 0)],
      ["z", new Vec3(0, 0, 1)],
    ];
    for (const [k, n] of axes)
      clip.slab(o[k], d[k], leaf.min[k], leaf.max[k], Vec3.mulScalar(n, -1), n);
    return clip.result();
  }
  if (leaf instanceof OrientedBox) {
    const clip = new Clip();
    const local = leaf.toLocal(o);
    const values = [local.x, local.y, local.z];
    const halves = [leaf.halfSize.x, leaf.halfSize.y, leaf.halfSize.z];
    leaf.axes.forEach((axis, i) =>
      clip.slab(
        values[i]!,
        Vec3.dot(d, axis),
        -halves[i]!,
        halves[i]!,
        Vec3.mulScalar(axis, -1),
        axis,
      ),
    );
    return clip.result();
  }
  if (leaf instanceof Cylinder) {
    const axis = leaf.axis;
    const clip = new Clip();
    // Between the caps.
    const h0 = Vec3.dot(Vec3.sub(o, leaf.base), axis);
    clip.slab(
      h0,
      Vec3.dot(d, axis),
      0,
      leaf.height,
      Vec3.mulScalar(axis, -1),
      axis,
    );
    // Inside the infinite tube.
    const oc = Vec3.sub(o, leaf.base);
    const dPerp = Vec3.sub(d, Vec3.mulScalar(axis, Vec3.dot(d, axis)));
    const oPerp = Vec3.sub(oc, Vec3.mulScalar(axis, Vec3.dot(oc, axis)));
    const a = Vec3.dot(dPerp, dPerp);
    const c = Vec3.dot(oPerp, oPerp) - leaf.radius * leaf.radius;
    if (a <= EPS) {
      if (c > 0) return null;
    } else {
      const b = 2 * Vec3.dot(oPerp, dPerp);
      const disc = b * b - 4 * a * c;
      if (disc <= 0) return null;
      const s = Math.sqrt(disc);
      const t0 = (-b - s) / (2 * a);
      const t1 = (-b + s) / (2 * a);
      const radial = (t: number) =>
        Vec3.normalize(Vec3.add(oPerp, Vec3.mulScalar(dPerp, t)));
      clip.enter(t0, radial(t0));
      clip.leave(t1, radial(t1));
    }
    return clip.result();
  }
  // Cone: apex at y = 0, base disk at y = height; radius grows as k·y.
  const axis = leaf.axis;
  const k = leaf.baseRadius / leaf.height;
  const clip = new Clip();
  const co = Vec3.sub(o, leaf.apex);
  const y0 = Vec3.dot(co, axis);
  const dy = Vec3.dot(d, axis);
  clip.slab(y0, dy, 0, leaf.height, Vec3.mulScalar(axis, -1), axis);
  const oPerp = Vec3.sub(co, Vec3.mulScalar(axis, y0));
  const dPerp = Vec3.sub(d, Vec3.mulScalar(axis, dy));
  // f(t) = |perp|² − k²y² ≤ 0 describes the double cone; the slab keeps one nappe.
  const A = Vec3.dot(dPerp, dPerp) - k * k * dy * dy;
  const B = 2 * (Vec3.dot(oPerp, dPerp) - k * k * y0 * dy);
  const C = Vec3.dot(oPerp, oPerp) - k * k * y0 * y0;
  const lateral = (t: number) => {
    const y = y0 + dy * t;
    const perp = Vec3.add(oPerp, Vec3.mulScalar(dPerp, t));
    return Vec3.normalize(Vec3.sub(perp, Vec3.mulScalar(axis, k * k * y)));
  };
  if (Math.abs(A) <= EPS) {
    if (Math.abs(B) <= EPS) {
      if (C > 0) return null;
    } else {
      const t = -C / B;
      if (B > 0) clip.leave(t, lateral(t));
      else clip.enter(t, lateral(t));
    }
    return clip.result();
  }
  const disc = B * B - 4 * A * C;
  if (disc <= 0) {
    if (A > 0) return null; // f > 0 everywhere
    return clip.result(); // f ≤ 0 everywhere; the slab bounds it
  }
  const s = Math.sqrt(disc);
  const r0 = Math.min((-B - s) / (2 * A), (-B + s) / (2 * A));
  const r1 = Math.max((-B - s) / (2 * A), (-B + s) / (2 * A));
  if (A > 0) {
    clip.enter(r0, lateral(r0));
    clip.leave(r1, lateral(r1));
    return clip.result();
  }
  // f ≤ 0 outside [r0, r1]: two half lines; the slab selects the solid nappe.
  const before = clip.copy();
  before.leave(r0, lateral(r0));
  clip.enter(r1, lateral(r1));
  return before.result() ?? clip.result();
}

function unionSpans(a: CsgSpan[], b: CsgSpan[]): CsgSpan[] {
  const all = [...a, ...b].sort((x, y) => x.start.t - y.start.t);
  const out: CsgSpan[] = [];
  for (const s of all) {
    const last = out[out.length - 1];
    if (last && s.start.t <= last.end.t) {
      if (s.end.t > last.end.t)
        out[out.length - 1] = { start: last.start, end: s.end };
    } else out.push(s);
  }
  return out;
}

function intersectSpans(a: CsgSpan[], b: CsgSpan[]): CsgSpan[] {
  const out: CsgSpan[] = [];
  for (const x of a)
    for (const y of b) {
      const start = x.start.t > y.start.t ? x.start : y.start;
      const end = x.end.t < y.end.t ? x.end : y.end;
      if (start.t < end.t) out.push({ start, end });
    }
  return out.sort((x, y) => x.start.t - y.start.t);
}

function subtractSpans(a: CsgSpan[], b: CsgSpan[]): CsgSpan[] {
  let pieces = a;
  for (const cut of b) {
    const next: CsgSpan[] = [];
    for (const piece of pieces) {
      if (cut.end.t <= piece.start.t || cut.start.t >= piece.end.t) {
        next.push(piece);
        continue;
      }
      if (cut.start.t > piece.start.t)
        next.push({ start: piece.start, end: cut.start });
      if (cut.end.t < piece.end.t)
        next.push({ start: cut.end, end: piece.end });
    }
    pieces = next;
  }
  return pieces;
}

/* ── Point classification ───────────────────────────────────────────────── */

/** Signed distance to a leaf: exact on the surface, negative inside. */
export function leafDistance(leaf: CsgLeaf, p: Vec3): number {
  if (leaf instanceof Sphere)
    return Vec3.distance(p, leaf.center) - leaf.radius;
  if (leaf instanceof BoxAabb) {
    const c = Vec3.mulScalar(Vec3.add(leaf.min, leaf.max), 0.5);
    const h = Vec3.mulScalar(Vec3.sub(leaf.max, leaf.min), 0.5);
    return Math.max(
      Math.abs(p.x - c.x) - h.x,
      Math.abs(p.y - c.y) - h.y,
      Math.abs(p.z - c.z) - h.z,
    );
  }
  if (leaf instanceof OrientedBox) {
    const l = leaf.toLocal(p);
    return Math.max(
      Math.abs(l.x) - leaf.halfSize.x,
      Math.abs(l.y) - leaf.halfSize.y,
      Math.abs(l.z) - leaf.halfSize.z,
    );
  }
  if (leaf instanceof Cylinder) {
    const v = Vec3.sub(p, leaf.base);
    const h = Vec3.dot(v, leaf.axis);
    const radial = Vec3.len(Vec3.sub(v, Vec3.mulScalar(leaf.axis, h)));
    return Math.max(radial - leaf.radius, -h, h - leaf.height);
  }
  const v = Vec3.sub(p, leaf.apex);
  const y = Vec3.dot(v, leaf.axis);
  const radial = Vec3.len(Vec3.sub(v, Vec3.mulScalar(leaf.axis, y)));
  const k = leaf.baseRadius / leaf.height;
  return Math.max((radial - k * y) / Math.sqrt(1 + k * k), -y, y - leaf.height);
}

function classifySolid(solid: CsgSolid, p: Vec3, tolerance: number): CsgClass {
  if (!(solid instanceof Csg)) {
    const d = leafDistance(solid, p);
    return d < -tolerance ? -1 : d > tolerance ? 1 : 0;
  }
  const a = classifySolid(solid.a, p, tolerance);
  let b = classifySolid(solid.b, p, tolerance);
  if (solid.operation === "subtract") b = -b as CsgClass;
  if (solid.operation === "union") {
    if (a === -1 || b === -1) return -1;
    return a === 1 && b === 1 ? 1 : 0;
  }
  // intersect, and subtract as a ∩ ¬b
  if (a === 1 || b === 1) return 1;
  return a === -1 && b === -1 ? -1 : 0;
}

function leafSize(leaf: CsgLeaf): number {
  if (leaf instanceof Sphere) return leaf.radius;
  if (leaf instanceof BoxAabb) return Vec3.distance(leaf.min, leaf.max) / 2;
  if (leaf instanceof OrientedBox) return Vec3.len(leaf.halfSize);
  if (leaf instanceof Cylinder) return Math.hypot(leaf.radius, leaf.height / 2);
  return Math.hypot(leaf.baseRadius, leaf.height);
}
