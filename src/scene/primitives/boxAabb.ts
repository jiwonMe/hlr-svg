import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

export class BoxAabb implements Primitive {
  constructor(
    public readonly id: string,
    public readonly min: Vec3,
    public readonly max: Vec3,
  ) {}

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    // slab method
    let t0 = tMin;
    let t1 = tMax;
    let enterNormal = new Vec3(0, 0, 0);
    let exitNormal = new Vec3(0, 0, 0);

    const axes: Array<["x" | "y" | "z", Vec3, Vec3]> = [
      ["x", new Vec3(-1, 0, 0), new Vec3(1, 0, 0)],
      ["y", new Vec3(0, -1, 0), new Vec3(0, 1, 0)],
      ["z", new Vec3(0, 0, -1), new Vec3(0, 0, 1)],
    ];

    for (const [axis, nMin, nMax] of axes) {
      const o = ray.origin[axis];
      const d = ray.dir[axis];
      const minA = this.min[axis];
      const maxA = this.max[axis];
      if (Math.abs(d) <= EPS) {
        if (o < minA || o > maxA) return null;
        continue;
      }
      const invD = 1 / d;
      let tNear = (minA - o) * invD;
      let tFar = (maxA - o) * invD;
      let nNear = nMin;
      let nFar = nMax;
      if (tNear > tFar) {
        const tmp = tNear;
        tNear = tFar;
        tFar = tmp;
        nNear = nMax;
        nFar = nMin;
      }
      if (tNear > t0) {
        t0 = tNear;
        enterNormal = nNear;
      }
      if (tFar < t1) {
        t1 = tFar;
        exitNormal = nFar;
      }
      if (t0 > t1) return null;
    }

    let t = t0;
    let normal = enterNormal;
    if (t <= EPS) {
      t = t1;
      normal = exitNormal;
    }
    if (t < tMin || t > tMax) return null;
    if (t <= EPS) return null;
    const point = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    return { t, point, normal, primitiveId: this.id };
  }
}
