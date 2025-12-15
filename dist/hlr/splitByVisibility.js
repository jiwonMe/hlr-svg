import { Vec3 } from "../math/vec3.js";
import { splitCubic3 } from "../curves/cubicBezier3.js";
import { findVisibilityCutsOnCubicWithVisibility } from "./visibilityCuts.js";
export function splitCubicByVisibility(b, scene, params) {
    return splitCubicByVisibilityWithIgnore(b, scene, params);
}
export function splitCubicByVisibilityWithIgnore(b, scene, params, ignorePrimitiveIds) {
    const { cuts, segmentVisible } = findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds);
    const out = [];
    let current = b;
    let prevCut = 0;
    let segIdx = 0;
    for (const cut of cuts) {
        const localT = (cut - prevCut) / (1 - prevCut);
        const { left, right } = splitCubic3(current, localT);
        pushIfNotTiny(out, left, segmentVisible[segIdx] ?? true, params.minSegLenSq);
        current = right;
        prevCut = cut;
        segIdx++;
    }
    pushIfNotTiny(out, current, segmentVisible[segIdx] ?? true, params.minSegLenSq);
    return out;
}
function pushIfNotTiny(out, b, visible, minSegLenSq) {
    const lenSq = Vec3.distanceSq(b.p0, b.p3);
    if (lenSq < minSegLenSq)
        return;
    out.push({ bez: b, visible });
}
