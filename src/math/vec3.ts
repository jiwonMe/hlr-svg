import { EPS } from "./eps.js";

export class Vec3 {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
  ) {}

  static zero(): Vec3 {
    return new Vec3(0, 0, 0);
  }

  static add(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  static sub(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static mulScalar(a: Vec3, s: number): Vec3 {
    return new Vec3(a.x * s, a.y * s, a.z * s);
  }

  static dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x,
    );
  }

  static lenSq(a: Vec3): number {
    return Vec3.dot(a, a);
  }

  static len(a: Vec3): number {
    return Math.sqrt(Vec3.lenSq(a));
  }

  static normalize(a: Vec3): Vec3 {
    const l = Vec3.len(a);
    if (l <= EPS) return Vec3.zero();
    return Vec3.mulScalar(a, 1 / l);
  }

  static lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return new Vec3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t,
    );
  }

  static distance(a: Vec3, b: Vec3): number {
    return Vec3.len(Vec3.sub(a, b));
  }

  static distanceSq(a: Vec3, b: Vec3): number {
    return Vec3.lenSq(Vec3.sub(a, b));
  }
}


