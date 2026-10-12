import { EPS } from "../math/eps.js";
import type { Primitive } from "../scene/primitive.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";
import { Cone } from "../scene/primitives/cone.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Disk } from "../scene/primitives/disk.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import type { Vec3 } from "../math/vec3.js";

// Compare against the methods we loaded, rather than a subsequently patched
// prototype. Prototype overrides must follow the generic public raycast path.
const sphereIntersect = Sphere.prototype.intersect;
const cylinderIntersect = Cylinder.prototype.intersect;
const coneIntersect = Cone.prototype.intersect;
const boxIntersect = BoxAabb.prototype.intersect;
const diskIntersect = Disk.prototype.intersect;
const rectIntersect = PlaneRect.prototype.intersect;
const nativeIntersectors = new Map<object, Primitive["intersect"]>([
  [Sphere.prototype, sphereIntersect],
  [Cylinder.prototype, cylinderIntersect],
  [Cone.prototype, coneIntersect],
  [BoxAabb.prototype, boxIntersect],
  [Disk.prototype, diskIntersect],
  [PlaneRect.prototype, rectIntersect],
  [TriangleMesh.prototype, TriangleMesh.prototype.intersect],
]);

/** Built-in pure implementations may be traversed in any pixel/primitive order. */
export function isUnmodifiedNativePrimitive(primitive: Primitive): boolean {
  return (
    nativeIntersectors.get(Object.getPrototypeOf(primitive)) ===
    primitive.intersect
  );
}

function isUnitVector(vector: Vec3): boolean {
  const lengthSq =
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
  return Number.isFinite(lengthSq) && Math.abs(lengthSq - 1) <= 1e-12;
}

function isPerpendicular(a: Vec3, b: Vec3): boolean {
  return Math.abs(a.x * b.x + a.y * b.y + a.z * b.z) <= 1e-12;
}

/** Scratch output shared by raycasts; no per-hit vectors or objects are allocated. */
export type ScalarSurfaceHit = {
  t: number;
  nx: number;
  ny: number;
  nz: number;
};
export type SurfaceWorldBounds = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};
export type PreparedPrimitiveIntersector = {
  bounds: SurfaceWorldBounds;
  intersect: (
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tMin: number,
    tMax: number,
    hit: ScalarSurfaceHit,
  ) => boolean;
};

function normal(hit: ScalarSurfaceHit, x: number, y: number, z: number): void {
  const length = Math.sqrt(x * x + y * y + z * z);
  const inverse = length > EPS ? 1 / length : 0;
  hit.nx = x * inverse;
  hit.ny = y * inverse;
  hit.nz = z * inverse;
}

/**
 * Snapshot an unmodified built-in primitive for allocation-free analytic raycasts.
 * Prepare again after geometry changes. Custom implementations and overridden
 * intersect methods deliberately retain the public Primitive.intersect path.
 * When fixedDirection is supplied, every subsequent ray must use that direction.
 */
