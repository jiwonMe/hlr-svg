import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

export type ConeCaps = "none" | "base";

export class Cone implements Primitive {
  readonly axis: Vec3; // unit, from apex to base
  readonly k: number; // tan(theta) where theta is half-angle

  constructor(
    public readonly id: string,
    public readonly apex: Vec3,
    axis: Vec3,
    public readonly height: number,
    public readonly baseRadius: number,
    public readonly cap: ConeCaps = "base",
  ) {
    this.axis = Vec3.normalize(axis);
    this.k = this.baseRadius / this.height;
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    let best: Hit | null = null;
    let bestT = tMax;

    // Cone implicit in apex space:
    // Let v be axis unit, y = dot(x, v), xPerp = x - v*y
    // Condition: |xPerp|^2 = (k*y)^2, with y in [0, height]
    const co = Vec3.sub(ray.origin, this.apex);
    const dv = Vec3.dot(ray.dir, this.axis);
    const cov = Vec3.dot(co, this.axis);
    const dPerp = Vec3.sub(ray.dir, Vec3.mulScalar(this.axis, dv));
    const coPerp = Vec3.sub(co, Vec3.mulScalar(this.axis, cov));

    const k2 = this.k * this.k;
    const a = Vec3.dot(dPerp, dPerp) - k2 * dv * dv;
    const b = 2 * (Vec3.dot(coPerp, dPerp) - k2 * cov * dv);
    const c = Vec3.dot(coPerp, coPerp) - k2 * cov * cov;

    if (Math.abs(a) > EPS) {
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
          const x = Vec3.sub(p, this.apex);
          const y = Vec3.dot(x, this.axis);
          if (y < 0 || y > this.height) continue;

          // Normal from gradient of implicit:
          // F = |xPerp|^2 - k^2 y^2 = 0
          const xPerp = Vec3.sub(x, Vec3.mulScalar(this.axis, y));
          const grad = Vec3.sub(Vec3.mulScalar(xPerp, 2), Vec3.mulScalar(this.axis, 2 * k2 * y));
          const normal = Vec3.normalize(grad);
          bestT = t;
          best = { t, point: p, normal, primitiveId: this.id };
        }
      }
    }

    if (this.cap === "base") {
      const baseCenter = Vec3.add(this.apex, Vec3.mulScalar(this.axis, this.height));
      const capHit = this.hitBaseCap(ray, baseCenter, this.axis, tMin, bestT);
      if (capHit && (!best || capHit.t < best.t)) best = capHit;
    }

    return best;
  }

  private hitBaseCap(ray: Ray, center: Vec3, normal: Vec3, tMin: number, tMax: number): Hit | null {
    const denom = Vec3.dot(ray.dir, normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(center, ray.origin), normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    if (Vec3.distanceSq(p, center) > this.baseRadius * this.baseRadius + 1e-8) return null;
    const n = denom < 0 ? normal : Vec3.mulScalar(normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}


