import { Vec3 } from "../math/vec3.js";
export function lineToCubic3(p0, p3) {
    const d = Vec3.sub(p3, p0);
    const p1 = Vec3.add(p0, Vec3.mulScalar(d, 1 / 3));
    const p2 = Vec3.add(p0, Vec3.mulScalar(d, 2 / 3));
    return { p0, p1, p2, p3 };
}
export function sphereSilhouetteToCubics3(opts) {
    // Perspective sphere silhouette = circle of tangency points.
    // Derivation (O camera, C center, |C-O|=d, sphere radius r):
    // plane normal n = (C-O), plane location along n at distance z = d - r^2/d from O
    // circle center S = O + (z/d)*(C-O) = O + (1 - r^2/d^2)*(C-O)
    // circle radius rs = r*sqrt(d^2 - r^2)/d
    const u = Vec3.sub(opts.center, opts.cameraPos);
    const d = Vec3.len(u);
    const r = opts.radius;
    if (d <= r * (1 + 1e-8))
        return [];
    const n = Vec3.normalize(u);
    const k = 1 - (r * r) / (d * d);
    const s = Vec3.add(opts.cameraPos, Vec3.mulScalar(u, k));
    const rs = (r * Math.sqrt(Math.max(0, d * d - r * r))) / d;
    return circleToCubics3({ center: s, normal: n, radius: rs });
}
export function cylinderSilhouetteToCubics3(opts) {
    // Perspective cylinder silhouette = two generators where camera rays are tangent to the cylinder.
    // Works for infinite cylinder; for finite one we clamp to [0, height] by using base/top points.
    const a = Vec3.normalize(opts.axis);
    // W⊥: camera vector projected to plane perpendicular to axis (independent of height)
    const w = Vec3.sub(opts.cameraPos, opts.base);
    const wPerp = Vec3.sub(w, Vec3.mulScalar(a, Vec3.dot(w, a)));
    const wLen = Vec3.len(wPerp);
    if (wLen <= opts.radius * (1 + 1e-8))
        return [];
    const wUnit = Vec3.mulScalar(wPerp, 1 / wLen);
    const perp = Vec3.normalize(Vec3.cross(a, wUnit));
    // Solve wUnit · N = r/|wPerp|  (N is unit in plane)
    const cosPhi = opts.radius / wLen;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const n0 = Vec3.add(Vec3.mulScalar(wUnit, cosPhi), Vec3.mulScalar(perp, sinPhi));
    const n1 = Vec3.add(Vec3.mulScalar(wUnit, cosPhi), Vec3.mulScalar(perp, -sinPhi));
    const topCenter = Vec3.add(opts.base, Vec3.mulScalar(a, opts.height));
    const b0 = Vec3.add(opts.base, Vec3.mulScalar(n0, opts.radius));
    const t0 = Vec3.add(topCenter, Vec3.mulScalar(n0, opts.radius));
    const b1 = Vec3.add(opts.base, Vec3.mulScalar(n1, opts.radius));
    const t1 = Vec3.add(topCenter, Vec3.mulScalar(n1, opts.radius));
    return [lineToCubic3(b0, t0), lineToCubic3(b1, t1)];
}
export function coneSilhouetteToCubics3(opts) {
    // Right circular cone silhouette = two generators (straight lines).
    // Use N(ψ) ∝ w(ψ) - k a, where w(ψ)=cosψ u + sinψ v in plane ⟂ a, k=R/H.
    // Condition for occluding contour generator: (cameraPos - apex) · N(ψ) = 0
    const a = Vec3.normalize(opts.axis);
    const k = opts.baseRadius / opts.height;
    const { u, v } = orthonormalBasisFromNormal(a);
    const q = Vec3.sub(opts.cameraPos, opts.apex);
    const qu = Vec3.dot(q, u);
    const qv = Vec3.dot(q, v);
    const qa = Vec3.dot(q, a);
    const m = Math.hypot(qu, qv);
    if (m <= 1e-8)
        return []; // camera on axis -> degenerate, base rim is already drawn
    const rhs = (k * qa) / m;
    if (Math.abs(rhs) > 1)
        return []; // no real tangents (shouldn't happen for external camera)
    const phi = Math.atan2(qv, qu);
    const delta = Math.acos(rhs);
    const psi0 = phi + delta;
    const psi1 = phi - delta;
    const baseCenter = Vec3.add(opts.apex, Vec3.mulScalar(a, opts.height));
    const w0 = Vec3.add(Vec3.mulScalar(u, Math.cos(psi0)), Vec3.mulScalar(v, Math.sin(psi0)));
    const w1 = Vec3.add(Vec3.mulScalar(u, Math.cos(psi1)), Vec3.mulScalar(v, Math.sin(psi1)));
    const p0 = Vec3.add(baseCenter, Vec3.mulScalar(w0, opts.baseRadius));
    const p1 = Vec3.add(baseCenter, Vec3.mulScalar(w1, opts.baseRadius));
    return [lineToCubic3(opts.apex, p0), lineToCubic3(opts.apex, p1)];
}
export function cylinderGeneratorsToCubics3(opts) {
    const a = Vec3.normalize(opts.axis);
    // 카메라를 axis line에 직교 투영한 뒤, axis에 수직한 반지름 방향을 구한다.
    const baseToCam = Vec3.sub(opts.cameraPos, opts.base);
    const s = Vec3.dot(baseToCam, a);
    const closestOnAxis = Vec3.add(opts.base, Vec3.mulScalar(a, s));
    const radial = Vec3.sub(opts.cameraPos, closestOnAxis);
    const radialPerp = Vec3.sub(radial, Vec3.mulScalar(a, Vec3.dot(radial, a)));
    const radialLen = Vec3.len(radialPerp);
    const rDir = radialLen > 1e-8
        ? Vec3.mulScalar(radialPerp, 1 / radialLen)
        : Vec3.normalize(Vec3.cross(a, new Vec3(0, 0, 1)));
    const base0 = Vec3.add(opts.base, Vec3.mulScalar(rDir, opts.radius));
    const base1 = Vec3.sub(opts.base, Vec3.mulScalar(rDir, opts.radius));
    const topCenter = Vec3.add(opts.base, Vec3.mulScalar(a, opts.height));
    const top0 = Vec3.add(topCenter, Vec3.mulScalar(rDir, opts.radius));
    const top1 = Vec3.sub(topCenter, Vec3.mulScalar(rDir, opts.radius));
    return [lineToCubic3(base0, top0), lineToCubic3(base1, top1)];
}
export function coneGeneratorsToCubics3(opts) {
    const a = Vec3.normalize(opts.axis);
    const apexToCam = Vec3.sub(opts.cameraPos, opts.apex);
    const s = Vec3.dot(apexToCam, a);
    const closestOnAxis = Vec3.add(opts.apex, Vec3.mulScalar(a, s));
    const radial = Vec3.sub(opts.cameraPos, closestOnAxis);
    const radialPerp = Vec3.sub(radial, Vec3.mulScalar(a, Vec3.dot(radial, a)));
    const radialLen = Vec3.len(radialPerp);
    const rDir = radialLen > 1e-8
        ? Vec3.mulScalar(radialPerp, 1 / radialLen)
        : Vec3.normalize(Vec3.cross(a, new Vec3(0, 0, 1)));
    const baseCenter = Vec3.add(opts.apex, Vec3.mulScalar(a, opts.height));
    const b0 = Vec3.add(baseCenter, Vec3.mulScalar(rDir, opts.baseRadius));
    const b1 = Vec3.sub(baseCenter, Vec3.mulScalar(rDir, opts.baseRadius));
    return [lineToCubic3(opts.apex, b0), lineToCubic3(opts.apex, b1)];
}
function orthonormalBasisFromNormal(n) {
    // pick a helper not parallel to n
    const a = Math.abs(n.z) < 0.9 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
    const u = Vec3.normalize(Vec3.cross(a, n));
    const v = Vec3.normalize(Vec3.cross(n, u));
    return { u, v };
}
export function circleToCubics3(opts) {
    const start = opts.startAngleRad ?? 0;
    const end = opts.endAngleRad ?? Math.PI * 2;
    const sweep = end - start;
    const segments = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const n = Vec3.normalize(opts.normal);
    const { u, v } = orthonormalBasisFromNormal(n);
    const out = [];
    for (let i = 0; i < segments; i++) {
        const a0 = start + (sweep * i) / segments;
        const a1 = start + (sweep * (i + 1)) / segments;
        out.push(arc90ToCubic3(opts.center, u, v, opts.radius, a0, a1));
    }
    return out;
}
function arc90ToCubic3(center, u, v, r, a0, a1) {
    // exact circle as cubic only for 90deg; for smaller angle use general k = 4/3*tan(d/4)
    const d = a1 - a0;
    const k = (4 / 3) * Math.tan(d / 4);
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const p0 = pointOnCircle(center, u, v, r, c0, s0);
    const p3 = pointOnCircle(center, u, v, r, c1, s1);
    // tangent directions
    const t0 = Vec3.add(Vec3.mulScalar(u, -s0), Vec3.mulScalar(v, c0));
    const t1 = Vec3.add(Vec3.mulScalar(u, -s1), Vec3.mulScalar(v, c1));
    const p1 = Vec3.add(p0, Vec3.mulScalar(t0, k * r));
    const p2 = Vec3.sub(p3, Vec3.mulScalar(t1, k * r));
    return { p0, p1, p2, p3 };
}
function pointOnCircle(center, u, v, r, c, s) {
    return Vec3.add(center, Vec3.add(Vec3.mulScalar(u, r * c), Vec3.mulScalar(v, r * s)));
}
//# sourceMappingURL=builders.js.map