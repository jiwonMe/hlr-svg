import type { DemoCase } from "./types.js";
import { Scene } from "../scene/scene.js";
import { splitCubicByVisibility, splitCubicByVisibilityWithIgnore } from "../hlr/splitByVisibility.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";
import { piecesToSvg, type SvgStyle } from "../svg/svgWriter.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import { rimsForPrimitives } from "./rims.js";
import { bordersForPrimitives } from "./borders.js";
import { createProfiler, type Profiler, type ProfileReport } from "../core/profiler.js";
import type { HlrParams } from "../core/svgRenderer.js";

export type RenderCaseSvgOptions = {
  svgStyle?: Partial<SvgStyle>;
  profiler?: Profiler;
  hlr?: Partial<HlrParams>;
  intersections?: { angularSamples?: number; useBezierFit?: boolean; fitMode?: "perRun" | "stitchThenFit" };
};

export function renderCaseToSvgString(demo: DemoCase, opts: RenderCaseSvgOptions = {}): string {
  const profiler = opts.profiler;
  if (profiler) profiler.reset();
  if (profiler) profiler.begin("render.total");

  const scene = new Scene(demo.primitives, demo.camera, profiler);

  if (profiler) profiler.begin("render.demo.curves");
  const cubics = demo.curves({ camera: demo.camera, primitives: demo.primitives });
  // Rule: rims are always included as a set (Cylinder: base+top, Cone: base)
  cubics.push(...rimsForPrimitives(demo.primitives));
  // PlaneRect also always includes border (outline)
  cubics.push(...bordersForPrimitives(demo.primitives));
  if (profiler) profiler.end("render.demo.curves");

  if (profiler) profiler.begin("render.intersections");
  const ix = { angularSamples: 256, useBezierFit: true, fitMode: "stitchThenFit" as const, ...(opts.intersections ?? {}) };
  const ownedIntersections = demo.includeIntersections
    ? intersectionCurvesToOwnedCubics(scene.primitives, { angularSamples: ix.angularSamples, useBezierFit: ix.useBezierFit, fitMode: ix.fitMode })
    : [];
  if (profiler) profiler.end("render.intersections");

  const params: HlrParams = {
    samples: 192,
    // Fast pre-pass: if a cubic appears to have no visibility transitions at this resolution,
    // skip the expensive full sampling pass.
    coarseSamples: 64,
    refineIters: 22,
    epsVisible: 2e-4,
    cutEps: 1e-6,
    minSegLenSq: 1e-6,
    ...(opts.hlr ?? {}),
  };

  const hiddenPieces: StyledPiece[] = [];
  const visiblePieces: StyledPiece[] = [];
  if (profiler) profiler.begin("render.visibilitySplit");
  for (const b of cubics) {
    for (const p of splitCubicByVisibility(b, scene, params)) (p.visible ? visiblePieces : hiddenPieces).push(p);
  }
  for (const x of ownedIntersections) {
    for (const p of splitCubicByVisibilityWithIgnore(x.bez, scene, params, x.ignorePrimitiveIds)) {
      (p.visible ? visiblePieces : hiddenPieces).push(p);
    }
  }
  if (profiler) profiler.end("render.visibilitySplit");

  // Place dashed (hidden) below solid (visible), but keep per-curve order within each group.
  const sorted = [...hiddenPieces, ...visiblePieces];

  if (profiler) profiler.begin("render.svgWrite");
  const out = piecesToSvg(sorted, demo.camera, {
    width: demo.width,
    height: demo.height,
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "4 4",
      ...(opts.svgStyle ?? {}),
    },
  });
  if (profiler) profiler.end("render.svgWrite");
  if (profiler) profiler.end("render.total");
  return out;
}

export function renderCaseToSvgStringProfiled(
  demo: DemoCase,
  opts: Omit<RenderCaseSvgOptions, "profiler"> = {},
): { svg: string; report: ProfileReport } {
  const profiler = createProfiler();
  const svg = renderCaseToSvgString(demo, { ...opts, profiler });
  return { svg, report: profiler.report() };
}

export function renderCasesToHtml(cases: DemoCase[]): string {
  const blocks = cases
    .map((c) => {
      const svg = renderCaseToSvgString(c);
      return `<section><h2>${escapeHtml(c.name)}</h2>${svg}</section>`;
    })
    .join("");

  return (
    "<!doctype html>" +
    "<html><head><meta charset=\"utf-8\" />" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />" +
    "<title>HLR Demo Cases</title>" +
    "<style>body{font-family:ui-sans-serif,system-ui,Arial;margin:16px}section{margin:18px 0}h2{margin:0 0 8px 0;font-size:16px}svg{border:1px solid #ddd;border-radius:8px}</style>" +
    "</head><body>" +
    blocks +
    "</body></html>"
  );
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}


