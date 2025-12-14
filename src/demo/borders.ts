import { Vec3 } from "../math/vec3.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import { lineToCubic3 } from "../curves/builders.js";
import type { Primitive } from "../scene/primitive.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";

export function bordersForPrimitives(primitives: readonly Primitive[]): CubicBezier3[] {
  const out: CubicBezier3[] = [];

  for (const p of primitives) {
    if (p instanceof PlaneRect) {
      out.push(...planeRectBorderCubics(p));
    }
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

  return [
    lineToCubic3(p00, p10),
    lineToCubic3(p10, p11),
    lineToCubic3(p11, p01),
    lineToCubic3(p01, p00),
  ];
}


