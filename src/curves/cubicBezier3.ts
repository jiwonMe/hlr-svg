import { Vec3 } from "../math/vec3.js";

export type CubicBezier3 = {
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
};

export function evalCubic3(b: CubicBezier3, t: number): Vec3 {
  // Preserve de Casteljau's arithmetic while allocating only the result.
  const ax = b.p0.x + (b.p1.x - b.p0.x) * t;
  const ay = b.p0.y + (b.p1.y - b.p0.y) * t;
  const az = b.p0.z + (b.p1.z - b.p0.z) * t;
  const bx = b.p1.x + (b.p2.x - b.p1.x) * t;
  const by = b.p1.y + (b.p2.y - b.p1.y) * t;
  const bz = b.p1.z + (b.p2.z - b.p1.z) * t;
  const cx = b.p2.x + (b.p3.x - b.p2.x) * t;
  const cy = b.p2.y + (b.p3.y - b.p2.y) * t;
  const cz = b.p2.z + (b.p3.z - b.p2.z) * t;
  const dx = ax + (bx - ax) * t;
  const dy = ay + (by - ay) * t;
  const dz = az + (bz - az) * t;
  const ex = bx + (cx - bx) * t;
  const ey = by + (cy - by) * t;
  const ez = bz + (cz - bz) * t;
  return new Vec3(dx + (ex - dx) * t, dy + (ey - dy) * t, dz + (ez - dz) * t);
}

export function splitCubic3(
  b: CubicBezier3,
  t: number,
): { left: CubicBezier3; right: CubicBezier3 } {
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
