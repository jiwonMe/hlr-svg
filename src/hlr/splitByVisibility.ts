import type { Camera } from "../camera/camera.js";
import type { Scene } from "../scene/scene.js";
import { splitCubic3, type CubicBezier3, evalCubic3 } from "../curves/cubicBezier3.js";
import {
  findVisibilityCutsOnCubicWithVisibility,
  refineVisibilityCutBisection,
  type VisibilityParams,
} from "./visibilityCuts.js";

export type StyledPiece = {
  bez: CubicBezier3;
  visible: boolean;
};

export type SplitParams = VisibilityParams & {
  minSegLenSq: number; // e.g. 1e-6
};

type AdaptiveLineSample = {
  t: number;
  visible: boolean;
  screenX: number;
  screenY: number;
};

type AdaptiveLineRange = {
  t0: number;
  t1: number;
  visible: boolean;
};

const VERY_SHORT_EDGE_SINGLE_VIS_PX = 2.5;
const SHORT_EDGE_FAST_PATH_PX = 10;

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

export function splitLineCubicByVisibilityAdaptive(
  b: CubicBezier3,
  scene: Scene,
  camera: Camera,
  width: number,
  height: number,
  params: SplitParams,
  ignorePrimitiveIds?: readonly string[],
): StyledPiece[] {
  const out: StyledPiece[] = [];
  const start = camera.projectToSvg(b.p0, width, height);
  const end = camera.projectToSvg(b.p3, width, height);
  const lineLengthPx = Math.hypot(end.x - start.x, end.y - start.y);

  if (lineLengthPx <= VERY_SHORT_EDGE_SINGLE_VIS_PX) {
    const midVisible = scene.visibleAtPoint(evalCubic3(b, 0.5), {
      eps: params.epsVisible,
      ignorePrimitiveIds,
    });
    pushIfNotTiny(out, b, midVisible, params.minSegLenSq);
    return out;
  }

  if (lineLengthPx <= SHORT_EDGE_FAST_PATH_PX) {
    return splitShortLineCubicFastPath(
      b,
      scene,
      params,
      ignorePrimitiveIds,
      out,
    );
  }

  const pixelsPerSample = 14;
  const minCoarseSamples = 4;
  const maxAdaptiveDepth = 6;
  const targetSamples = clampInt(
    minCoarseSamples,
    Math.ceil(lineLengthPx / pixelsPerSample),
    Math.max(minCoarseSamples, Math.floor(params.samples)),
  );

  const cache = new Map<number, AdaptiveLineSample>();
  const sample = (t: number): AdaptiveLineSample => {
    const key = roundSampleKey(t);
    const cached = cache.get(key);
    if (cached) return cached;
    const point = evalCubic3(b, t);
    const projected = camera.projectToSvg(point, width, height);
    const next: AdaptiveLineSample = {
      t,
      visible: scene.visibleAtPoint(point, {
        eps: params.epsVisible,
        ignorePrimitiveIds,
      }),
      screenX: projected.x,
      screenY: projected.y,
    };
    cache.set(key, next);
    return next;
  };

  const ranges: AdaptiveLineRange[] = [];
  const pushRange = (t0: number, t1: number, visible: boolean): void => {
    if (t1 - t0 <= params.cutEps) return;
    const prev = ranges[ranges.length - 1];
    if (prev && prev.visible === visible && Math.abs(prev.t1 - t0) <= params.cutEps) {
      prev.t1 = t1;
      return;
    }
    ranges.push({ t0, t1, visible });
  };

  const visit = (
    a: AdaptiveLineSample,
    c: AdaptiveLineSample,
    depth: number,
  ): void => {
    if (c.t - a.t <= params.cutEps) {
      pushRange(a.t, c.t, a.visible);
      return;
    }

    const mid = sample((a.t + c.t) / 2);
    if (a.visible === mid.visible && mid.visible === c.visible) {
      pushRange(a.t, c.t, a.visible);
      return;
    }

    const spanPx = Math.hypot(c.screenX - a.screenX, c.screenY - a.screenY);
    if (spanPx <= pixelsPerSample || depth >= maxAdaptiveDepth) {
      if (a.visible !== c.visible) {
        const cut = refineVisibilityCutBisection(
          b,
          scene,
          params,
          a.t,
          c.t,
          a.visible,
          ignorePrimitiveIds,
        );
        pushRange(a.t, cut, a.visible);
        pushRange(cut, c.t, c.visible);
        return;
      }
      visit(a, mid, depth + 1);
      visit(mid, c, depth + 1);
      return;
    }

    visit(a, mid, depth + 1);
    visit(mid, c, depth + 1);
  };

  for (let i = 0; i < targetSamples; i++) {
    const t0 = i / targetSamples;
    const t1 = (i + 1) / targetSamples;
    visit(sample(t0), sample(t1), 0);
  }

  for (const range of ranges) {
    pushIfNotTiny(
      out,
      sliceCubic3(b, range.t0, range.t1),
      range.visible,
      params.minSegLenSq,
    );
  }

  return out;
}

