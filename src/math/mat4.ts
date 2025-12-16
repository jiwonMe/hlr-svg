import { EPS } from "./eps.js";
import { Vec3 } from "./vec3.js";

export type Vec4 = readonly [number, number, number, number];

export class Mat4 {
  // column-major 4x4
  constructor(public readonly m: readonly number[]) {
    if (m.length !== 16) throw new Error("Mat4 requires 16 numbers");
  }

  static identity(): Mat4 {
    return new Mat4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static mul(a: Mat4, b: Mat4): Mat4 {
    const am = a.m, bm = b.m;
    const r = new Array<number>(16).fill(0);
    for (let c = 0; c < 4; c++) {
      for (let rRow = 0; rRow < 4; rRow++) {
        r[c * 4 + rRow] =
          am[0 * 4 + rRow]! * bm[c * 4 + 0]! +
          am[1 * 4 + rRow]! * bm[c * 4 + 1]! +
          am[2 * 4 + rRow]! * bm[c * 4 + 2]! +
          am[3 * 4 + rRow]! * bm[c * 4 + 3]!;
      }
    }
    return new Mat4(r);
  }

  static mulVec4(a: Mat4, v: Vec4): Vec4 {
    const m = a.m;
    const x = v[0], y = v[1], z = v[2], w = v[3];
    return [
      m[0]! * x + m[4]! * y + m[8]! * z + m[12]! * w,
      m[1]! * x + m[5]! * y + m[9]! * z + m[13]! * w,
      m[2]! * x + m[6]! * y + m[10]! * z + m[14]! * w,
      m[3]! * x + m[7]! * y + m[11]! * z + m[15]! * w,
    ];
  }

  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const f = Vec3.normalize(Vec3.sub(target, eye));
    const s = Vec3.normalize(Vec3.cross(f, up));
    const u = Vec3.cross(s, f);

    // OpenGL-style view matrix (right-handed), camera looks down -Z in view space
    const tx = -Vec3.dot(s, eye);
    const ty = -Vec3.dot(u, eye);
    const tz = Vec3.dot(f, eye);

    return new Mat4([
      s.x, u.x, -f.x, 0,
      s.y, u.y, -f.y, 0,
      s.z, u.z, -f.z, 0,
      tx, ty, tz, 1,
    ]);
  }

  static perspective(fovYRad: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovYRad / 2);
    const nf = 1 / (near - far);
    return new Mat4([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0,
    ]);
  }

  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const rl = right - left;
    const tb = top - bottom;
    const fn = far - near;
    if (Math.abs(rl) <= EPS || Math.abs(tb) <= EPS || Math.abs(fn) <= EPS) {
      throw new Error("Invalid ortho volume");
    }
    return new Mat4([
      2 / rl, 0, 0, 0,
      0, 2 / tb, 0, 0,
      0, 0, -2 / fn, 0,
      -(right + left) / rl, -(top + bottom) / tb, -(far + near) / fn, 1,
    ]);
  }

  static inverse(a: Mat4): Mat4 | null {
    const m = a.m;
    const [
      m00, m01, m02, m03,
      m10, m11, m12, m13,
      m20, m21, m22, m23,
      m30, m31, m32, m33,
    ] = m as unknown as number[];

    const b00 = m00! * m11! - m01! * m10!;
    const b01 = m00! * m12! - m02! * m10!;
    const b02 = m00! * m13! - m03! * m10!;
    const b03 = m01! * m12! - m02! * m11!;
    const b04 = m01! * m13! - m03! * m11!;
    const b05 = m02! * m13! - m03! * m12!;
    const b06 = m20! * m31! - m21! * m30!;
    const b07 = m20! * m32! - m22! * m30!;
    const b08 = m20! * m33! - m23! * m30!;
    const b09 = m21! * m32! - m22! * m31!;
    const b10 = m21! * m33! - m23! * m31!;
    const b11 = m22! * m33! - m23! * m32!;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < EPS) return null;
    det = 1 / det;

    return new Mat4([
      (m11! * b11 - m12! * b10 + m13! * b09) * det,
      (m02! * b10 - m01! * b11 - m03! * b09) * det,
      (m31! * b05 - m32! * b04 + m33! * b03) * det,
      (m22! * b04 - m21! * b05 - m23! * b03) * det,
      (m12! * b08 - m10! * b11 - m13! * b07) * det,
      (m00! * b11 - m02! * b08 + m03! * b07) * det,
      (m32! * b02 - m30! * b05 - m33! * b01) * det,
      (m20! * b05 - m22! * b02 + m23! * b01) * det,
      (m10! * b10 - m11! * b08 + m13! * b06) * det,
      (m01! * b08 - m00! * b10 - m03! * b06) * det,
      (m30! * b04 - m31! * b02 + m33! * b00) * det,
      (m21! * b02 - m20! * b04 - m23! * b00) * det,
      (m11! * b07 - m10! * b09 - m12! * b06) * det,
      (m00! * b09 - m01! * b07 + m02! * b06) * det,
      (m31! * b01 - m30! * b03 - m32! * b00) * det,
      (m20! * b03 - m21! * b01 + m22! * b00) * det,
    ]);
  }
}


