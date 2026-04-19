import { Vec3 } from "../math/vec3.js";
import type { Scene } from "../scene/scene.js";
import { splitCubic3, type CubicBezier3 } from "../curves/cubicBezier3.js";
import { findVisibilityCutsOnCubicWithVisibility, type VisibilityParams } from "./visibilityCuts.js";

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
  const { cuts, segmentVisible } = findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds);
  const out: StyledPiece[] = [];

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

function pushIfNotTiny(out: StyledPiece[], b: CubicBezier3, visible: boolean, minSegLenSq: number): void {
  const extentSq = cubicControlExtentSq(b);
  if (extentSq < minSegLenSq) return;
  out.push({ bez: b, visible });
}

function cubicControlExtentSq(b: CubicBezier3): number {
  const minX = Math.min(b.p0.x, b.p1.x, b.p2.x, b.p3.x);
  const maxX = Math.max(b.p0.x, b.p1.x, b.p2.x, b.p3.x);
  const minY = Math.min(b.p0.y, b.p1.y, b.p2.y, b.p3.y);
  const maxY = Math.max(b.p0.y, b.p1.y, b.p2.y, b.p3.y);
  const minZ = Math.min(b.p0.z, b.p1.z, b.p2.z, b.p3.z);
  const maxZ = Math.max(b.p0.z, b.p1.z, b.p2.z, b.p3.z);
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  return dx * dx + dy * dy + dz * dz;
}