function splitShortLineCubicFastPath(
  b: CubicBezier3,
  scene: Scene,
  params: SplitParams,
  ignorePrimitiveIds: readonly string[] | undefined,
  out: StyledPiece[],
): StyledPiece[] {
  const vis0 = scene.visibleAtPoint(b.p0, {
    eps: params.epsVisible,
    ignorePrimitiveIds,
  });
  const visMid = scene.visibleAtPoint(evalCubic3(b, 0.5), {
    eps: params.epsVisible,
    ignorePrimitiveIds,
  });
  const vis1 = scene.visibleAtPoint(b.p3, {
    eps: params.epsVisible,
    ignorePrimitiveIds,
  });

  if (vis0 === visMid && visMid === vis1) {
    pushIfNotTiny(out, b, visMid, params.minSegLenSq);
    return out;
  }

  if (vis0 !== vis1) {
    if (visMid === vis0) {
      const cut = refineVisibilityCutBisection(
        b,
        scene,
        params,
        0.5,
        1,
        vis0,
        ignorePrimitiveIds,
      );
      pushIfNotTiny(
        out,
        sliceCubic3(b, 0, cut),
        vis0,
        params.minSegLenSq,
      );
      pushIfNotTiny(
        out,
        sliceCubic3(b, cut, 1),
        vis1,
        params.minSegLenSq,
      );
      return out;
    }

    const cut = refineVisibilityCutBisection(
      b,
      scene,
      params,
      0,
      0.5,
      vis0,
      ignorePrimitiveIds,
    );
    pushIfNotTiny(out, sliceCubic3(b, 0, cut), vis0, params.minSegLenSq);
    pushIfNotTiny(out, sliceCubic3(b, cut, 1), vis1, params.minSegLenSq);
    return out;
  }

  const cut0 = refineVisibilityCutBisection(
    b,
    scene,
    params,
    0,
    0.5,
    vis0,
    ignorePrimitiveIds,
  );
  const cut1 = refineVisibilityCutBisection(
    b,
    scene,
    params,
    0.5,
    1,
    visMid,
    ignorePrimitiveIds,
  );
  pushIfNotTiny(out, sliceCubic3(b, 0, cut0), vis0, params.minSegLenSq);
  pushIfNotTiny(out, sliceCubic3(b, cut0, cut1), visMid, params.minSegLenSq);
  pushIfNotTiny(out, sliceCubic3(b, cut1, 1), vis1, params.minSegLenSq);
  return out;
}

function pushIfNotTiny(out: StyledPiece[], b: CubicBezier3, visible: boolean, minSegLenSq: number): void {
  const extentSq = cubicControlExtentSq(b);
  if (extentSq < minSegLenSq) return;
  out.push({ bez: b, visible });
}

function sliceCubic3(b: CubicBezier3, t0: number, t1: number): CubicBezier3 {
  if (t0 <= 0 && t1 >= 1) return b;
  const clampedT0 = Math.max(0, Math.min(1, t0));
  const clampedT1 = Math.max(clampedT0, Math.min(1, t1));

  let segment = b;
  if (clampedT1 < 1) {
    segment = splitCubic3(segment, clampedT1).left;
  }
  if (clampedT0 <= 0) return segment;

  const localT = clampedT1 <= 0 ? 0 : clampedT0 / clampedT1;
  return splitCubic3(segment, localT).right;
}

function clampInt(lo: number, value: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function roundSampleKey(t: number): number {
  return Math.round(t * 1e9) / 1e9;
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
