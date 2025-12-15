import { EPS } from "../math/eps.js";
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
      if (opts.ignorePrimitiveIds && opts.ignorePrimitiveIds.includes(p.id)) continue;
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

  visibleAtPoint(worldPoint: Vec3, opts?: { eps?: number; ignorePrimitiveIds?: readonly string[] }): boolean {
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
        const eps = Math.max(epsAbs, targetDist * 1e-6);
        const ray: Ray = { origin, dir };
        // Check only slightly before targetDist to exclude self-hit of "the point itself"
        const tMax = Math.max(0, targetDist - eps * 10);
        const hit = this.raycastClosest(ray, {
          tMin: 0,
          tMax,
          ignorePrimitiveId: undefined,
          // NOTE: In intersection visibility, "ignoring entire participating primitives"
          //       would also release true self-occlusion.
          //       So raycast targets all, and post-filters hit results.
          ignorePrimitiveIds: undefined,
        });
        if (hit === null) return true;

        // Mitigates cases where hits occurring "very close to target point (intersection)" due to
        // intersection/tangent/numerical errors are mistaken for occluders, causing solid lines to become dashed.
        // Important: don't ignore entire primitives, only ignore "nearby hits"
        const snap = Math.max(epsAbs * 8, targetDist * 2e-6);
        const allow = opts?.ignorePrimitiveIds;
        // If ignore list doesn't exist, we still treat "nearby hits" as noise (self-hit / numeric)
        if (!allow) {
          if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) return true;
          // Also allow small along-ray tolerance: point distance can be inflated by tiny angular error.
          if (hit.t >= tMax - snap * 2) return true;
        } else if (allow.includes(hit.primitiveId)) {
          // Intersection curves: for participating primitives, ignore only "nearby" hits.
          if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) return true;
          if (hit.t >= tMax - snap * 2) return true;
        }
        return false;
      }

      // orthographic: parallel ray along viewDir
      const viewDir = Vec3.normalize(this.camera.forward);
      const far = 1e6;
      const origin = Vec3.sub(worldPoint, Vec3.mulScalar(viewDir, far));
      const dir = viewDir;
      const ray: Ray = { origin, dir };
      const targetDist = far;
      const tMax = Math.max(0, targetDist - epsAbs);
      const hit = this.raycastClosest(ray, {
        tMin: 0,
        tMax,
        ignorePrimitiveId: undefined,
        ignorePrimitiveIds: undefined,
      });
      if (hit === null) return true;
      const snap = Math.max(epsAbs * 8, 2e-6 * far);
      const allow = opts?.ignorePrimitiveIds;
      if (!allow) {
        if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) return true;
        if (hit.t >= tMax - snap * 2) return true;
      } else if (allow.includes(hit.primitiveId)) {
        if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) return true;
        if (hit.t >= tMax - snap * 2) return true;
      }
      return false;
    } finally {
      if (prof) prof.end("visibleAtPoint.ms");
    }
  }
}


