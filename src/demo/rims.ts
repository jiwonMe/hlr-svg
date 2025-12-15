import { Vec3 } from "../math/vec3.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import { circleToCubics3 } from "../curves/builders.js";
import type { Primitive } from "../scene/primitive.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Cone } from "../scene/primitives/cone.js";

export function rimsForPrimitives(primitives: readonly Primitive[]): CubicBezier3[] {
  const out: CubicBezier3[] = [];

  for (const p of primitives) {
    if (p instanceof Cylinder) {
      // Cylinder rims are always included as a set of base/top
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
      // Cone rim is always base (one) (even if there's no cap, "geometric rim" has meaning, so added as a set rule)
      const baseCenter = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(...circleToCubics3({ center: baseCenter, normal: p.axis, radius: p.baseRadius }));
      continue;
    }
  }

  return out;
}


