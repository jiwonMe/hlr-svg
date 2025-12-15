import { Vec3 } from "../math/vec3.js";
export function evalCubic3(b, t) {
    // de Casteljau
    const a = Vec3.lerp(b.p0, b.p1, t);
    const c = Vec3.lerp(b.p1, b.p2, t);
    const d = Vec3.lerp(b.p2, b.p3, t);
    const e = Vec3.lerp(a, c, t);
    const f = Vec3.lerp(c, d, t);
    return Vec3.lerp(e, f, t);
}
export function splitCubic3(b, t) {
    // de Casteljau split (exact)
    const a = Vec3.lerp(b.p0, b.p1, t);
    const c = Vec3.lerp(b.p1, b.p2, t);
    const d = Vec3.lerp(b.p2, b.p3, t);
    const e = Vec3.lerp(a, c, t);
    const f = Vec3.lerp(c, d, t);
    const g = Vec3.lerp(e, f, t); // point at t
    return {
        left: { p0: b.p0, p1: a, p2: e, p3: g },
        right: { p0: g, p1: f, p2: d, p3: b.p3 },
    };
}
