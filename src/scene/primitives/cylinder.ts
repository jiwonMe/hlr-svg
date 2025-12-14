import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

export type CylinderCaps = "none" | "both";

export class Cylinder implements Primitive {
  readonly axis: Vec3; // unit
  constructor(
    public readonly id: string,
    public readonly base: Vec3,
    axis: Vec3,
    public readonly height: number,
    public readonly radius: number,
    public readonly caps: CylinderCaps = "both",
  ) {
    this.axis = Vec3.normalize(axis);
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    // Decompose along axis
    const oc = Vec3.sub(ray.origin, this.base);
    const dDotA = Vec3.dot(ray.dir, this.axis);
    const ocDotA = Vec3.dot(oc, this.axis);
    const dPerp = Vec3.sub(ray.dir, Vec3.mulScalar(this.axis, dDotA));
    const ocPerp = Vec3.sub(oc, Vec3.mulScalar(this.axis, ocDotA));

    let best: Hit | null = null;
    let bestT = tMax;

    // side (infinite cylinder)
    const a = Vec3.dot(dPerp, dPerp);
    const b = 2 * Vec3.dot(ocPerp, dPerp);
    const c = Vec3.dot(ocPerp, ocPerp) - this.radius * this.radius;
    if (a > EPS) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        const inv2a = 1 / (2 * a);
        const t0 = (-b - s) * inv2a;
        const t1 = (-b + s) * inv2a;
        const candidates = [t0, t1];
        for (const t of candidates) {
          if (t <= EPS || t < tMin || t > bestT) continue;
          const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
          const v = Vec3.sub(p, this.base);
          const h = Vec3.dot(v, this.axis);
          if (h < 0 || h > this.height) continue;
          const onAxis = Vec3.add(this.base, Vec3.mulScalar(this.axis, h));
          const normal = Vec3.normalize(Vec3.sub(p, onAxis));
          bestT = t;
          best = { t, point: p, normal, primitiveId: this.id };
        }
      }
    }

    if (this.caps === "both") {
      // cap at base: plane (base, axis)
      best = this.hitCap(ray, this.base, this.axis, tMin, bestT, best) ?? best;
      // cap at top: plane (base + axis*height, axis)
      const top = Vec3.add(this.base, Vec3.mulScalar(this.axis, this.height));
      best = this.hitCap(ray, top, this.axis, tMin, bestT, best) ?? best;
      if (best) bestT = best.t;
    }

    return best;
  }

  private hitCap(
    ray: Ray,
    center: Vec3,
    normal: Vec3,
    tMin: number,
    tMax: number,
    current: Hit | null,
  ): Hit | null {
    const denom = Vec3.dot(ray.dir, normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(center, ray.origin), normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    const r2 = Vec3.distanceSq(p, center);
    if (r2 > this.radius * this.radius + 1e-8) return null;
    if (current && t >= current.t) return null;
    const n = denom < 0 ? normal : Vec3.mulScalar(normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}


