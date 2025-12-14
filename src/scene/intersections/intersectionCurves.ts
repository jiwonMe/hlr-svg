import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import type { Primitive } from "../primitive.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { PlaneRect } from "../primitives/planeRect.js";
import { Disk } from "../primitives/disk.js";
import { BoxAabb } from "../primitives/boxAabb.js";
import {
  intersectConeCone,
  intersectCylinderCone,
  intersectCylinderCylinder,
  intersectSphereCone,
  intersectSphereCylinder,
  intersectSphereSphere,
} from "./pairs.js";
import { intersectPlaneRectPlaneRect } from "./pairsPlane.js";
import { derivedCapDisks, intersectDiskDisk } from "./capDisks.js";
import { planeSurfaceCurvesToOwnedCubics, type OwnedCubic3 as OwnedPlaneSurfaceCubic3 } from "./planeSurfaceCurves.js";
import { intersectDiskPlaneRect } from "./diskPlaneRect.js";
import { intersectPlaneRectBoxAabb } from "./planeRectBoxAabb.js";
import { intersectBoxAabbBoxAabb } from "./boxBoxAabb.js";

export type IntersectionCurveOptions = {
  angularSamples: number; // e.g. 128
};

export type OwnedIntersectionCubic3 = { bez: CubicBezier3; ignorePrimitiveIds: readonly string[] };

export function intersectionCurvesToCubics(
  primitives: readonly Primitive[],
  opts: IntersectionCurveOptions,
): CubicBezier3[] {
  return intersectionCurvesToOwnedCubics(primitives, opts).map((x) => x.bez);
}

export function intersectionCurvesToOwnedCubics(
  primitives: readonly Primitive[],
  opts: IntersectionCurveOptions,
): OwnedIntersectionCubic3[] {
  const out: OwnedIntersectionCubic3[] = [];

  // Rim(캡)은 평면 디스크로도 취급: cap disk끼리 부딪히면 교선(선분)을 생성
  const capDisks = derivedCapDisks(primitives);
  for (let i = 0; i < capDisks.length; i++) {
    for (let j = i + 1; j < capDisks.length; j++) {
      const a = capDisks[i]!;
      const b = capDisks[j]!;
      const ignorePrimitiveIds = [a.id, b.id] as const;
      out.push(...intersectDiskDisk(a, b).map((bez) => ({ bez, ignorePrimitiveIds })));
    }
  }

  // Rim(캡 디스크) / PlaneRect(유한 평면) × 곡면 교선 생성
  const planeRects = primitives.filter((p): p is PlaneRect => p instanceof PlaneRect);
  const explicitDisks = primitives.filter((p): p is Disk => p instanceof Disk);
  const planeSurfaces: Array<Disk | PlaneRect> = [...capDisks, ...explicitDisks, ...planeRects];
  const curved = primitives.filter((p): p is Sphere | Cylinder | Cone => p instanceof Sphere || p instanceof Cylinder || p instanceof Cone);
  out.push(...planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved) as OwnedPlaneSurfaceCubic3[]);

  // Disk(림) × PlaneRect 교선 (plane과 rim)
  const allDisks: Disk[] = [...capDisks, ...explicitDisks];
  for (const d of allDisks) {
    for (const r of planeRects) {
      const ignorePrimitiveIds = [d.id, r.id] as const;
      out.push(...intersectDiskPlaneRect(d, r).map((bez) => ({ bez, ignorePrimitiveIds })));
    }
  }

  // PlaneRect × BoxAabb 교선 (plane과 cube)
  const boxes = primitives.filter((p): p is BoxAabb => p instanceof BoxAabb);
  for (const r of planeRects) {
    for (const b of boxes) {
      const ignorePrimitiveIds = [r.id, b.id] as const;
      out.push(...intersectPlaneRectBoxAabb(r, b).map((bez) => ({ bez, ignorePrimitiveIds })));
    }
  }

  // BoxAabb × BoxAabb 교선 (cube와 cube)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ignorePrimitiveIds = [a.id, b.id] as const;
      out.push(...intersectBoxAabbBoxAabb(a, b).map((bez) => ({ bez, ignorePrimitiveIds })));
    }
  }

  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const a = primitives[i]!;
      const b = primitives[j]!;
      const ignorePrimitiveIds = [a.id, b.id] as const;

      if (a instanceof Sphere && b instanceof Sphere) {
        out.push(...intersectSphereSphere(a, b).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof Sphere && b instanceof Cylinder) {
        out.push(...intersectSphereCylinder(a, b, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (b instanceof Sphere && a instanceof Cylinder) {
        out.push(...intersectSphereCylinder(b, a, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof Sphere && b instanceof Cone) {
        out.push(...intersectSphereCone(a, b, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (b instanceof Sphere && a instanceof Cone) {
        out.push(...intersectSphereCone(b, a, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cylinder) {
        out.push(...intersectCylinderCylinder(a, b, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cone) {
        out.push(...intersectCylinderCone(a, b, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (b instanceof Cylinder && a instanceof Cone) {
        out.push(...intersectCylinderCone(b, a, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof Cone && b instanceof Cone) {
        out.push(...intersectConeCone(a, b, opts.angularSamples).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
      if (a instanceof PlaneRect && b instanceof PlaneRect) {
        out.push(...intersectPlaneRectPlaneRect(a, b).map((bez) => ({ bez, ignorePrimitiveIds })));
        continue;
      }
    }
  }

  return out;
}


