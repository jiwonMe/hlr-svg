import { Vec3 } from "@hlr/math/vec3.js";

/** Plain tuples keep the editor document serialisable. */
export type Tuple3 = readonly [number, number, number];

/** Row-major 3×3 matrix. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const ZERO: Tuple3 = [0, 0, 0];
const DEG = Math.PI / 180;

export function vec(t: Tuple3): Vec3 {
  return new Vec3(t[0], t[1], t[2]);
}

export function tuple(v: Vec3): Tuple3 {
  return [v.x, v.y, v.z];
}

export function add3(a: Tuple3, b: Tuple3): Tuple3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale3(a: Tuple3, k: number): Tuple3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export function mulMat(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out.push(
        a[r * 3]! * b[c]! +
          a[r * 3 + 1]! * b[3 + c]! +
          a[r * 3 + 2]! * b[6 + c]!,
      );
  return out as unknown as Mat3;
}

export function applyMat(m: Mat3, v: Tuple3): Tuple3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Rotations about the world X, then Y, then Z axes, in degrees. */
export function eulerToMatrix(rotation: Tuple3): Mat3 {
  const [x, y, z] = rotation.map((value) => value * DEG) as [
    number,
    number,
    number,
  ];
  const cx = Math.cos(x),
    sx = Math.sin(x),
    cy = Math.cos(y),
    sy = Math.sin(y),
    cz = Math.cos(z),
    sz = Math.sin(z);
  // R = Rz · Ry · Rx
  return [
    cy * cz,
    sx * sy * cz - cx * sz,
    cx * sy * cz + sx * sz,
    cy * sz,
    sx * sy * sz + cx * cz,
    cx * sy * sz - sx * cz,
    -sy,
    sx * cy,
    cx * cy,
  ];
}

export function matrixToEuler(m: Mat3): Tuple3 {
  const sy = -m[6];
  let x: number, y: number, z: number;
  if (Math.abs(sy) < 0.999999) {
    y = Math.asin(sy);
    x = Math.atan2(m[7], m[8]);
    z = Math.atan2(m[3], m[0]);
  } else {
    // Gimbal lock: fold Z into X.
    y = (Math.PI / 2) * Math.sign(sy);
    z = 0;
    x = Math.atan2(sy * m[1], m[4]);
  }
  return [x, y, z].map((value) =>
    clean(value / DEG, 1e-9),
  ) as unknown as Tuple3;
}

/**
 * Every rotation has two XYZ Euler forms; pick the one closest to `near` so a
 * turn about Y reads as (0, 105, 0) rather than the equal (180, 75, 180).
 */
export function matrixToEulerNear(m: Mat3, near: Tuple3): Tuple3 {
  const a = matrixToEuler(m);
  const b: Tuple3 = [a[0] + 180, 180 - a[1], a[2] + 180];
  const unwrap = (c: Tuple3): Tuple3 =>
    c.map((value, i) => {
      const diff = ((((value - near[i]!) % 360) + 540) % 360) - 180;
      return clean(near[i]! + diff, 1e-9);
    }) as unknown as Tuple3;
  const cost = (c: Tuple3) =>
    c.reduce((sum, value, i) => sum + (value - near[i]!) ** 2, 0);
  const ua = unwrap(a);
  const ub = unwrap(b);
  return cost(ua) <= cost(ub) ? ua : ub;
}

/** Rodrigues rotation about a unit axis. */
export function axisAngleMatrix(axis: Tuple3, degrees: number): Mat3 {
  const a = degrees * DEG;
  const c = Math.cos(a),
    s = Math.sin(a),
    t = 1 - c;
  const [x, y, z] = axis;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}

/** Rounds away floating noise such as 89.99999999 or -0. */
export function clean(value: number, epsilon = 1e-7): number {
  const rounded = Math.round(value);
  const v = Math.abs(value - rounded) < epsilon ? rounded : value;
  return Object.is(v, -0) ? 0 : v;
}

export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return clean(Math.round(value / step) * step, 1e-9);
}

/** Short, stable decimal text for inputs and generated code. */
export function formatNumber(value: number, digits = 3): string {
  const fixed = clean(value).toFixed(digits);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

export function isRightAngleRotation(rotation: Tuple3): boolean {
  return rotation.every(
    (value) => Math.abs(value / 90 - Math.round(value / 90)) < 1e-6,
  );
}
