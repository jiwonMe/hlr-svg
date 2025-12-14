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
}


