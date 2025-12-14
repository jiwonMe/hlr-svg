import { Vec3 } from "../math/vec3.js";
import { evalCubic3, splitCubic3 } from "../curves/cubicBezier3.js";
import { findVisibilityCutsOnCubic } from "./visibilityCuts.js";
export function splitCubicByVisibility(b, scene, params) {
    return splitCubicByVisibilityWithIgnore(b, scene, params);
}
export function splitCubicByVisibilityWithIgnore(b, scene, params, ignorePrimitiveIds) {
    const cuts = findVisibilityCutsOnCubic(b, scene, params, ignorePrimitiveIds);
    const out = [];
    let current = b;
    let prevCut = 0;
    for (const cut of cuts) {
        const localT = (cut - prevCut) / (1 - prevCut);
        const { left, right } = splitCubic3(current, localT);
        pushIfNotTiny(out, left, midVisibility(scene, left, params.epsVisible, ignorePrimitiveIds), params.minSegLenSq);
        current = right;
        prevCut = cut;
    }
    pushIfNotTiny(out, current, midVisibility(scene, current, params.epsVisible, ignorePrimitiveIds), params.minSegLenSq);
    return out;
}
function midVisibility(scene, b, epsVisible, ignorePrimitiveIds) {
    const p = evalCubic3(b, 0.5);
    return scene.visibleAtPoint(p, { eps: epsVisible, ignorePrimitiveIds });
}
function pushIfNotTiny(out, b, visible, minSegLenSq) {
    const lenSq = Vec3.distanceSq(b.p0, b.p3);
    if (lenSq < minSegLenSq)
        return;
    out.push({ bez: b, visible });
}
//# sourceMappingURL=splitByVisibility.js.map