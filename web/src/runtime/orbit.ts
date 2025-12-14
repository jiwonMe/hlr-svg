import { Vec3 } from "../../../dist/math/vec3.js";

export type OrbitState = {
  target: Vec3;
  radius: number;
  azimuth: number; // around +Y
  polar: number; // from +Y (0..pi)
};

export function orbitFromCamera(position: Vec3, target: Vec3): OrbitState {
  const v = Vec3.sub(position, target);
  const r = Math.max(1e-6, Math.sqrt(Vec3.lenSq(v)));
  const polar = clamp(1e-3, Math.acos(clamp(-1, v.y / r, 1)), Math.PI - 1e-3);
  const azimuth = Math.atan2(v.x, v.z);
  return { target, radius: r, azimuth, polar };
}

export function orbitPosition(o: OrbitState): Vec3 {
  const sinP = Math.sin(o.polar);
  const x = o.radius * sinP * Math.sin(o.azimuth);
  const z = o.radius * sinP * Math.cos(o.azimuth);
  const y = o.radius * Math.cos(o.polar);
  return Vec3.add(o.target, new Vec3(x, y, z));
}

export function clamp(lo: number, x: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}


