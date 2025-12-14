import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

export class PlaneRect implements Primitive {
  readonly normal: Vec3; // unit
  readonly u: Vec3; // unit, in-plane
  readonly v: Vec3; // unit, in-plane

  constructor(
    public readonly id: string,
    public readonly center: Vec3,
    normal: Vec3,
    uHint: Vec3,
    public readonly halfWidth: number,
    public readonly halfHeight: number,
  ) {
    this.normal = Vec3.normalize(normal);
    // make u orthogonal to normal
    const u0 = Vec3.sub(uHint, Vec3.mulScalar(this.normal, Vec3.dot(uHint, this.normal)));
    this.u = Vec3.normalize(u0);
    this.v = Vec3.normalize(Vec3.cross(this.normal, this.u));
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    const denom = Vec3.dot(ray.dir, this.normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(this.center, ray.origin), this.normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));

    const d = Vec3.sub(p, this.center);
    const du = Vec3.dot(d, this.u);
    const dv = Vec3.dot(d, this.v);
    if (Math.abs(du) > this.halfWidth + 1e-8) return null;
    if (Math.abs(dv) > this.halfHeight + 1e-8) return null;

    const n = denom < 0 ? this.normal : Vec3.mulScalar(this.normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}


