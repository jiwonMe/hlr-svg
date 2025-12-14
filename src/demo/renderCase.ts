import type { DemoCase } from "./types.js";
import { Scene } from "../scene/scene.js";
import { splitCubicByVisibility, splitCubicByVisibilityWithIgnore } from "../hlr/splitByVisibility.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";
import { piecesToSvg, type SvgStyle } from "../svg/svgWriter.js";
import { intersectionCurvesToOwnedCubics } from "../scene/intersections/intersectionCurves.js";
import { rimsForPrimitives } from "./rims.js";
import { bordersForPrimitives } from "./borders.js";

export type RenderCaseSvgOptions = {
  svgStyle?: Partial<SvgStyle>;
};

export function renderCaseToSvgString(demo: DemoCase, opts: RenderCaseSvgOptions = {}): string {
  const scene = new Scene(demo.primitives, demo.camera);

  const cubics = demo.curves({ camera: demo.camera, primitives: demo.primitives });
  // 규칙: rim은 항상 세트로 포함 (Cylinder: base+top, Cone: base)
  cubics.push(...rimsForPrimitives(demo.primitives));
  // PlaneRect는 border(외곽선)도 항상 포함
  cubics.push(...bordersForPrimitives(demo.primitives));
  const ownedIntersections = demo.includeIntersections
    ? intersectionCurvesToOwnedCubics(scene.primitives, { angularSamples: 160 })
    : [];

  const params = {
    samples: 192,
    refineIters: 22,
    epsVisible: 2e-4,
    cutEps: 1e-6,
    minSegLenSq: 1e-6,
  } as const;

  const pieces: StyledPiece[] = [];
  for (const b of cubics) pieces.push(...splitCubicByVisibility(b, scene, params));
  for (const x of ownedIntersections) {
    pieces.push(...splitCubicByVisibilityWithIgnore(x.bez, scene, params, x.ignorePrimitiveIds));
  }

  // solid가 dashed 위로 오도록
  const sorted = [...pieces].sort((a, b) => Number(a.visible) - Number(b.visible));

  return piecesToSvg(sorted, demo.camera, {
    width: demo.width,
    height: demo.height,
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "4 4",
      ...(opts.svgStyle ?? {}),
    },
  });
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