export function createPreparedPrimitiveIntersector(
  primitive: Primitive,
  fixedDirection?: Vec3,
): PreparedPrimitiveIntersector | undefined {
  const prototype = Object.getPrototypeOf(primitive);
  if (
    prototype === Sphere.prototype &&
    primitive.intersect === sphereIntersect
  ) {
    const sphere = primitive as Sphere;
    const { x: cx, y: cy, z: cz } = sphere.center;
    const radius = Math.abs(sphere.radius),
      radiusSq = radius * radius;
    const fixedA = fixedDirection
      ? fixedDirection.x ** 2 + fixedDirection.y ** 2 + fixedDirection.z ** 2
      : 0;
    return {
      bounds: {
        minX: cx - radius,
        minY: cy - radius,
        minZ: cz - radius,
        maxX: cx + radius,
        maxY: cy + radius,
        maxZ: cz + radius,
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const x = ox - cx,
          y = oy - cy,
          z = oz - cz;
        const a = fixedDirection ? fixedA : dx * dx + dy * dy + dz * dz;
        const b = 2 * (x * dx + y * dy + z * dz);
        const c = x * x + y * y + z * z - radiusSq;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return false;
        const s = Math.sqrt(disc),
          inv2a = 1 / (2 * a);
        let t = (-b - s) * inv2a;
        if (t < tMin || t > tMax) t = (-b + s) * inv2a;
        if (t <= EPS || t < tMin || t > tMax) return false;
        hit.t = t;
        normal(hit, ox + dx * t - cx, oy + dy * t - cy, oz + dz * t - cz);
        return true;
      },
    };
  }
  if (
    (prototype === Cylinder.prototype &&
      primitive.intersect === cylinderIntersect) ||
    (prototype === Cone.prototype && primitive.intersect === coneIntersect)
  ) {
    const isCone = prototype === Cone.prototype;
    const object = primitive as Cylinder | Cone;
    // Vec3 fields are readonly in TypeScript, but callers can mutate them at
    // runtime. The projected bounds assume an orthonormal axial decomposition.
    if (!isUnitVector(object.axis)) return undefined;
    const origin = isCone ? (object as Cone).apex : (object as Cylinder).base;
    const { x: cx, y: cy, z: cz } = origin;
    const { x: ax, y: ay, z: az } = object.axis;
    const height = object.height;
    const radius = isCone
      ? (object as Cone).baseRadius
      : (object as Cylinder).radius;
    const kSq = isCone ? (object as Cone).k ** 2 : 0;
    const fixedDV = fixedDirection
      ? fixedDirection.x * ax + fixedDirection.y * ay + fixedDirection.z * az
      : 0;
    const fixedPX = fixedDirection ? fixedDirection.x - ax * fixedDV : 0;
    const fixedPY = fixedDirection ? fixedDirection.y - ay * fixedDV : 0;
    const fixedPZ = fixedDirection ? fixedDirection.z - az * fixedDV : 0;
    const fixedA =
      fixedPX * fixedPX +
      fixedPY * fixedPY +
      fixedPZ * fixedPZ -
      kSq * fixedDV * fixedDV;
    const caps = isCone
      ? (object as Cone).cap === "base"
      : (object as Cylinder).caps === "both";
    const tx = cx + ax * height,
      ty = cy + ay * height,
      tz = cz + az * height;
    // Caps admit radius² + 1e-8 in the public implementation.
    const boundRadius = Math.sqrt(radius * radius + (caps ? 1e-8 : 0));
    const rx = boundRadius * Math.sqrt(Math.max(0, 1 - ax * ax));
    const ry = boundRadius * Math.sqrt(Math.max(0, 1 - ay * ay));
    const rz = boundRadius * Math.sqrt(Math.max(0, 1 - az * az));
    return {
      bounds: {
        minX: isCone ? Math.min(cx, tx - rx) : Math.min(cx, tx) - rx,
        minY: isCone ? Math.min(cy, ty - ry) : Math.min(cy, ty) - ry,
        minZ: isCone ? Math.min(cz, tz - rz) : Math.min(cz, tz) - rz,
        maxX: isCone ? Math.max(cx, tx + rx) : Math.max(cx, tx) + rx,
        maxY: isCone ? Math.max(cy, ty + ry) : Math.max(cy, ty) + ry,
        maxZ: isCone ? Math.max(cz, tz + rz) : Math.max(cz, tz) + rz,
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const x = ox - cx,
          y = oy - cy,
          z = oz - cz;
        const dv = fixedDirection ? fixedDV : dx * ax + dy * ay + dz * az;
        const cv = x * ax + y * ay + z * az;
        const px = fixedDirection ? fixedPX : dx - ax * dv;
        const py = fixedDirection ? fixedPY : dy - ay * dv;
        const pz = fixedDirection ? fixedPZ : dz - az * dv;
        const qx = x - ax * cv,
          qy = y - ay * cv,
          qz = z - az * cv;
        const a = fixedDirection
          ? fixedA
          : px * px + py * py + pz * pz - kSq * dv * dv;
        const b = 2 * (qx * px + qy * py + qz * pz - kSq * cv * dv);
        const c =
          qx * qx +
          qy * qy +
          qz * qz -
          kSq * cv * cv -
          (isCone ? 0 : radius * radius);
        let best = tMax,
          found = false;
        if (isCone ? Math.abs(a) > EPS : a > EPS) {
          const disc = b * b - 4 * a * c;
          if (disc >= 0) {
            const s = Math.sqrt(disc),
              inv2a = 1 / (2 * a);
            for (let root = 0; root < 2; root++) {
              const t = (-b + (root === 0 ? -s : s)) * inv2a;
              if (t <= EPS || t < tMin || t > best) continue;
              const hx = ox + dx * t,
                hy = oy + dy * t,
                hz = oz + dz * t;
              const vx = hx - cx,
                vy = hy - cy,
                vz = hz - cz;
              const h = vx * ax + vy * ay + vz * az;
              if (h < 0 || h > height) continue;
              best = t;
              found = true;
              hit.t = t;
              if (isCone)
                normal(
                  hit,
                  2 * (vx - ax * h) - 2 * kSq * h * ax,
                  2 * (vy - ay * h) - 2 * kSq * h * ay,
                  2 * (vz - az * h) - 2 * kSq * h * az,
                );
              else
                normal(
                  hit,
                  hx - (cx + ax * h),
                  hy - (cy + ay * h),
                  hz - (cz + az * h),
                );
            }
          }
        }
        if (caps && Math.abs(dv) > EPS) {
          for (let cap = isCone ? 1 : 0; cap < 2; cap++) {
            const bx = cap === 0 ? cx : tx,
              by = cap === 0 ? cy : ty,
              bz = cap === 0 ? cz : tz;
            const t = ((bx - ox) * ax + (by - oy) * ay + (bz - oz) * az) / dv;
            if (t <= EPS || t < tMin || t > best || (found && t >= best))
              continue;
            const vx = ox + dx * t - bx,
              vy = oy + dy * t - by,
              vz = oz + dz * t - bz;
            if (vx * vx + vy * vy + vz * vz > radius * radius + 1e-8) continue;
            best = t;
            found = true;
            hit.t = t;
            const sign = dv < 0 ? 1 : -1;
            hit.nx = sign * ax;
            hit.ny = sign * ay;
            hit.nz = sign * az;
          }
        }
        return found;
      },
    };
  }
  if (prototype === BoxAabb.prototype && primitive.intersect === boxIntersect) {
    const box = primitive as BoxAabb;
    const { x: minX, y: minY, z: minZ } = box.min;
    const { x: maxX, y: maxY, z: maxZ } = box.max;
    const minima = [minX, minY, minZ],
      maxima = [maxX, maxY, maxZ];
    return {
      bounds: { minX, minY, minZ, maxX, maxY, maxZ },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        let enter = -Infinity,
          exit = Infinity,
          enterAxis = -1,
          exitAxis = -1,
          enterSign = 0,
          exitSign = 0;
        for (let axis = 0; axis < 3; axis++) {
          const o = axis === 0 ? ox : axis === 1 ? oy : oz;
          const d = axis === 0 ? dx : axis === 1 ? dy : dz;
          if (Math.abs(d) <= EPS) {
            if (o < minima[axis]! || o > maxima[axis]!) return false;
            continue;
          }
          const inverse = 1 / d;
          let near = (minima[axis]! - o) * inverse,
            far = (maxima[axis]! - o) * inverse,
            sign = -1;
          if (near > far) {
            const swap = near;
            near = far;
            far = swap;
            sign = 1;
          }
          if (near > enter) {
            enter = near;
            enterAxis = axis;
            enterSign = sign;
          }
          if (far < exit) {
            exit = far;
            exitAxis = axis;
            exitSign = -sign;
          }
          if (enter > exit) return false;
        }
        const useExit = enter <= EPS || enter < tMin;
        const t = useExit ? exit : enter;
        if (!Number.isFinite(t) || t <= EPS || t < tMin || t > tMax)
          return false;
        const axis = useExit ? exitAxis : enterAxis,
          sign = useExit ? exitSign : enterSign;
        hit.t = t;
        hit.nx = axis === 0 ? sign : 0;
        hit.ny = axis === 1 ? sign : 0;
        hit.nz = axis === 2 ? sign : 0;
        return true;
      },
    };
  }
  if (
    (prototype === Disk.prototype && primitive.intersect === diskIntersect) ||
    (prototype === PlaneRect.prototype && primitive.intersect === rectIntersect)
  ) {
    const isDisk = prototype === Disk.prototype;
    const plane = primitive as Disk | PlaneRect;
    if (!isUnitVector(plane.normal)) return undefined;
    if (!isDisk) {
      const rectangle = plane as PlaneRect;
      if (
        !isUnitVector(rectangle.u) ||
        !isUnitVector(rectangle.v) ||
        !isPerpendicular(rectangle.normal, rectangle.u) ||
        !isPerpendicular(rectangle.normal, rectangle.v) ||
        !isPerpendicular(rectangle.u, rectangle.v)
      )
        return undefined;
    }
    const { x: cx, y: cy, z: cz } = plane.center;
    const { x: nx, y: ny, z: nz } = plane.normal;
    const fixedDenom = fixedDirection
      ? fixedDirection.x * nx + fixedDirection.y * ny + fixedDirection.z * nz
      : 0;
    const rect = isDisk ? undefined : (plane as PlaneRect);
    const ux = rect?.u.x ?? 0,
      uy = rect?.u.y ?? 0,
      uz = rect?.u.z ?? 0;
    const vx = rect?.v.x ?? 0,
      vy = rect?.v.y ?? 0,
      vz = rect?.v.z ?? 0;
    const halfWidth = (rect?.halfWidth ?? 0) + 1e-8,
      halfHeight = (rect?.halfHeight ?? 0) + 1e-8;
    const radiusSq = isDisk ? (plane as Disk).radius ** 2 + 1e-8 : 0;
    const radius = Math.sqrt(radiusSq);
    const rx = isDisk
      ? radius * Math.sqrt(Math.max(0, 1 - nx * nx))
      : Math.abs(ux) * halfWidth + Math.abs(vx) * halfHeight;
    const ry = isDisk
      ? radius * Math.sqrt(Math.max(0, 1 - ny * ny))
      : Math.abs(uy) * halfWidth + Math.abs(vy) * halfHeight;
    const rz = isDisk
      ? radius * Math.sqrt(Math.max(0, 1 - nz * nz))
      : Math.abs(uz) * halfWidth + Math.abs(vz) * halfHeight;
    return {
      bounds: {
        minX: cx - rx,
        minY: cy - ry,
        minZ: cz - rz,
        maxX: cx + rx,
        maxY: cy + ry,
        maxZ: cz + rz,
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const denom = fixedDirection ? fixedDenom : dx * nx + dy * ny + dz * nz;
        if (Math.abs(denom) <= EPS) return false;
        const t = ((cx - ox) * nx + (cy - oy) * ny + (cz - oz) * nz) / denom;
        if (t <= EPS || t < tMin || t > tMax) return false;
        const x = ox + dx * t - cx,
          y = oy + dy * t - cy,
          z = oz + dz * t - cz;
        if (
          isDisk
            ? x * x + y * y + z * z > radiusSq
            : Math.abs(x * ux + y * uy + z * uz) > halfWidth ||
              Math.abs(x * vx + y * vy + z * vz) > halfHeight
        )
          return false;
        const sign = denom < 0 ? 1 : -1;
        hit.t = t;
        hit.nx = sign * nx;
        hit.ny = sign * ny;
        hit.nz = sign * nz;
        return true;
      },
    };
  }
  return undefined;
}
