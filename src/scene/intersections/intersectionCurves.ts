import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { Vec3 } from "../../math/vec3.js";
import type { Primitive } from "../primitive.js";
import { Sphere } from "../primitives/sphere.js";
import { Cylinder } from "../primitives/cylinder.js";
import { Cone } from "../primitives/cone.js";
import { PlaneRect } from "../primitives/planeRect.js";
import { Disk } from "../primitives/disk.js";
import { BoxAabb } from "../primitives/boxAabb.js";
import { TriangleMesh } from "../primitives/triangleMesh.js";
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
import {
  planeSurfaceCurvesToOwnedCubics,
  type OwnedCubic3 as OwnedPlaneSurfaceCubic3,
} from "./planeSurfaceCurves.js";
import { intersectDiskPlaneRect } from "./diskPlaneRect.js";
import { intersectPlaneRectBoxAabb } from "./planeRectBoxAabb.js";
import { intersectBoxAabbBoxAabb } from "./boxBoxAabb.js";
import {
  intersectBoxAabbSphereOwned,
  intersectBoxAabbCylinderOwned,
  intersectBoxAabbConeOwned,
} from "./boxCurvedIntersections.js";

export type IntersectionCurveOptions = {
  angularSamples: number; // e.g. 128
  useBezierFit?: boolean; // default: true
  fitMode?: "perRun" | "stitchThenFit"; // default: "stitchThenFit"
};

export type OwnedIntersectionCubic3 = {
  bez: CubicBezier3;
  ignorePrimitiveIds: readonly string[];
};

type CachedIntersections = {
  fingerprint: string;
  curves: readonly OwnedIntersectionCubic3[];
};

// Scene arrays own their entries weakly. Retain only a few parameter variants,
// even if a caller continuously changes geometry or sampling settings.
const intersectionCache = new WeakMap<
  readonly Primitive[],
  CachedIntersections[]
>();
const MAX_CACHED_VARIANTS = 4;
const CACHEABLE_PRIMITIVES = [
  Sphere,
  Cylinder,
  Cone,
  PlaneRect,
  Disk,
  BoxAabb,
  TriangleMesh,
].map((type) => ({ type, intersect: type.prototype.intersect }));

/**
 * Reuse camera-independent intersections while the primitive values and
 * intersection options match. Results are deeply frozen; the uncached API
 * remains available when the caller needs to edit the generated curves.
 */
export function cachedIntersectionCurvesToOwnedCubics(
  primitives: readonly Primitive[],
  opts: IntersectionCurveOptions,
): readonly OwnedIntersectionCubic3[] {
  const geometry = intersectionGeometrySignature(primitives);
  if (geometry === undefined || !Number.isFinite(opts.angularSamples))
    return freezeOwnedIntersections(
      intersectionCurvesToOwnedCubics(primitives, opts),
    );
  const fingerprint = `${JSON.stringify([opts.angularSamples, opts.useBezierFit ?? true, opts.fitMode ?? "stitchThenFit"])}|${geometry}`;
  const entries = intersectionCache.get(primitives);
  const index =
    entries?.findIndex((entry) => entry.fingerprint === fingerprint) ?? -1;
  if (entries && index >= 0) {
    const entry = entries[index]!;
    // Keep the most recently used variant at the front.
    if (index > 0) {
      entries.splice(index, 1);
      entries.unshift(entry);
    }
    return entry.curves;
  }

  const curves = freezeOwnedIntersections(
    intersectionCurvesToOwnedCubics(primitives, opts),
  );
  const updated = entries ?? [];
  updated.unshift({ fingerprint, curves });
  if (updated.length > MAX_CACHED_VARIANTS) updated.pop();
  if (!entries) intersectionCache.set(primitives, updated);
  return curves;
}

