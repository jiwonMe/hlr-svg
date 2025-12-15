import { clamp01, dedupeSorted } from "../math/eps.js";
import { evalCubic3 } from "../curves/cubicBezier3.js";
export function findVisibilityCutsOnCubic(b, scene, params, ignorePrimitiveIds) {
    return findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds).cuts;
}
export function findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds) {
    const samples = Math.max(2, Math.floor(params.samples));
    const coarseN = Math.max(0, Math.floor(params.coarseSamples ?? 0));
    const coarseSamples = coarseN >= 2 ? Math.min(coarseN, samples) : 0;
    // Optional coarse pre-pass: if no transitions detected, skip expensive full sampling.
    if (coarseSamples >= 2) {
        let prev = true;
        let any = false;
        for (let i = 0; i <= coarseSamples; i++) {
            const t = i / coarseSamples;
            const p = evalCubic3(b, t);
            const v = scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds });
            if (i === 0)
                prev = v;
            else if (v !== prev)
                any = true;
            prev = v;
        }
        if (!any) {
            // No change at coarse resolution -> assume constant visibility.
            // Use the midpoint at coarse resolution as representative.
            const pMid = evalCubic3(b, 0.5);
            const vMid = scene.visibleAtPoint(pMid, { eps: params.epsVisible, ignorePrimitiveIds });
            return { cuts: [], segmentVisible: [vMid] };
        }
    }
    const vis = [];
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = evalCubic3(b, t);
        vis.push(scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds }));
    }
    // Reduce jitter: single-sample flips (T/F/T or F/T/F) often come from numerical noise near tangency/intersections.
    // A 3-point majority filter preserves longer transitions while removing 1-sample toggles.
    const visSmooth = vis.slice();
    for (let i = 1; i < visSmooth.length - 1; i++) {
        const a = vis[i - 1];
        const c = vis[i];
        const d = vis[i + 1];
        const ones = Number(a) + Number(c) + Number(d);
        visSmooth[i] = ones >= 2;
    }
    const cuts = [];
    for (let i = 1; i <= samples; i++) {
        const v0 = visSmooth[i - 1];
        const v1 = visSmooth[i];
        if (v0 === v1)
            continue;
        const t0 = (i - 1) / samples;
        const t1 = i / samples;
        const tStar = refineCutBisection(b, scene, params, t0, t1, v0, ignorePrimitiveIds);
        cuts.push(tStar);
    }
    const sorted = cuts.map(clamp01).sort((a, b2) => a - b2);
    const deduped = dedupeSorted(sorted, params.cutEps);
    const finalCuts = deduped.filter((t) => t > params.cutEps && t < 1 - params.cutEps);
    // Reuse sampled vis[] to label each segment without extra raycasts.
    // Since cuts are generated only when vis changes between consecutive samples,
    // visibility should remain constant between adjacent cuts at the sampling resolution.
    const sampleAt = (t) => {
        const tt = clamp01(t);
        const idx = Math.max(0, Math.min(samples, Math.round(tt * samples)));
        return visSmooth[idx] ?? true;
    };
    const segmentVisible = [];
    if (finalCuts.length === 0) {
        segmentVisible.push(sampleAt(0.5));
        return { cuts: finalCuts, segmentVisible };
    }
    let prev = 0;
    for (const c of finalCuts) {
        segmentVisible.push(sampleAt((prev + c) / 2));
        prev = c;
    }
    segmentVisible.push(sampleAt((prev + 1) / 2));
    return { cuts: finalCuts, segmentVisible };
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
