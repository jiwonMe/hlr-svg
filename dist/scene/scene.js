import { Vec3 } from "../math/vec3.js";
export class Scene {
    primitives;
    camera;
    constructor(primitives, camera) {
        this.primitives = primitives;
        this.camera = camera;
    }
    raycastClosest(ray, opts = {}) {
        const tMin = opts.tMin ?? 0;
        const tMax = opts.tMax ?? Number.POSITIVE_INFINITY;
        let closest = null;
        let bestT = tMax;
        for (const p of this.primitives) {
            if (opts.ignorePrimitiveId && p.id === opts.ignorePrimitiveId)
                continue;
            const h = p.intersect(ray, tMin, bestT);
            if (!h)
                continue;
            if (h.t < bestT) {
                bestT = h.t;
                closest = h;
            }
        }
        return closest;
    }
    visibleAtPoint(worldPoint, opts) {
        const epsAbs = opts?.eps ?? 2e-4;
        if (this.camera.kind === "perspective") {
            const origin = this.camera.position;
            const dir = Vec3.normalize(Vec3.sub(worldPoint, origin));
            const targetDist = Vec3.distance(worldPoint, origin);
            const eps = Math.max(epsAbs, targetDist * 1e-6);
            const ray = { origin, dir };
            const hit = this.raycastClosest(ray, {
                tMin: 0,
                tMax: targetDist + eps,
                ignorePrimitiveId: undefined,
            });
            if (!hit)
                return true;
            return !(hit.t < targetDist - eps);
        }
        // orthographic: viewDir로 평행 레이
        const viewDir = Vec3.normalize(this.camera.forward);
        const far = 1e6;
        const origin = Vec3.sub(worldPoint, Vec3.mulScalar(viewDir, far));
        const dir = viewDir;
        const ray = { origin, dir };
        const targetDist = far;
        const hit = this.raycastClosest(ray, {
            tMin: 0,
            tMax: targetDist + epsAbs,
            ignorePrimitiveId: undefined,
        });
        if (!hit)
            return true;
        return !(hit.t < targetDist - epsAbs);
    }
}
