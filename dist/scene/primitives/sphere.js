import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
export class Sphere {
    id;
    center;
    radius;
    constructor(id, center, radius) {
        this.id = id;
        this.center = center;
        this.radius = radius;
    }
    intersect(ray, tMin, tMax) {
        const oc = Vec3.sub(ray.origin, this.center);
        const a = Vec3.dot(ray.dir, ray.dir);
        const b = 2 * Vec3.dot(oc, ray.dir);
        const c = Vec3.dot(oc, oc) - this.radius * this.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0)
            return null;
        const s = Math.sqrt(disc);
        const inv2a = 1 / (2 * a);
        const t0 = (-b - s) * inv2a;
        const t1 = (-b + s) * inv2a;
        let t = t0;
        if (t < tMin || t > tMax)
            t = t1;
        if (t < tMin || t > tMax)
            return null;
        if (t <= EPS)
            return null;
        const point = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
        const normal = Vec3.normalize(Vec3.sub(point, this.center));
        return { t, point, normal, primitiveId: this.id };
    }
}
