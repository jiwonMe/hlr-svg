import { clamp01, dedupeSorted } from "../math/eps.js";
import type { Scene } from "../scene/scene.js";
import { evalCubic3, type CubicBezier3 } from "../curves/cubicBezier3.js";

export type VisibilityParams = {
  samples: number; // e.g. 128~256
  refineIters: number; // e.g. 20
  epsVisible: number; // e.g. 1e-5 (Scene.visibleAtPoint eps)
  cutEps: number; // e.g. 1e-6 (dedupe / boundary filter)
};

export function findVisibilityCutsOnCubic(
  b: CubicBezier3,
  scene: Scene,
  params: VisibilityParams,
): number[] {
  const samples = Math.max(2, Math.floor(params.samples));
  const vis: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = evalCubic3(b, t);
    vis.push(scene.visibleAtPoint(p, { eps: params.epsVisible }));
  }

  const cuts: number[] = [];
  for (let i = 1; i <= samples; i++) {
    const v0 = vis[i - 1]!;
    const v1 = vis[i]!;
    if (v0 === v1) continue;
    const t0 = (i - 1) / samples;
    const t1 = i / samples;
    const tStar = refineCutBisection(b, scene, params, t0, t1, v0);
    cuts.push(tStar);
  }

  const sorted = cuts.map(clamp01).sort((a, b2) => a - b2);
  const deduped = dedupeSorted(sorted, params.cutEps);
  return deduped.filter((t) => t > params.cutEps && t < 1 - params.cutEps);
}

function refineCutBisection(
  b: CubicBezier3,
  scene: Scene,
  params: VisibilityParams,
  tLo: number,
  tHi: number,
  visLo: boolean,
): number {
  let lo = tLo;
  let hi = tHi;
  for (let i = 0; i < params.refineIters; i++) {
    const mid = (lo + hi) / 2;
    const p = evalCubic3(b, mid);
    const v = scene.visibleAtPoint(p, { eps: params.epsVisible });
    if (v === visLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}


