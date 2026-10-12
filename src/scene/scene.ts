import { Vec3 } from "../math/vec3.js";
import type { Camera } from "../camera/camera.js";
import type { Hit, Ray } from "./ray.js";
import type { Primitive } from "./primitive.js";
import type { Profiler } from "../core/profiler.js";
import {
  createPreparedPrimitiveIntersector,
  type PreparedPrimitiveIntersector,
  type ScalarSurfaceHit,
} from "../core/surfaceKernels.js";

type ClosestScalarHit = ScalarSurfaceHit & {
  px: number;
  py: number;
  pz: number;
  primitiveId: string;
};

export type RaycastOptions = {
  tMin?: number;
  tMax?: number;
  ignorePrimitiveId?: string;
  ignorePrimitiveIds?: readonly string[];
};

export class Scene {
  private readonly prepared?: readonly (
    | PreparedPrimitiveIntersector
    | undefined
  )[];
  private readonly kernelHit: ScalarSurfaceHit = { t: 0, nx: 0, ny: 0, nz: 0 };
  private readonly closestHit: ClosestScalarHit = {
    t: 0,
    nx: 0,
    ny: 0,
    nz: 0,
    px: 0,
    py: 0,
    pz: 0,
    primitiveId: "",
  };
  private visibilityDepth = 0;

  constructor(
    public readonly primitives: readonly Primitive[],
    public readonly camera: Camera,
    public readonly profiler?: Profiler,
    /** Internal render snapshot: rebuild the Scene after geometry changes. */
    preparedGeometry = false,
  ) {
    if (preparedGeometry) {
      const kernels = primitives.map((primitive) =>
        createPreparedPrimitiveIntersector(primitive),
      );
      if (kernels.every((kernel) => kernel !== undefined))
        this.prepared = kernels;
    }
  }

