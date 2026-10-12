import { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import type { Primitive } from "../scene/primitive.js";
import { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import {
  cachedIntersectionCurvesToOwnedCubics,
  intersectionGeometrySignature,
  intersectionCurvesToOwnedCubics,
  type OwnedIntersectionCubic3,
} from "../scene/intersections/intersectionCurves.js";
import {
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
  splitLineCubicByVisibilityAdaptive,
  type StyledPiece,
} from "../hlr/splitByVisibility.js";
import {
  projectPiecesToSvgPaths,
  projectedPathsToSvg,
  type ProjectedSvgPath,
  type SvgRenderOptions,
  type SvgStyle,
} from "../svg/svgWriter.js";
import {
  curvesFromPrimitives,
  meshFeatureCurves,
  type CurveInclude,
  type MeshCurveOptions,
} from "./curves.js";
import { Scene } from "./scene.js";
import { Scene as RaycastScene } from "../scene/scene.js";
import type { Profiler } from "./profiler.js";

const originalProjectToSvg = Camera.prototype.projectToSvg;
const originalProjectToNdc = Camera.prototype.projectToNdc;
const originalToRaycastScene = Scene.prototype.toRaycastScene;
const originalVisibleAtPoint = RaycastScene.prototype.visibleAtPoint;
const originalRaycastClosest = RaycastScene.prototype.raycastClosest;

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
  /**
   * User curves that lie on surfaces, such as a section of a solid. Hits on the
   * listed primitives at the curve itself do not hide it.
   */
  ownedCurves?: readonly OwnedIntersectionCubic3[];
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

const cubicKey = (b: CubicBezier3) => [
  b.p0.x,
  b.p0.y,
  b.p0.z,
  b.p1.x,
  b.p1.y,
  b.p1.z,
  b.p2.x,
  b.p2.y,
  b.p2.z,
  b.p3.x,
  b.p3.y,
  b.p3.z,
];

function defaultInclude(): Required<RenderInclude> {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    meshEdges: true,
    csg: true,
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
  private projectedCache?: { key: string; paths: readonly ProjectedSvgPath[] };
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

  constructor(opts: Omit<RenderOptions, "curves" | "ownedCurves">) {
    this.base = opts;
  }

  render(
    scene: Scene,
    camera: Camera,
    opts: Partial<Omit<RenderOptions, "width" | "height">> = {},
  ): string {
    const width = this.base.width;
    const height = this.base.height;
    const profiler = opts.profiler ?? this.base.profiler;
    if (profiler) profiler.reset();
    if (profiler) profiler.begin("render.total");

    const include = {
      ...defaultInclude(),
      ...(this.base.include ?? {}),
      ...(opts.include ?? {}),
    };
    const ix = {
      ...DEFAULT_INTERSECTION_PARAMS,
      ...(this.base.intersections ?? {}),
      ...(opts.intersections ?? {}),
    };
    const mesh = {
      ...DEFAULT_MESH_PARAMS,
      ...(this.base.mesh ?? {}),
      ...(opts.mesh ?? {}),
    };

    const primitives = scene.primitives;
    const hasTriangleMesh = primitives.some((p) => p instanceof TriangleMesh);
    const hlrDefaults = hasTriangleMesh
      ? { ...DEFAULT_HLR_PARAMS, coarseSamples: 24 }
      : DEFAULT_HLR_PARAMS;
    const hlr = {
      ...hlrDefaults,
      ...(this.base.hlr ?? {}),
      ...(opts.hlr ?? {}),
    };
    const svgOpts: SvgRenderOptions = {
      width,
      height,
      background: opts.background ?? this.base.background,
      style: { ...(this.base.style ?? {}), ...(opts.style ?? {}) },
    };
    // Serializing an entire mesh each frame can cost more than rendering it.
    // Value-based caches are reserved for the small analytic scene descriptions.
    const geometry = hasTriangleMesh
      ? undefined
      : intersectionGeometrySignature(primitives);
    const cacheKey =
      geometry === undefined
        ? undefined
        : geometry +
          JSON.stringify([
            width,
            height,
            camera.kind,
            camera.near,
            camera.far,
            camera.fovYRad,
            camera.halfHeight,
            camera.position.x,
            camera.position.y,
            camera.position.z,
            camera.forward.x,
            camera.forward.y,
            camera.forward.z,
            camera.view.m,
            camera.proj.m,
            include,
            ix,
            mesh,
            hlr,
            opts.curves?.map(cubicKey),
            opts.ownedCurves?.map((x) => [cubicKey(x.bez), x.ignorePrimitiveIds]),
          ]);
    const cameraMethods =
      Object.getPrototypeOf(camera) === Camera.prototype &&
      camera.projectToSvg === originalProjectToSvg &&
      camera.projectToNdc === originalProjectToNdc &&
      Object.getPrototypeOf(scene) === Scene.prototype &&
      scene.toRaycastScene === originalToRaycastScene &&
      RaycastScene.prototype.visibleAtPoint === originalVisibleAtPoint &&
      RaycastScene.prototype.raycastClosest === originalRaycastClosest;
    if (
      cacheKey !== undefined &&
      cameraMethods &&
      this.projectedCache?.key === cacheKey
    ) {
      if (profiler) {
        profiler.inc("render.visibility.cacheHit");
        profiler.begin("render.svgWrite");
      }
      const out = projectedPathsToSvg(this.projectedCache.paths, svgOpts);
      if (profiler) {
        profiler.end("render.svgWrite");
        profiler.end("render.total");
      }
      return out;
    }
    this.projectedCache = undefined;
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
    const intersectionsForScene = hasTriangleMesh
      ? intersectionCurvesToOwnedCubics
      : cachedIntersectionCurvesToOwnedCubics;
    const ownedIntersections = include.intersections
      ? intersectionsForScene(primitives, {
          angularSamples: ix.angularSamples,
          useBezierFit: ix.useBezierFit,
          fitMode: ix.fitMode,
        })
      : [];
    if (profiler) profiler.end("render.intersections");

    const rayScene = scene.toRaycastScene(camera, profiler, true);

    const hiddenPieces: StyledPiece[] = [];
    const visiblePieces: StyledPiece[] = [];
    if (profiler) profiler.begin("render.visibilitySplit");
    for (const b of cubics) {
      for (const p of splitCubicByVisibility(b, rayScene, hlr))
        (p.visible ? visiblePieces : hiddenPieces).push(p);
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
    for (const x of [...ownedIntersections, ...(opts.ownedCurves ?? [])]) {
      for (const p of splitCubicByVisibilityWithIgnore(
        x.bez,
        rayScene,
        hlr,
        x.ignorePrimitiveIds,
      )) {
        (p.visible ? visiblePieces : hiddenPieces).push(p);
      }
    }
    if (profiler) profiler.end("render.visibilitySplit");

    // Place dashed (hidden) below solid (visible), but keep per-curve order within each group.
    const sorted = [...hiddenPieces, ...visiblePieces];

    if (profiler) profiler.begin("render.svgWrite");
    const paths = projectPiecesToSvgPaths(sorted, camera, width, height);
    if (cacheKey !== undefined && cameraMethods)
      this.projectedCache = { key: cacheKey, paths };
    const out = projectedPathsToSvg(paths, svgOpts);
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
  return r.render(scene, camera, {
    curves: opts.curves,
    ownedCurves: opts.ownedCurves,
  });
}

export function renderPrimitivesToSvg(
  primitives: readonly Primitive[],
  camera: Camera,
  opts: RenderOptions,
): string {
  return renderToSvg(new Scene(primitives), camera, opts);
}
