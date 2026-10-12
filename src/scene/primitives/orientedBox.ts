import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";
import { PlaneRect } from "./planeRect.js";

/**
 * A box in any orientation: a center, half extents along its own axes, and
 * the directions of its local x and y axes (z completes a right-handed frame).
 */
export class OrientedBox implements Primitive {
  /** Unit local axes in world space. */
  readonly axes: readonly [Vec3, Vec3, Vec3];

  constructor(
    public readonly id: string,
    public readonly center: Vec3,
    public readonly halfSize: Vec3,
    axisX: Vec3,
    axisY: Vec3,
  ) {
    const x = Vec3.normalize(axisX);
    const y = Vec3.normalize(
      Vec3.sub(axisY, Vec3.mulScalar(x, Vec3.dot(axisY, x))),
    );
    this.axes = [x, y, Vec3.cross(x, y)];
  }

  private half(i: number): number {
    return i === 0
      ? this.halfSize.x
      : i === 1
        ? this.halfSize.y
        : this.halfSize.z;
  }

  /** World point → coordinates along the box axes, relative to its center. */
  toLocal(p: Vec3): Vec3 {
    const d = Vec3.sub(p, this.center);
    const [x, y, z] = this.axes;
    return new Vec3(Vec3.dot(d, x), Vec3.dot(d, y), Vec3.dot(d, z));
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    const o = this.toLocal(ray.origin);
    const local = [o.x, o.y, o.z];
    let t0 = Number.NEGATIVE_INFINITY;
    let t1 = Number.POSITIVE_INFINITY;
    let enter = 0;
    let exit = 0;
    let enterSign = 1;
    let exitSign = 1;
    for (let i = 0; i < 3; i++) {
      const d = Vec3.dot(ray.dir, this.axes[i]!);
      const h = this.half(i);
      if (Math.abs(d) <= EPS) {
        if (Math.abs(local[i]!) > h) return null;
        continue;
      }
      let near = (-h - local[i]!) / d;
      let far = (h - local[i]!) / d;
      let nearSign = -1;
      let farSign = 1;
      if (near > far) {
        [near, far] = [far, near];
        [nearSign, farSign] = [farSign, nearSign];
      }
      if (near > t0) {
        t0 = near;
        enter = i;
        enterSign = nearSign;
      }
      if (far < t1) {
        t1 = far;
        exit = i;
        exitSign = farSign;
      }
      if (t0 > t1) return null;
    }
    let t = t0;
    let axis = enter;
    let sign = enterSign;
    if (t <= EPS || t < tMin) {
      t = t1;
      axis = exit;
      sign = exitSign;
    }
    if (!Number.isFinite(t) || t < tMin || t > tMax || t <= EPS) return null;
    return {
      t,
      point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
      normal: Vec3.mulScalar(this.axes[axis]!, sign),
      primitiveId: this.id,
    };
  }

  /** Corner i has local signs (bit 0: x, bit 1: y, bit 2: z). */
  corners(): Vec3[] {
    const [x, y, z] = this.axes;
    const { x: hx, y: hy, z: hz } = this.halfSize;
    return Array.from({ length: 8 }, (_, i) =>
      Vec3.add(
        this.center,
        Vec3.add(
          Vec3.mulScalar(x, i & 1 ? hx : -hx),
          Vec3.add(
            Vec3.mulScalar(y, i & 2 ? hy : -hy),
            Vec3.mulScalar(z, i & 4 ? hz : -hz),
          ),
        ),
      ),
    );
  }

  /** The twelve edges as corner pairs. */
  edges(): [Vec3, Vec3][] {
    const c = this.corners();
    const pairs: [number, number][] = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    return pairs.map(([a, b]) => [c[a]!, c[b]!]);
  }

  /** The six faces as rectangles, for plane and surface intersections. */
  faces(tag = ""): PlaneRect[] {
    const [x, y, z] = this.axes;
    const { x: hx, y: hy, z: hz } = this.halfSize;
    const at = (axis: Vec3, h: number) =>
      Vec3.add(this.center, Vec3.mulScalar(axis, h));
    const neg = (v: Vec3) => Vec3.mulScalar(v, -1);
    const id = (name: string) => `${this.id}:${tag}:face:${name}`;
    return [
      new PlaneRect(id("+x"), at(x, hx), x, z, hz, hy),
      new PlaneRect(id("-x"), at(x, -hx), neg(x), z, hz, hy),
      new PlaneRect(id("+y"), at(y, hy), y, x, hx, hz),
      new PlaneRect(id("-y"), at(y, -hy), neg(y), x, hx, hz),
      new PlaneRect(id("+z"), at(z, hz), z, x, hx, hy),
      new PlaneRect(id("-z"), at(z, -hz), neg(z), x, hx, hy),
    ];
  }
}
