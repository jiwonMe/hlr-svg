import { Vec3 } from "../math/vec3.js";
import type { Scene } from "../scene/scene.js";
import { evalCubic3, splitCubic3, type CubicBezier3 } from "../curves/cubicBezier3.js";
import { findVisibilityCutsOnCubic, type VisibilityParams } from "./visibilityCuts.js";

export type StyledPiece = {
  bez: CubicBezier3;
  visible: boolean;
};

export type SplitParams = VisibilityParams & {
  minSegLenSq: number; // e.g. 1e-6
};

export function splitCubicByVisibility(b: CubicBezier3, scene: Scene, params: SplitParams): StyledPiece[] {
  return splitCubicByVisibilityWithIgnore(b, scene, params);
}

export function splitCubicByVisibilityWithIgnore(
  b: CubicBezier3,
  scene: Scene,
  params: SplitParams,
  ignorePrimitiveIds?: readonly string[],
): StyledPiece[] {
  const cuts = findVisibilityCutsOnCubic(b, scene, params, ignorePrimitiveIds);
  const out: StyledPiece[] = [];

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

function midVisibility(scene: Scene, b: CubicBezier3, epsVisible: number, ignorePrimitiveIds?: readonly string[]): boolean {
  const p = evalCubic3(b, 0.5);
  return scene.visibleAtPoint(p, { eps: epsVisible, ignorePrimitiveIds });
}

function pushIfNotTiny(out: StyledPiece[], b: CubicBezier3, visible: boolean, minSegLenSq: number): void {
  const lenSq = Vec3.distanceSq(b.p0, b.p3);
  if (lenSq < minSegLenSq) return;
  out.push({ bez: b, visible });
}


