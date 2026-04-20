import { Vec3 } from "../math/vec3.js";
import type { Camera } from "../camera/camera.js";
import type { Hit, Ray } from "./ray.js";
import type { Primitive } from "./primitive.js";
import type { Profiler } from "../core/profiler.js";

export type RaycastOptions = {
  tMin?: number;
  tMax?: number;
  ignorePrimitiveId?: string;
  ignorePrimitiveIds?: readonly string[];
};

export class Scene {
  constructor(
    public readonly primitives: readonly Primitive[],
    public readonly camera: Camera,
    public readonly profiler?: Profiler,
  ) {}

  raycastClosest(ray: Ray, opts: RaycastOptions = {}): Hit | null {
    const prof = this.profiler;
    if (prof) {
      prof.inc("raycastClosest.calls");
      prof.begin("raycastClosest.ms");
    }
    const tMin = opts.tMin ?? 0;
    const tMax = opts.tMax ?? Number.POSITIVE_INFINITY;
    let closest: Hit | null = null;
    let bestT = tMax;

    for (const p of this.primitives) {
      if (opts.ignorePrimitiveId && p.id === opts.ignorePrimitiveId) continue;
      if (opts.ignorePrimitiveIds && opts.ignorePrimitiveIds.includes(p.id))
        continue;
      if (prof) prof.inc("primitive.intersect.calls");
      const h = p.intersect(ray, tMin, bestT);
      if (!h) continue;
      if (h.t < bestT) {
        bestT = h.t;
        closest = h;
      }
    }
    if (prof) prof.end("raycastClosest.ms");
    return closest;
  }

  visibleAtPoint(
    worldPoint: Vec3,
    opts?: { eps?: number; ignorePrimitiveIds?: readonly string[] },
  ): boolean {
    const prof = this.profiler;
    if (prof) {
      prof.inc("visibleAtPoint.calls");
      prof.begin("visibleAtPoint.ms");
    }
    try {
      const epsAbs = opts?.eps ?? 2e-4;

      if (this.camera.kind === "perspective") {
        const origin = this.camera.position;
        const dir = Vec3.normalize(Vec3.sub(worldPoint, origin));
        const targetDist = Vec3.distance(worldPoint, origin);
        const rayGap = visibilityRayGap(epsAbs, origin, worldPoint);
        const ray: Ray = { origin, dir };
        // Check only slightly before targetDist to exclude self-hit of "the point itself"
        const tMax = Math.max(0, targetDist - rayGap);
        const hit = this.raycastClosest(ray, {
          tMin: 0,
          tMax,
          ignorePrimitiveId: undefined,
          // For owned intersection curves we still raycast against participating
          // primitives so true self-occlusion remains possible; we only forgive
          // hits that are very close to the target point.
          ignorePrimitiveIds: undefined,
        });
        if (hit === null) return true;

        const gapToTarget = Math.max(0, targetDist - hit.t);
        const allow = opts?.ignorePrimitiveIds;
        if (!allow) {
          if (isHitNearTarget(hit.point, worldPoint, gapToTarget, rayGap))
            return true;
        } else if (allow.includes(hit.primitiveId)) {
          const snap = intersectionNearbyHitSnap(
            epsAbs,
            origin,
            worldPoint,
            hit.point,
          );
          if (isHitNearTarget(hit.point, worldPoint, gapToTarget, snap))
            return true;
        }
        return false;
      }

      // orthographic: parallel ray along viewDir
      const viewDir = Vec3.normalize(this.camera.forward);
      const raySpan = Math.max(this.camera.far, epsAbs * 2);
      const origin = Vec3.sub(worldPoint, Vec3.mulScalar(viewDir, raySpan));
      const dir = viewDir;
      const ray: Ray = { origin, dir };
      const targetDist = raySpan;
      const rayGap = visibilityRayGap(epsAbs, origin, worldPoint);
      const tMax = Math.max(0, targetDist - rayGap);
      const hit = this.raycastClosest(ray, {
        tMin: 0,
        tMax,
        ignorePrimitiveId: undefined,
        ignorePrimitiveIds: undefined,
      });
      if (hit === null) return true;
      const gapToTarget = Math.max(0, targetDist - hit.t);
      const allow = opts?.ignorePrimitiveIds;
      if (!allow) {
        if (isHitNearTarget(hit.point, worldPoint, gapToTarget, rayGap))
          return true;
      } else if (allow.includes(hit.primitiveId)) {
        const snap = intersectionNearbyHitSnap(
          epsAbs,
          origin,
          worldPoint,
          hit.point,
        );
        if (isHitNearTarget(hit.point, worldPoint, gapToTarget, snap))
          return true;
      }
      return false;
    } finally {
      if (prof) prof.end("visibleAtPoint.ms");
    }
  }
}

function visibilityRayGap(epsAbs: number, ...points: Vec3[]): number {
  return Math.max(epsAbs, floatingPointTolerance(points, 64));
}

function intersectionNearbyHitSnap(epsAbs: number, ...points: Vec3[]): number {
  // Owned intersection curves are Bezier fits over sampled surface points, so
  // the represented point can drift more than a plain visibility epsilon while
  // still being on the same local participant surface.
  return Math.max(epsAbs * 24, floatingPointTolerance(points, 512));
}

function isHitNearTarget(
  hitPoint: Vec3,
  worldPoint: Vec3,
  gapToTarget: number,
  snap: number,
): boolean {
  if (Vec3.distanceSq(hitPoint, worldPoint) <= snap * snap) return true;
  return gapToTarget <= snap;
}

function floatingPointTolerance(points: readonly Vec3[], ulps: number): number {
  let scale = 1;
  for (const p of points) {
    scale = Math.max(scale, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  }
  return scale * Number.EPSILON * ulps;
}
