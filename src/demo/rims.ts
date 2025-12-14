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
      // 원뿔 rim은 항상 base 한 개(캡이 없더라도 “기하적 림”은 의미가 있어 세트 규칙으로 추가)
      const baseCenter = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(...circleToCubics3({ center: baseCenter, normal: p.axis, radius: p.baseRadius }));
      continue;
    }
  }

  return out;
}


