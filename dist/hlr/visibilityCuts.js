import { clamp01, dedupeSorted } from "../math/eps.js";
import { evalCubic3 } from "../curves/cubicBezier3.js";
export function findVisibilityCutsOnCubic(b, scene, params, ignorePrimitiveIds) {
    const samples = Math.max(2, Math.floor(params.samples));
    const vis = [];
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = evalCubic3(b, t);
        vis.push(scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds }));
    }
    const cuts = [];
    for (let i = 1; i <= samples; i++) {
        const v0 = vis[i - 1];
        const v1 = vis[i];
        if (v0 === v1)
            continue;
        const t0 = (i - 1) / samples;
        const t1 = i / samples;
        const tStar = refineCutBisection(b, scene, params, t0, t1, v0, ignorePrimitiveIds);
        cuts.push(tStar);
    }
    const sorted = cuts.map(clamp01).sort((a, b2) => a - b2);
    const deduped = dedupeSorted(sorted, params.cutEps);
    return deduped.filter((t) => t > params.cutEps && t < 1 - params.cutEps);
}
function refineCutBisection(b, scene, params, tLo, tHi, visLo, ignorePrimitiveIds) {
    let lo = tLo;
    let hi = tHi;
    for (let i = 0; i < params.refineIters; i++) {
        const mid = (lo + hi) / 2;
        const p = evalCubic3(b, mid);
        const v = scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds });
        if (v === visLo)
            lo = mid;
        else
            hi = mid;
    }
    return (lo + hi) / 2;
}
