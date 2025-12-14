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
            if (opts.ignorePrimitiveIds && opts.ignorePrimitiveIds.includes(p.id))
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
            // "점 자체"의 self-hit를 제외하기 위해, targetDist보다 살짝 앞까지만 검사한다.
            const tMax = Math.max(0, targetDist - eps * 10);
            const hit = this.raycastClosest(ray, {
                tMin: 0,
                tMax,
                ignorePrimitiveId: undefined,
                // NOTE: 교선 visibility에서 "참여 프리미티브 전체를 무시"하면
                //       진짜 self-occlusion까지 풀려버릴 수 있다.
                //       따라서 raycast는 전부 대상으로 하고, hit 결과를 post-filter한다.
                ignorePrimitiveIds: undefined,
            });
            if (hit === null)
                return true;
            // 교선/접선/수치오차로 인해 "목표점(교선) 아주 근처"에서 발생한 hit가
            // occluder로 오해되어 실선이 점선으로 바뀌는 케이스를 완화한다.
            // 중요한 점: 프리미티브 전체를 무시하지 않고, "근처 hit"만 무시한다.
            const snap = Math.max(epsAbs * 8, targetDist * 2e-6);
            if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) {
                const allow = opts?.ignorePrimitiveIds;
                // ignore 리스트가 있으면 "교선에 참여한 프리미티브"에서 나온 근접 hit만 무시
                if (!allow)
                    return true;
                if (allow.includes(hit.primitiveId))
                    return true;
            }
            return false;
        }
        // orthographic: viewDir로 평행 레이
        const viewDir = Vec3.normalize(this.camera.forward);
        const far = 1e6;
        const origin = Vec3.sub(worldPoint, Vec3.mulScalar(viewDir, far));
        const dir = viewDir;
        const ray = { origin, dir };
        const targetDist = far;
        const tMax = Math.max(0, targetDist - epsAbs);
        const hit = this.raycastClosest(ray, {
            tMin: 0,
            tMax,
            ignorePrimitiveId: undefined,
            ignorePrimitiveIds: undefined,
        });
        if (hit === null)
            return true;
        const snap = Math.max(epsAbs * 8, 2e-6 * far);
        if (Vec3.distanceSq(hit.point, worldPoint) <= snap * snap) {
            const allow = opts?.ignorePrimitiveIds;
            if (!allow)
                return true;
            if (allow.includes(hit.primitiveId))
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=scene.js.map