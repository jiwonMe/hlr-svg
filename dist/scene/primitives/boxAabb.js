import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
export class BoxAabb {
    id;
    min;
    max;
    constructor(id, min, max) {
        this.id = id;
        this.min = min;
        this.max = max;
    }
    intersect(ray, tMin, tMax) {
        // slab method
        let t0 = tMin;
        let t1 = tMax;
        let hitNormal = new Vec3(0, 0, 0);
        const axes = [
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
                if (o < minA || o > maxA)
                    return null;
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
                const tmpN = nNear;
                nNear = nFar;
                nFar = tmpN;
            }
            if (tNear > t0) {
                t0 = tNear;
                hitNormal = nNear;
            }
            if (tFar < t1)
                t1 = tFar;
            if (t0 > t1)
                return null;
        }
        const t = t0;
        if (t < tMin || t > tMax)
            return null;
        if (t <= EPS)
            return null;
        const point = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
        return { t, point, normal: hitNormal, primitiveId: this.id };
    }
}
