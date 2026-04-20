import type { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import type { Primitive } from "../scene/primitive.js";
import { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import {
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
  splitLineCubicByVisibilityAdaptive,
  type StyledPiece,
} from "../hlr/splitByVisibility.js";
import { piecesToSvg, type SvgRenderOptions, type SvgStyle } from "../svg/svgWriter.js";
import {
  curvesFromPrimitives,
  meshFeatureCurves,
  type CurveInclude,
  type MeshCurveOptions,
} from "./curves.js";
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
  useBezierFit?: boolean; // default: true
  fitMode?: "perRun" | "stitchThenFit"; // default: "stitchThenFit"
};

export type RenderInclude = CurveInclude & {
  intersections?: boolean; // default: true
};

export type MeshRenderParams = Required<MeshCurveOptions>;

export type RenderOptions = {
  width: number;
  height: number;
  background?: boolean;
  style?: Partial<SvgStyle>;
  include?: RenderInclude;
  hlr?: Partial<HlrParams>;
  intersections?: Partial<IntersectionParams>;
  mesh?: Partial<MeshRenderParams>;
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
  useBezierFit: true,
  fitMode: "stitchThenFit",
};

export const DEFAULT_MESH_PARAMS: MeshRenderParams = {
  creaseAngleDeg: 30,
};

function defaultInclude(): Required<RenderInclude> {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    meshEdges: true,
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
  private readonly base: Pick<
    RenderOptions,
    | "width"
    | "height"
    | "background"
    | "style"
    | "include"
    | "hlr"
    | "intersections"
    | "mesh"
    | "profiler"
  >;

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
    const ix = { ...DEFAULT_INTERSECTION_PARAMS, ...(this.base.intersections ?? {}), ...(opts.intersections ?? {}) };
    const mesh = { ...DEFAULT_MESH_PARAMS, ...(this.base.mesh ?? {}), ...(opts.mesh ?? {}) };

    const primitives = scene.primitives;
    const hasTriangleMesh = primitives.some((p) => p instanceof TriangleMesh);
    const hlrDefaults = hasTriangleMesh
      ? { ...DEFAULT_HLR_PARAMS, coarseSamples: 24 }
      : DEFAULT_HLR_PARAMS;
    const hlr = { ...hlrDefaults, ...(this.base.hlr ?? {}), ...(opts.hlr ?? {}) };
    const cubics: CubicBezier3[] = [];
    const meshCubics: CubicBezier3[] = [];

    // 1) Curves automatically generated from primitives (silhouettes/rims/borders/box edges)
    if (profiler) profiler.begin("render.curvesFromPrimitives");
    cubics.push(
      ...curvesFromPrimitives(
        primitives,
        camera,
        { ...include, meshEdges: false },
        mesh,
      ),
    );
    if (include.meshEdges) {
      meshCubics.push(...meshFeatureCurves(primitives, camera, mesh));
    }
    if (profiler) profiler.end("render.curvesFromPrimitives");

    // 2) Curves provided by the user
    if (opts.curves) cubics.push(...opts.curves);

    // 3) Intersection curves (owned intersections): participating primitives are partially ignored in visibility rays
    if (profiler) profiler.begin("render.intersections");
    const ownedIntersections = include.intersections
      ? intersectionCurvesToOwnedCubics(primitives, { angularSamples: ix.angularSamples, useBezierFit: ix.useBezierFit, fitMode: ix.fitMode })
      : [];
    if (profiler) profiler.end("render.intersections");

    const rayScene = scene.toRaycastScene(camera, profiler);

    const hiddenPieces: StyledPiece[] = [];
    const visiblePieces: StyledPiece[] = [];
    if (profiler) profiler.begin("render.visibilitySplit");
    for (const b of cubics) {
      for (const p of splitCubicByVisibility(b, rayScene, hlr)) (p.visible ? visiblePieces : hiddenPieces).push(p);
    }
    for (const b of meshCubics) {
      for (const p of splitLineCubicByVisibilityAdaptive(
        b,
        rayScene,
        camera,
        width,
        height,
        hlr,
      )) {
        (p.visible ? visiblePieces : hiddenPieces).push(p);
      }
    }
    for (const x of ownedIntersections) {
      for (const p of splitCubicByVisibilityWithIgnore(x.bez, rayScene, hlr, x.ignorePrimitiveIds)) {
        (p.visible ? visiblePieces : hiddenPieces).push(p);
      }
    }
    if (profiler) profiler.end("render.visibilitySplit");

    // Place dashed (hidden) below solid (visible), but keep per-curve order within each group.
    const sorted = [...hiddenPieces, ...visiblePieces];

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
