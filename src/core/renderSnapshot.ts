import type { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import {
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
  splitLineCubicByVisibilityAdaptive,
  type StyledPiece,
} from "../hlr/splitByVisibility.js";
import type { Primitive } from "../scene/primitive.js";
import { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import type { Profiler, ProfileReport } from "./profiler.js";
import { createProfiler } from "./profiler.js";
import { curvesFromPrimitives, meshFeatureCurves, type CurveInclude, type MeshCurveOptions } from "./curves.js";
import { Scene } from "./scene.js";

export type LineStyle = {
  strokeVisible: string;
  strokeHidden: string;
  strokeWidthVisible: number;
  strokeWidthHidden: number;
  dashArrayHidden: string;
  opacityHidden: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
};

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
  useBezierFit?: boolean;
  fitMode?: "perRun" | "stitchThenFit";
};

export type RenderInclude = CurveInclude & {
  intersections?: boolean;
};

export type MeshRenderParams = Required<MeshCurveOptions>;

export type RenderSnapshotOptions = {
  width: number;
  height: number;
  background?: boolean;
  style?: Partial<LineStyle>;
  include?: RenderInclude;
  hlr?: Partial<HlrParams>;
  intersections?: Partial<IntersectionParams>;
  mesh?: Partial<MeshRenderParams>;
  curves?: readonly CubicBezier3[];
  profiler?: Profiler;
};

export type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
};

export type ProjectedCubic = {
  p0: ProjectedPoint;
  p1: ProjectedPoint;
  p2: ProjectedPoint;
  p3: ProjectedPoint;
};

export type SnapshotPath = {
  visible: boolean;
  stroke: string;
  strokeWidth: number;
  dashArray?: string;
  opacity: number;
  lineCap: LineStyle["lineCap"];
  lineJoin: LineStyle["lineJoin"];
  cubics: readonly ProjectedCubic[];
};

export type RenderSnapshot = {
  width: number;
  height: number;
  background: boolean;
  style: LineStyle;
  paths: readonly SnapshotPath[];
};

export const DEFAULT_LINE_STYLE: LineStyle = {
  strokeVisible: "black",
  strokeHidden: "black",
  strokeWidthVisible: 1.5,
  strokeWidthHidden: 1.5,
  dashArrayHidden: "3 3",
  opacityHidden: 0.5,
  lineCap: "butt",
  lineJoin: "round",
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

export function defaultRenderInclude(): Required<RenderInclude> {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    meshEdges: true,
    intersections: true,
  };
}

export function resolveLineStyle(style?: Partial<LineStyle>): LineStyle {
  return { ...DEFAULT_LINE_STYLE, ...(style ?? {}) };
}

export function renderSceneToSnapshot(
  scene: Scene,
  camera: Camera,
  opts: RenderSnapshotOptions,
): RenderSnapshot {
  const profiler = opts.profiler;
  if (profiler) profiler.reset();
  if (profiler) profiler.begin("render.total");

  const include = {
    ...defaultRenderInclude(),
    ...(opts.include ?? {}),
  };
  const ix = {
    ...DEFAULT_INTERSECTION_PARAMS,
    ...(opts.intersections ?? {}),
  };
  const mesh = {
    ...DEFAULT_MESH_PARAMS,
    ...(opts.mesh ?? {}),
  };

  const primitives = scene.primitives;
  const hasTriangleMesh = primitives.some((primitive) => primitive instanceof TriangleMesh);
  const hlrDefaults = hasTriangleMesh
    ? { ...DEFAULT_HLR_PARAMS, coarseSamples: 24 }
    : DEFAULT_HLR_PARAMS;
  const hlr = {
    ...hlrDefaults,
    ...(opts.hlr ?? {}),
  };

  const cubics: CubicBezier3[] = [];
  const meshCubics: CubicBezier3[] = [];

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

  if (opts.curves) cubics.push(...opts.curves);

  if (profiler) profiler.begin("render.intersections");
  const ownedIntersections = include.intersections
    ? intersectionCurvesToOwnedCubics(primitives, {
        angularSamples: ix.angularSamples,
        useBezierFit: ix.useBezierFit,
        fitMode: ix.fitMode,
      })
    : [];
  if (profiler) profiler.end("render.intersections");

  const rayScene = scene.toRaycastScene(camera, profiler);

  const hiddenPieces: StyledPiece[] = [];
  const visiblePieces: StyledPiece[] = [];
  if (profiler) profiler.begin("render.visibilitySplit");
  for (const cubic of cubics) {
    for (const piece of splitCubicByVisibility(cubic, rayScene, hlr)) {
      (piece.visible ? visiblePieces : hiddenPieces).push(piece);
    }
  }
  for (const cubic of meshCubics) {
    for (const piece of splitLineCubicByVisibilityAdaptive(
      cubic,
      rayScene,
      camera,
      opts.width,
      opts.height,
      hlr,
    )) {
      (piece.visible ? visiblePieces : hiddenPieces).push(piece);
    }
  }
  for (const intersection of ownedIntersections) {
    for (const piece of splitCubicByVisibilityWithIgnore(
      intersection.bez,
      rayScene,
      hlr,
      intersection.ignorePrimitiveIds,
    )) {
      (piece.visible ? visiblePieces : hiddenPieces).push(piece);
    }
  }
  if (profiler) profiler.end("render.visibilitySplit");

  if (profiler) profiler.begin("render.snapshotBuild");
  const snapshot = styledPiecesToSnapshot(
    [...hiddenPieces, ...visiblePieces],
    camera,
    {
      width: opts.width,
      height: opts.height,
      background: opts.background,
      style: opts.style,
    },
  );
  if (profiler) profiler.end("render.snapshotBuild");
  if (profiler) profiler.end("render.total");

  return snapshot;
}