  raycastClosest(ray: Ray, opts: RaycastOptions = {}): Hit | null {
    const prof = this.profiler;
    if (prof) {
      prof.inc("raycastClosest.calls");
      prof.begin("raycastClosest.ms");
    }
    const tMin = opts.tMin ?? 0;
    let bestT = opts.tMax ?? Number.POSITIVE_INFINITY;
    let closest: Hit | null = null;
    for (const primitive of this.primitives) {
      if (opts.ignorePrimitiveId && primitive.id === opts.ignorePrimitiveId)
        continue;
      if (opts.ignorePrimitiveIds?.includes(primitive.id)) continue;
      if (prof) prof.inc("primitive.intersect.calls");
      const hit = primitive.intersect(ray, tMin, bestT);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        closest = hit;
      }
    }
    if (prof) prof.end("raycastClosest.ms");
    return closest;
  }

  private raycastScalar(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    opts: RaycastOptions,
    result: ClosestScalarHit,
  ): boolean {
    const prof = this.profiler;
    if (prof) {
      prof.inc("raycastClosest.calls");
      prof.begin("raycastClosest.ms");
    }
    const tMin = opts.tMin ?? 0;
    let bestT = opts.tMax ?? Number.POSITIVE_INFINITY;
    let found = false;
    let fallbackRay: Ray | undefined;
    for (let index = 0; index < this.primitives.length; index++) {
      const primitive = this.primitives[index]!;
      if (
        opts.ignorePrimitiveId === primitive.id ||
        opts.ignorePrimitiveIds?.includes(primitive.id)
      )
        continue;
      if (prof) prof.inc("primitive.intersect.calls");
      const kernel = this.prepared?.[index];
      if (kernel) {
        const hit = this.kernelHit;
        if (
          !kernel.intersect(ox, oy, oz, dx, dy, dz, tMin, bestT, hit) ||
          !(hit.t < bestT)
        )
          continue;
        bestT = hit.t;
        result.t = hit.t;
        result.nx = hit.nx;
        result.ny = hit.ny;
        result.nz = hit.nz;
        result.px = ox + dx * hit.t;
        result.py = oy + dy * hit.t;
        result.pz = oz + dz * hit.t;
        result.primitiveId = primitive.id;
        found = true;
      } else {
        fallbackRay ??= {
          origin: new Vec3(ox, oy, oz),
          dir: new Vec3(dx, dy, dz),
        };
        const hit = primitive.intersect(fallbackRay, tMin, bestT);
        if (!hit || !(hit.t < bestT)) continue;
        bestT = hit.t;
        result.t = hit.t;
        result.nx = hit.normal.x;
        result.ny = hit.normal.y;
        result.nz = hit.normal.z;
        result.px = hit.point.x;
        result.py = hit.point.y;
        result.pz = hit.point.z;
        result.primitiveId = hit.primitiveId;
        found = true;
      }
    }
    if (prof) prof.end("raycastClosest.ms");
    return found;
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
    const nested = this.visibilityDepth++ > 0;
    try {
      const epsAbs = opts?.eps ?? 2e-4;
      let ox: number,
        oy: number,
        oz: number,
        dx: number,
        dy: number,
        dz: number,
        targetDist: number;
      if (this.camera.kind === "perspective") {
        const origin = this.camera.position;
        ox = origin.x;
        oy = origin.y;
        oz = origin.z;
        dx = worldPoint.x - ox;
        dy = worldPoint.y - oy;
        dz = worldPoint.z - oz;
        targetDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const inverse = targetDist > 1e-9 ? 1 / targetDist : 0;
        dx *= inverse;
        dy *= inverse;
        dz *= inverse;
      } else {
        const direction = this.camera.forward;
        const length = Math.sqrt(
          direction.x * direction.x +
            direction.y * direction.y +
            direction.z * direction.z,
        );
        const inverse = length > 1e-9 ? 1 / length : 0;
        dx = direction.x * inverse;
        dy = direction.y * inverse;
        dz = direction.z * inverse;
        targetDist = Math.max(this.camera.far, epsAbs * 2);
        ox = worldPoint.x - dx * targetDist;
        oy = worldPoint.y - dy * targetDist;
        oz = worldPoint.z - dz * targetDist;
      }
      const scale = Math.max(
        1,
        Math.abs(ox),
        Math.abs(oy),
        Math.abs(oz),
        Math.abs(worldPoint.x),
        Math.abs(worldPoint.y),
        Math.abs(worldPoint.z),
      );
      const rayGap = Math.max(epsAbs, scale * Number.EPSILON * 64);
      const tMax = Math.max(0, targetDist - rayGap);
      let hit: ClosestScalarHit = nested
        ? { t: 0, nx: 0, ny: 0, nz: 0, px: 0, py: 0, pz: 0, primitiveId: "" }
        : this.closestHit;
      // Preserve custom Scene raycasting overrides outside the renderer's fast path.
      if (!this.prepared || this.raycastClosest !== originalRaycastClosest) {
        const origin =
          this.camera.kind === "perspective"
            ? this.camera.position
            : new Vec3(ox, oy, oz);
        const custom = this.raycastClosest(
          { origin, dir: new Vec3(dx, dy, dz) },
          { tMin: 0, tMax },
        );
        if (!custom) return true;
        hit = {
          t: custom.t,
          px: custom.point.x,
          py: custom.point.y,
          pz: custom.point.z,
          nx: custom.normal.x,
          ny: custom.normal.y,
          nz: custom.normal.z,
          primitiveId: custom.primitiveId,
        };
      } else if (
        !this.raycastScalar(ox, oy, oz, dx, dy, dz, { tMin: 0, tMax }, hit)
      )
        return true;
      const allowed = opts?.ignorePrimitiveIds;
      if (allowed && !allowed.includes(hit.primitiveId)) return false;
      const snap = allowed
        ? Math.max(
            epsAbs * 24,
            Math.max(
              scale,
              Math.abs(hit.px),
              Math.abs(hit.py),
              Math.abs(hit.pz),
            ) *
              Number.EPSILON *
              512,
          )
        : rayGap;
      const px = hit.px - worldPoint.x,
        py = hit.py - worldPoint.y,
        pz = hit.pz - worldPoint.z;
      return (
        px * px + py * py + pz * pz <= snap * snap ||
        Math.max(0, targetDist - hit.t) <= snap
      );
    } finally {
      this.visibilityDepth--;
      if (prof) prof.end("visibleAtPoint.ms");
    }
  }
}

const originalRaycastClosest = Scene.prototype.raycastClosest;
