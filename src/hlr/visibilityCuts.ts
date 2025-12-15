import { clamp01, dedupeSorted } from "../math/eps.js";
import type { Scene } from "../scene/scene.js";
import { evalCubic3, type CubicBezier3 } from "../curves/cubicBezier3.js";

export type VisibilityParams = {
  samples: number; // e.g. 128~256
  /**
   * Optional coarse pre-pass sample count.
   * - If set (>=2), we first sample visibility at this lower resolution.
   * - If the curve appears to have no visibility transitions at this coarse resolution,
   *   we skip the full `samples` pass entirely (big speedup).
   *
   * Tradeoff: very tiny hidden/visible changes narrower than coarse step may be missed.
   * Recommended: 48~96 for "fast mode", keep undefined/0 for maximum fidelity.
   */
  coarseSamples?: number;
  refineIters: number; // e.g. 20
  epsVisible: number; // e.g. 1e-5 (Scene.visibleAtPoint eps)
  cutEps: number; // e.g. 1e-6 (dedupe / boundary filter)
};

export type VisibilityCuts = {
  /**
   * Sorted cut parameters in (0,1).
   * Each cut represents a visibility transition.
   */
  cuts: number[];
  /**
   * Visibility for each segment split by cuts.
   * Length is cuts.length + 1, corresponds to:
   * - segment 0: (0 .. cuts[0])
   * - segment i: (cuts[i-1] .. cuts[i])
   * - last: (cuts[last] .. 1)
   */
  segmentVisible: boolean[];
};

export function findVisibilityCutsOnCubic(
  b: CubicBezier3,
  scene: Scene,
  params: VisibilityParams,
  ignorePrimitiveIds?: readonly string[],
): number[] {
  return findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds).cuts;
}

export function findVisibilityCutsOnCubicWithVisibility(
  b: CubicBezier3,
  scene: Scene,
  params: VisibilityParams,
  ignorePrimitiveIds?: readonly string[],
): VisibilityCuts {
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
      if (i === 0) prev = v;
      else if (v !== prev) any = true;
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

  const vis: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = evalCubic3(b, t);
    vis.push(scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds }));
  }

  const cuts: number[] = [];
  for (let i = 1; i <= samples; i++) {
    const v0 = vis[i - 1]!;
    const v1 = vis[i]!;
    if (v0 === v1) continue;
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
  const sampleAt = (t: number): boolean => {
    const tt = clamp01(t);
    const idx = Math.max(0, Math.min(samples, Math.round(tt * samples)));
    return vis[idx] ?? true;
  };

  const segmentVisible: boolean[] = [];
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

function refineCutBisection(
  b: CubicBezier3,
  scene: Scene,
  params: VisibilityParams,
  tLo: number,
  tHi: number,
  visLo: boolean,
  ignorePrimitiveIds?: readonly string[],
): number {
  let lo = tLo;
  let hi = tHi;
  for (let i = 0; i < params.refineIters; i++) {
    const mid = (lo + hi) / 2;
    const p = evalCubic3(b, mid);
    const v = scene.visibleAtPoint(p, { eps: params.epsVisible, ignorePrimitiveIds });
    if (v === visLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}


