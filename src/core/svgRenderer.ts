import type { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import type { Primitive } from "../scene/primitive.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import { splitCubicByVisibility, splitCubicByVisibilityWithIgnore, type StyledPiece } from "../hlr/splitByVisibility.js";
import { piecesToSvg, type SvgRenderOptions, type SvgStyle } from "../svg/svgWriter.js";
import { curvesFromPrimitives, type CurveInclude } from "./curves.js";
import { Scene } from "./scene.js";
import type { Profiler } from "./profiler.js";

export type HlrParams = {
  samples: number;
  coarseSamples?: number;
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
  curves?: readonly CubicBezier3[]; // User curves (additional)
  profiler?: Profiler;
};

export const DEFAULT_HLR_PARAMS: HlrParams = {
  samples: 192,
  coarseSamples: 0,
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
 * three.js style:
 *
 * ```ts
 * const renderer = new SvgRenderer({ width: 800, height: 600 })
 * const svg = renderer.render(scene, camera)
 * ```
 */
export class SvgRenderer {
  private readonly base: Pick<RenderOptions, "width" | "height" | "background" | "style" | "include" | "hlr" | "intersections" | "profiler">;

  constructor(opts: Omit<RenderOptions, "curves">) {
    this.base = opts;
  }

  render(scene: Scene, camera: Camera, opts: Partial<Omit<RenderOptions, "width" | "height">> = {}): string {
    const width = this.base.width;
    const height = this.base.height;
    const profiler = opts.profiler ?? this.base.profiler;
    if (profiler) profiler.reset();
    if (profiler) profiler.begin("render.total");

    const include = { ...defaultInclude(), ...(this.base.include ?? {}), ...(opts.include ?? {}) };
    const hlr = { ...DEFAULT_HLR_PARAMS, ...(this.base.hlr ?? {}), ...(opts.hlr ?? {}) };
    const ix = { ...DEFAULT_INTERSECTION_PARAMS, ...(this.base.intersections ?? {}), ...(opts.intersections ?? {}) };

    const primitives = scene.primitives;
    const cubics: CubicBezier3[] = [];

    // 1) Curves automatically generated from primitives (silhouettes/rims/borders/box edges)
    if (profiler) profiler.begin("render.curvesFromPrimitives");
    cubics.push(...curvesFromPrimitives(primitives, camera, include));
    if (profiler) profiler.end("render.curvesFromPrimitives");

    // 2) Curves provided by the user
    if (opts.curves) cubics.push(...opts.curves);

    // 3) Intersection curves (owned intersections): participating primitives are partially ignored in visibility rays
    if (profiler) profiler.begin("render.intersections");
    const ownedIntersections = include.intersections
      ? intersectionCurvesToOwnedCubics(primitives, { angularSamples: ix.angularSamples })
      : [];
    if (profiler) profiler.end("render.intersections");

    const rayScene = scene.toRaycastScene(camera, profiler);

    const pieces: StyledPiece[] = [];
    if (profiler) profiler.begin("render.visibilitySplit");
    for (const b of cubics) pieces.push(...splitCubicByVisibility(b, rayScene, hlr));
    for (const x of ownedIntersections) {
      pieces.push(...splitCubicByVisibilityWithIgnore(x.bez, rayScene, hlr, x.ignorePrimitiveIds));
    }
    if (profiler) profiler.end("render.visibilitySplit");

    // Place solid above dashed
    const sorted = [...pieces].sort((a, b) => Number(a.visible) - Number(b.visible));

    const svgOpts: SvgRenderOptions = {
      width,
      height,
      background: opts.background ?? this.base.background,
      style: { ...(this.base.style ?? {}), ...(opts.style ?? {}) },
    };

    if (profiler) profiler.begin("render.svgWrite");
    const out = piecesToSvg(sorted, camera, svgOpts);
    if (profiler) profiler.end("render.svgWrite");
    if (profiler) profiler.end("render.total");
    return out;
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

