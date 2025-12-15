import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { BoxAabb } from "../primitives/boxAabb.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { boxFacesAsPlaneRects } from "./boxBoxAabb.js";
import { planeSurfaceCurvesToOwnedCubics, type OwnedCubic3 } from "./planeSurfaceCurves.js";

export type BoxCurvedIntersectionOptions = {
  useBezierFit?: boolean;
  fitMode?: "perRun" | "stitchThenFit";
};

export function intersectBoxAabbSphere(
  box: BoxAabb,
  sphere: Sphere,
  opts?: BoxCurvedIntersectionOptions,
): CubicBezier3[] {
  return intersectBoxAabbSphereOwned(box, sphere, opts).map((x) => x.bez);
}

export function intersectBoxAabbSphereOwned(
  box: BoxAabb,
  sphere: Sphere,
  opts?: BoxCurvedIntersectionOptions,
): OwnedCubic3[] {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [sphere] as const;
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);

  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, sphere.id] as readonly string[],
  }));
}

export function intersectBoxAabbCylinder(
  box: BoxAabb,
  cyl: Cylinder,
  opts?: BoxCurvedIntersectionOptions,
): CubicBezier3[] {
  return intersectBoxAabbCylinderOwned(box, cyl, opts).map((x) => x.bez);
}

export function intersectBoxAabbCylinderOwned(
  box: BoxAabb,
  cyl: Cylinder,
  opts?: BoxCurvedIntersectionOptions,
): OwnedCubic3[] {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [cyl] as const;
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);

  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, cyl.id] as readonly string[],
  }));
}

export function intersectBoxAabbCone(
  box: BoxAabb,
  cone: Cone,
  opts?: BoxCurvedIntersectionOptions,
): CubicBezier3[] {
  return intersectBoxAabbConeOwned(box, cone, opts).map((x) => x.bez);
}

export function intersectBoxAabbConeOwned(
  box: BoxAabb,
  cone: Cone,
  opts?: BoxCurvedIntersectionOptions,
): OwnedCubic3[] {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [cone] as const;
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);

  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, cone.id] as readonly string[],
  }));
}

