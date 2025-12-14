import type { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import type { Primitive } from "../scene/primitive.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import { splitCubicByVisibility, splitCubicByVisibilityWithIgnore, type StyledPiece } from "../hlr/splitByVisibility.js";
import { piecesToSvg, type SvgRenderOptions, type SvgStyle } from "../svg/svgWriter.js";
import { curvesFromPrimitives, type CurveInclude } from "./curves.js";
import { Scene } from "./scene.js";

export type HlrParams = {
  samples: number;
  refineIters: number;
  epsVisible: number;
  cutEps: number;
  minSegLenSq: number;
};

export type IntersectionParams = {
  angularSamples: number;
};

export type RenderInclude = CurveInclude & {
  intersections?: boolean; // default: true
};

export type RenderOptions = {
  width: number;
  height: number;
  background?: boolean;
  style?: Partial<SvgStyle>;
  include?: RenderInclude;
  hlr?: Partial<HlrParams>;
  intersections?: Partial<IntersectionParams>;
  curves?: readonly CubicBezier3[]; // 사용자 커브(추가)
};

export const DEFAULT_HLR_PARAMS: HlrParams = {
  samples: 192,
  refineIters: 22,
  epsVisible: 2e-4,
  cutEps: 1e-6,
  minSegLenSq: 1e-6,
};

export const DEFAULT_INTERSECTION_PARAMS: IntersectionParams = {
  angularSamples: 160,
};

function defaultInclude(): Required<RenderInclude> {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    intersections: true,
  };
}

/**
 * three.js 스타일:
 *
 * ```ts
 * const renderer = new SvgRenderer({ width: 800, height: 600 })
 * const svg = renderer.render(scene, camera)
 * ```
 */
export class SvgRenderer {
  private readonly base: Pick<RenderOptions, "width" | "height" | "background" | "style" | "include" | "hlr" | "intersections">;

  constructor(opts: Omit<RenderOptions, "curves">) {
    this.base = opts;
  }

  render(scene: Scene, camera: Camera, opts: Partial<Omit<RenderOptions, "width" | "height">> = {}): string {
    const width = this.base.width;
    const height = this.base.height;

    const include = { ...defaultInclude(), ...(this.base.include ?? {}), ...(opts.include ?? {}) };
    const hlr = { ...DEFAULT_HLR_PARAMS, ...(this.base.hlr ?? {}), ...(opts.hlr ?? {}) };
    const ix = { ...DEFAULT_INTERSECTION_PARAMS, ...(this.base.intersections ?? {}), ...(opts.intersections ?? {}) };

    const primitives = scene.primitives;
    const cubics: CubicBezier3[] = [];

    // 1) primitives에서 자동 생성되는 커브들(실루엣/림/보더/박스엣지)
    cubics.push(...curvesFromPrimitives(primitives, camera, include));

    // 2) 사용자가 추가로 주는 커브
    if (opts.curves) cubics.push(...opts.curves);

    // 3) 교선(owned intersections): 참여 프리미티브는 visibility ray에서 부분적으로 무시한다.
    const ownedIntersections = include.intersections
      ? intersectionCurvesToOwnedCubics(primitives, { angularSamples: ix.angularSamples })
      : [];

    const rayScene = scene.toRaycastScene(camera);

    const pieces: StyledPiece[] = [];
    for (const b of cubics) pieces.push(...splitCubicByVisibility(b, rayScene, hlr));
    for (const x of ownedIntersections) {
      pieces.push(...splitCubicByVisibilityWithIgnore(x.bez, rayScene, hlr, x.ignorePrimitiveIds));
    }

    // solid가 dashed 위로 오도록
    const sorted = [...pieces].sort((a, b) => Number(a.visible) - Number(b.visible));

    const svgOpts: SvgRenderOptions = {
      width,
      height,
      background: opts.background ?? this.base.background,
      style: { ...(this.base.style ?? {}), ...(opts.style ?? {}) },
    };

    return piecesToSvg(sorted, camera, svgOpts);
  }
}

export function renderToSvg(
  scene: Scene,
  camera: Camera,
  opts: RenderOptions,
): string {
  const r = new SvgRenderer(opts);
  return r.render(scene, camera, { curves: opts.curves });
}

export function renderPrimitivesToSvg(
  primitives: readonly Primitive[],
  camera: Camera,
  opts: RenderOptions,
): string {
  return renderToSvg(new Scene(primitives), camera, opts);
}