export function renderSceneToSnapshotProfiled(
  scene: Scene,
  camera: Camera,
  opts: Omit<RenderSnapshotOptions, "profiler">,
): { snapshot: RenderSnapshot; report: ProfileReport } {
  const profiler = createProfiler();
  const snapshot = renderSceneToSnapshot(scene, camera, { ...opts, profiler });
  return { snapshot, report: profiler.report() };
}

export function renderPrimitivesToSnapshot(
  primitives: readonly Primitive[],
  camera: Camera,
  opts: RenderSnapshotOptions,
): RenderSnapshot {
  return renderSceneToSnapshot(new Scene(primitives), camera, opts);
}

export function styledPiecesToSnapshot(
  pieces: readonly StyledPiece[],
  camera: Camera,
  opts: Pick<RenderSnapshotOptions, "width" | "height" | "background" | "style">,
): RenderSnapshot {
  const style = resolveLineStyle(opts.style);
  const paths = chainPieces(pieces, 1e-6).map((chain) => {
    const visible = chain[0]?.visible ?? true;
    return {
      visible,
      stroke: visible ? style.strokeVisible : style.strokeHidden,
      strokeWidth: visible ? style.strokeWidthVisible : style.strokeWidthHidden,
      dashArray: visible ? undefined : style.dashArrayHidden,
      opacity: visible ? 1 : style.opacityHidden,
      lineCap: style.lineCap,
      lineJoin: style.lineJoin,
      cubics: chain.map((piece) => ({
        p0: camera.projectToSvg(piece.bez.p0, opts.width, opts.height),
        p1: camera.projectToSvg(piece.bez.p1, opts.width, opts.height),
        p2: camera.projectToSvg(piece.bez.p2, opts.width, opts.height),
        p3: camera.projectToSvg(piece.bez.p3, opts.width, opts.height),
      })),
    };
  });

  return {
    width: opts.width,
    height: opts.height,
    background: opts.background ?? true,
    style,
    paths,
  };
}

export function snapshotToSvg(snapshot: RenderSnapshot): string {
  const bg = snapshot.background
    ? `<rect width="100%" height="100%" fill="white" />`
    : "";

  const paths = snapshot.paths.map((path) => {
    const d = projectedCubicsToSvgPathD(path.cubics);
    const dash = path.dashArray ? ` stroke-dasharray="${path.dashArray}"` : "";
    const opacity = path.opacity < 1 ? ` opacity="${fmt(path.opacity)}"` : "";
    return `<path d="${d}" fill="none" stroke="${path.stroke}" stroke-width="${fmt(path.strokeWidth)}" stroke-linecap="${path.lineCap}" stroke-linejoin="${path.lineJoin}"${dash}${opacity} />`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${snapshot.width}" height="${snapshot.height}" viewBox="0 0 ${snapshot.width} ${snapshot.height}">${bg}${paths.join("")}</svg>`;
}

export function projectedCubicsToSvgPathD(cubics: readonly ProjectedCubic[]): string {
  const first = cubics[0];
  if (!first) return "";

  let d = `M ${fmt(first.p0.x)} ${fmt(first.p0.y)}`;
  for (const cubic of cubics) {
    d += ` C ${fmt(cubic.p1.x)} ${fmt(cubic.p1.y)} ${fmt(cubic.p2.x)} ${fmt(cubic.p2.y)} ${fmt(cubic.p3.x)} ${fmt(cubic.p3.y)}`;
  }
  return d;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "0";
}

function chainPieces(
  pieces: readonly StyledPiece[],
  connectEpsSq: number,
): StyledPiece[][] {
  const out: StyledPiece[][] = [];
  let current: StyledPiece[] = [];

  const canAppend = (left: StyledPiece, right: StyledPiece): boolean => {
    if (left.visible !== right.visible) return false;
    const dx = left.bez.p3.x - right.bez.p0.x;
    const dy = left.bez.p3.y - right.bez.p0.y;
    const dz = left.bez.p3.z - right.bez.p0.z;
    return (dx * dx + dy * dy + dz * dz) <= connectEpsSq;
  };

  for (const piece of pieces) {
    const prev = current[current.length - 1];
    if (!prev) {
      current = [piece];
      continue;
    }
    if (canAppend(prev, piece)) {
      current.push(piece);
      continue;
    }
    out.push(current);
    current = [piece];
  }

  if (current.length > 0) out.push(current);
  return out;
}
