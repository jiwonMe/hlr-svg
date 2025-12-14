import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

export class Disk implements Primitive {
  readonly normal: Vec3; // unit

  constructor(
    public readonly id: string,
    public readonly center: Vec3,
    normal: Vec3,
    public readonly radius: number,
  ) {
    this.normal = Vec3.normalize(normal);
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    const denom = Vec3.dot(ray.dir, this.normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(this.center, ray.origin), this.normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    if (Vec3.distanceSq(p, this.center) > this.radius * this.radius + 1e-8) return null;
    const n = denom < 0 ? this.normal : Vec3.mulScalar(this.normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}


