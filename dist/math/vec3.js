import { EPS } from "./eps.js";
export class Vec3 {
    x;
    y;
    z;
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    static zero() {
        return new Vec3(0, 0, 0);
    }
    static add(a, b) {
        return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
    }
    static sub(a, b) {
        return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    static mulScalar(a, s) {
        return new Vec3(a.x * s, a.y * s, a.z * s);
    }
    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
    static cross(a, b) {
        return new Vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
    }
    static lenSq(a) {
        return Vec3.dot(a, a);
    }
    static len(a) {
        return Math.sqrt(Vec3.lenSq(a));
    }
    static normalize(a) {
        const l = Vec3.len(a);
        if (l <= EPS)
            return Vec3.zero();
        return Vec3.mulScalar(a, 1 / l);
    }
    static lerp(a, b, t) {
        return new Vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
    static distance(a, b) {
        return Vec3.len(Vec3.sub(a, b));
    }
    static distanceSq(a, b) {
        return Vec3.lenSq(Vec3.sub(a, b));
    }
}
//# sourceMappingURL=vec3.js.map