/** A value signature for built-in geometry, or undefined when caching is unsafe. */
export function intersectionGeometrySignature(
  primitives: readonly Primitive[],
): string | undefined {
  const vector = (v: Vec3) => [v.x, v.y, v.z];
  const geometry: unknown[] = [];
  for (const p of primitives) {
    const builtin = CACHEABLE_PRIMITIVES.find(
      ({ type }) => Object.getPrototypeOf(p) === type.prototype,
    );
    // Arbitrary implementations can depend on state unavailable to this module.
    if (!builtin || p.intersect !== builtin.intersect) return undefined;
    if (p instanceof Sphere)
      geometry.push(["sphere", p.id, vector(p.center), p.radius]);
    else if (p instanceof Cylinder)
      geometry.push([
        "cylinder",
        p.id,
        vector(p.base),
        vector(p.axis),
        p.height,
        p.radius,
        p.caps,
      ]);
    else if (p instanceof Cone)
      geometry.push([
        "cone",
        p.id,
        vector(p.apex),
        vector(p.axis),
        p.height,
        p.baseRadius,
        p.k,
        p.cap,
      ]);
    else if (p instanceof PlaneRect)
      geometry.push([
        "rect",
        p.id,
        vector(p.center),
        vector(p.normal),
        vector(p.u),
        vector(p.v),
        p.halfWidth,
        p.halfHeight,
      ]);
    else if (p instanceof Disk)
      geometry.push([
        "disk",
        p.id,
        vector(p.center),
        vector(p.normal),
        p.radius,
      ]);
    else if (p instanceof BoxAabb)
      geometry.push(["box", p.id, vector(p.min), vector(p.max)]);
    else if (p instanceof TriangleMesh)
      geometry.push([
        "mesh",
        p.id,
        p.vertices.map(vector),
        p.triangles,
        vector(p.bounds.min),
        vector(p.bounds.max),
        p.weldEps,
      ]);
  }
  let finite = true;
  const signature = JSON.stringify(geometry, (_key, value: unknown) => {
    if (typeof value === "number" && !Number.isFinite(value)) finite = false;
    return value;
  });
  return finite ? signature : undefined;
}

