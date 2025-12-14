import type { Camera } from "../camera/camera.js";
import { Vec3 } from "../math/vec3.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import {
  circleToCubics3,
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "../curves/builders.js";
import type { Primitive } from "../scene/primitive.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";
import { Cone } from "../scene/primitives/cone.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Disk } from "../scene/primitives/disk.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import { Sphere } from "../scene/primitives/sphere.js";

export type CurveInclude = {
  silhouettes?: boolean; // default: true
  rims?: boolean; // default: true
  borders?: boolean; // default: true
  boxEdges?: boolean; // default: true
};

export function defaultCurveInclude(): Required<CurveInclude> {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
  };
}

export function curvesFromPrimitives(
  primitives: readonly Primitive[],
  camera: Camera,
  include: CurveInclude = {},
): CubicBezier3[] {
  const inc = { ...defaultCurveInclude(), ...include };
  const out: CubicBezier3[] = [];

  if (inc.silhouettes) out.push(...silhouettesForPrimitives(primitives, camera));
  if (inc.rims) out.push(...rimsForPrimitives(primitives));
  if (inc.borders) out.push(...bordersForPrimitives(primitives));
  if (inc.boxEdges) out.push(...boxEdgesForPrimitives(primitives));

  return out;
}

export function silhouettesForPrimitives(primitives: readonly Primitive[], camera: Camera): CubicBezier3[] {
  const out: CubicBezier3[] = [];

  for (const p of primitives) {
    if (p instanceof Sphere) {
      out.push(...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: p.center, radius: p.radius }));
      continue;
    }
    if (p instanceof Cylinder) {
      out.push(
        ...cylinderSilhouetteToCubics3({
          cameraPos: camera.position,
          base: p.base,
          axis: p.axis,
          height: p.height,
          radius: p.radius,
        }),
      );
      continue;
    }
    if (p instanceof Cone) {
      out.push(
        ...coneSilhouetteToCubics3({
          cameraPos: camera.position,
          apex: p.apex,
          axis: p.axis,
          height: p.height,
          baseRadius: p.baseRadius,
        }),
      );
      continue;
    }
  }

  return out;
}

export function rimsForPrimitives(primitives: readonly Primitive[]): CubicBezier3[] {
  const out: CubicBezier3[] = [];

  for (const p of primitives) {
    if (p instanceof Cylinder) {
      // 원기둥 rim은 항상 base/top 두 개를 세트로
      out.push(...circleToCubics3({ center: p.base, normal: p.axis, radius: p.radius }));
      out.push(
        ...circleToCubics3({
          center: Vec3.add(p.base, Vec3.mulScalar(p.axis, p.height)),
          normal: p.axis,
          radius: p.radius,
        }),
      );
      continue;
    }

    if (p instanceof Cone) {
      // 원뿔 rim은 항상 base 한 개
      const baseCenter = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(...circleToCubics3({ center: baseCenter, normal: p.axis, radius: p.baseRadius }));
      continue;
    }

    if (p instanceof Disk) {
      out.push(...circleToCubics3({ center: p.center, normal: p.normal, radius: p.radius }));
      continue;
    }
  }

  return out;
}

export function bordersForPrimitives(primitives: readonly Primitive[]): CubicBezier3[] {
  const out: CubicBezier3[] = [];

  for (const p of primitives) {
    if (p instanceof PlaneRect) out.push(...planeRectBorderCubics(p));
  }

  return out;
}

function planeRectBorderCubics(r: PlaneRect): CubicBezier3[] {
  const ux = Vec3.mulScalar(r.u, r.halfWidth);
  const vy = Vec3.mulScalar(r.v, r.halfHeight);

  const c = r.center;
  const p00 = Vec3.sub(Vec3.sub(c, ux), vy);
  const p10 = Vec3.add(Vec3.sub(c, vy), ux);
  const p11 = Vec3.add(Vec3.add(c, ux), vy);
  const p01 = Vec3.add(Vec3.sub(c, ux), vy);

  return [lineToCubic3(p00, p10), lineToCubic3(p10, p11), lineToCubic3(p11, p01), lineToCubic3(p01, p00)];
}

export function boxEdgesForPrimitives(primitives: readonly Primitive[]): CubicBezier3[] {
  const out: CubicBezier3[] = [];
  for (const p of primitives) {
    if (p instanceof BoxAabb) out.push(...boxEdgesToCubics3(p));
  }
  return out;
}

function boxEdgesToCubics3(b: BoxAabb): CubicBezier3[] {
  const min = b.min;
  const max = b.max;

  const p000 = new Vec3(min.x, min.y, min.z);
  const p001 = new Vec3(min.x, min.y, max.z);
  const p010 = new Vec3(min.x, max.y, min.z);
  const p011 = new Vec3(min.x, max.y, max.z);
  const p100 = new Vec3(max.x, min.y, min.z);
  const p101 = new Vec3(max.x, min.y, max.z);
  const p110 = new Vec3(max.x, max.y, min.z);
  const p111 = new Vec3(max.x, max.y, max.z);

  return [
    // bottom rect
    lineToCubic3(p000, p100),
    lineToCubic3(p100, p101),
    lineToCubic3(p101, p001),
    lineToCubic3(p001, p000),
    // top rect
    lineToCubic3(p010, p110),
    lineToCubic3(p110, p111),
    lineToCubic3(p111, p011),
    lineToCubic3(p011, p010),
    // verticals
    lineToCubic3(p000, p010),
    lineToCubic3(p100, p110),
    lineToCubic3(p101, p111),
    lineToCubic3(p001, p011),
  ];
}