function freezeOwnedIntersections(
  curves: readonly OwnedIntersectionCubic3[],
): readonly OwnedIntersectionCubic3[] {
  const points = new Map<Vec3, Vec3>();
  const copyPoint = (p: Vec3): Vec3 => {
    let copy = points.get(p);
    if (!copy) {
      // Endpoints may alias a primitive's position: never freeze input geometry.
      copy = Object.freeze(new Vec3(p.x, p.y, p.z));
      points.set(p, copy);
    }
    return copy;
  };
  return Object.freeze(
    curves.map(({ bez, ignorePrimitiveIds }) =>
      Object.freeze({
        bez: Object.freeze({
          p0: copyPoint(bez.p0),
          p1: copyPoint(bez.p1),
          p2: copyPoint(bez.p2),
          p3: copyPoint(bez.p3),
        }),
        ignorePrimitiveIds: Object.freeze([...ignorePrimitiveIds]),
      }),
    ),
  );
}

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
  const useBezierFit = opts.useBezierFit ?? true;
  const fitMode = opts.fitMode ?? "stitchThenFit";

  // Rims (caps) are also treated as planar disks: when cap disks collide, generate intersection curves (line segments)
  const capDisks = derivedCapDisks(primitives);
  for (let i = 0; i < capDisks.length; i++) {
    for (let j = i + 1; j < capDisks.length; j++) {
      const a = capDisks[i]!;
      const b = capDisks[j]!;
      // Include parent primitive ids so their side surfaces don't occlude the intersection
      const ignorePrimitiveIds = buildIgnorePrimitiveIds([a.id, b.id]);
      out.push(
        ...intersectDiskDisk(a, b).map((bez) => ({ bez, ignorePrimitiveIds })),
      );
    }
  }

  // Generate Rim (cap disk) / PlaneRect (finite plane) × surface intersection curves
  const planeRects = primitives.filter(
    (p): p is PlaneRect => p instanceof PlaneRect,
  );
  const explicitDisks = primitives.filter((p): p is Disk => p instanceof Disk);
  const planeSurfaces: Array<Disk | PlaneRect> = [
    ...capDisks,
    ...explicitDisks,
    ...planeRects,
  ];
  const curved = primitives.filter(
    (p): p is Sphere | Cylinder | Cone =>
      p instanceof Sphere || p instanceof Cylinder || p instanceof Cone,
  );
  out.push(
    ...(planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved, {
      angularSamples: opts.angularSamples,
      useBezierFit,
      fitMode,
    }) as OwnedPlaneSurfaceCubic3[]),
  );

  // Disk (rim) × PlaneRect intersections (plane and rim)
  const allDisks: Disk[] = [...capDisks, ...explicitDisks];
  for (const d of allDisks) {
    for (const r of planeRects) {
      // Include parent primitive id if disk is a cap disk
      const ignorePrimitiveIds = buildIgnorePrimitiveIds([d.id, r.id]);
      out.push(
        ...intersectDiskPlaneRect(d, r, { useBezierFit, fitMode }).map(
          (bez) => ({ bez, ignorePrimitiveIds }),
        ),
      );
    }
  }

  // PlaneRect × BoxAabb intersections (plane and cube)
  const boxes = primitives.filter((p): p is BoxAabb => p instanceof BoxAabb);
  for (const r of planeRects) {
    for (const b of boxes) {
      const ignorePrimitiveIds = [r.id, b.id] as const;
      out.push(
        ...intersectPlaneRectBoxAabb(r, b).map((bez) => ({
          bez,
          ignorePrimitiveIds,
        })),
      );
    }
  }

  // BoxAabb × BoxAabb intersections (cube and cube)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ignorePrimitiveIds = [a.id, b.id] as const;
      out.push(
        ...intersectBoxAabbBoxAabb(a, b).map((bez) => ({
          bez,
          ignorePrimitiveIds,
        })),
      );
    }
  }

  // BoxAabb × Sphere intersections (cube and sphere)
  const spheres = primitives.filter((p): p is Sphere => p instanceof Sphere);
  for (const box of boxes) {
    for (const sphere of spheres) {
      out.push(
        ...intersectBoxAabbSphereOwned(box, sphere, { useBezierFit, fitMode }),
      );
    }
  }

  // BoxAabb × Cylinder intersections (cube and cylinder)
  const cylinders = primitives.filter(
    (p): p is Cylinder => p instanceof Cylinder,
  );
  for (const box of boxes) {
    for (const cyl of cylinders) {
      out.push(
        ...intersectBoxAabbCylinderOwned(box, cyl, { useBezierFit, fitMode }),
      );
    }
  }

  // BoxAabb × Cone intersections (cube and cone)
  const cones = primitives.filter((p): p is Cone => p instanceof Cone);
  for (const box of boxes) {
    for (const cone of cones) {
      out.push(
        ...intersectBoxAabbConeOwned(box, cone, { useBezierFit, fitMode }),
      );
    }
  }

  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const a = primitives[i]!;
      const b = primitives[j]!;
      const ignorePrimitiveIds = [a.id, b.id] as const;

      if (a instanceof Sphere && b instanceof Sphere) {
        out.push(
          ...intersectSphereSphere(a, b).map((bez) => ({
            bez,
            ignorePrimitiveIds,
          })),
        );
        continue;
      }
      if (a instanceof Sphere && b instanceof Cylinder) {
        out.push(
          ...intersectSphereCylinder(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (b instanceof Sphere && a instanceof Cylinder) {
        out.push(
          ...intersectSphereCylinder(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (a instanceof Sphere && b instanceof Cone) {
        out.push(
          ...intersectSphereCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (b instanceof Sphere && a instanceof Cone) {
        out.push(
          ...intersectSphereCone(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cylinder) {
        out.push(
          ...intersectCylinderCylinder(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cone) {
        out.push(
          ...intersectCylinderCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (b instanceof Cylinder && a instanceof Cone) {
        out.push(
          ...intersectCylinderCone(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (a instanceof Cone && b instanceof Cone) {
        out.push(
          ...intersectConeCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode,
          ).map((bez) => ({ bez, ignorePrimitiveIds })),
        );
        continue;
      }
      if (a instanceof PlaneRect && b instanceof PlaneRect) {
        out.push(
          ...intersectPlaneRectPlaneRect(a, b).map((bez) => ({
            bez,
            ignorePrimitiveIds,
          })),
        );
        continue;
      }
    }
  }

  return out;
}

/**
 * Build ignorePrimitiveIds array, expanding cap disk ids to include their parent primitive.
 * E.g., ["cone1:cap:base", "cone2"] → ["cone1:cap:base", "cone2", "cone1"]
 */
function buildIgnorePrimitiveIds(ids: readonly string[]): readonly string[] {
  const out = new Set(ids);
  for (const id of ids) {
    const parentId = getCapDiskParentId(id);
    if (parentId) out.add(parentId);
  }
  return [...out];
}

/** Extract parent primitive id from cap disk id (e.g., "cone1:cap:base" → "cone1"), or null if not a cap disk */
function getCapDiskParentId(diskId: string): string | null {
  const capIdx = diskId.indexOf(":cap:");
  if (capIdx < 0) return null;
  return diskId.slice(0, capIdx);
}
