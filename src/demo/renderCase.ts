import { Scene } from "../core/scene.js";
import {
  renderSceneToGpuPreview,
  type GpuPreviewFrame,
} from "../core/gpuPreview.js";
import {
  renderSceneToSnapshot,
  renderSceneToSnapshotProfiled,
  snapshotToSvg,
  type HlrParams,
  type LineStyle,
  type MeshRenderParams,
  type RenderSnapshot,
} from "../core/renderSnapshot.js";
import { formatProfileReport, type ProfileReport, type Profiler } from "../core/profiler.js";
import type { DemoCase } from "./types.js";

export type RenderCaseSvgOptions = {
  svgStyle?: Partial<LineStyle>;
  profiler?: Profiler;
  hlr?: Partial<HlrParams>;
  mesh?: Partial<MeshRenderParams>;
  intersections?: {
    angularSamples?: number;
    useBezierFit?: boolean;
    fitMode?: "perRun" | "stitchThenFit";
  };
  background?: boolean;
};

export function renderCaseToSnapshot(
  demo: DemoCase,
  opts: RenderCaseSvgOptions = {},
): RenderSnapshot {
  const scene = new Scene(demo.primitives);
  const curves = demo.curves({
    camera: demo.camera,
    primitives: demo.primitives,
  });

  return renderSceneToSnapshot(scene, demo.camera, {
    width: demo.width,
    height: demo.height,
    background: opts.background,
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "4 4",
      ...(opts.svgStyle ?? {}),
    },
    include: {
      silhouettes: false,
      rims: true,
      borders: true,
      boxEdges: false,
      meshEdges: false,
      intersections: demo.includeIntersections,
    },
    curves,
    hlr: {
      coarseSamples: 64,
      ...(opts.hlr ?? {}),
    },
    intersections: opts.intersections,
    mesh: opts.mesh,
    profiler: opts.profiler,
  });
}

export function renderCaseToSvgString(
  demo: DemoCase,
  opts: RenderCaseSvgOptions = {},
): string {
  return snapshotToSvg(renderCaseToSnapshot(demo, opts));
}

export function renderCaseToSnapshotProfiled(
  demo: DemoCase,
  opts: Omit<RenderCaseSvgOptions, "profiler"> = {},
) : { snapshot: RenderSnapshot; report: ProfileReport } {
  const { snapshot, report } = renderSceneToSnapshotProfiled(
    new Scene(demo.primitives),
    demo.camera,
    {
      width: demo.width,
      height: demo.height,
      background: opts.background,
      style: {
        strokeWidthVisible: 1.8,
        strokeWidthHidden: 1.8,
        dashArrayHidden: "4 4",
        ...(opts.svgStyle ?? {}),
      },
      include: {
        silhouettes: false,
        rims: true,
        borders: true,
        boxEdges: false,
        meshEdges: false,
        intersections: demo.includeIntersections,
      },
      curves: demo.curves({
        camera: demo.camera,
        primitives: demo.primitives,
      }),
      hlr: {
        coarseSamples: 64,
        ...(opts.hlr ?? {}),
      },
      intersections: opts.intersections,
      mesh: opts.mesh,
    },
  );

  return { snapshot, report };
}

export function renderCaseToSvgStringProfiled(
  demo: DemoCase,
  opts: Omit<RenderCaseSvgOptions, "profiler"> = {},
): { svg: string; report: ProfileReport } {
  const { snapshot, report } = renderCaseToSnapshotProfiled(demo, opts);
  return { svg: snapshotToSvg(snapshot), report };
}

export function renderCaseToGpuPreview(
  demo: DemoCase,
  opts: Omit<RenderCaseSvgOptions, "profiler" | "hlr" | "intersections"> = {},
): GpuPreviewFrame {
  return renderSceneToGpuPreview(new Scene(demo.primitives), demo.camera, {
    width: demo.width,
    height: demo.height,
    background: opts.background,
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "4 4",
      ...(opts.svgStyle ?? {}),
    },
    include: {
      silhouettes: false,
      rims: true,
      borders: true,
      boxEdges: false,
      meshEdges: false,
    },
    curves: demo.curves({
      camera: demo.camera,
      primitives: demo.primitives,
    }),
    mesh: opts.mesh,
  });
}

export function renderCasesToHtml(cases: DemoCase[]): string {
  const blocks = cases
    .map((demo) => {
      const svg = renderCaseToSvgString(demo);
      return `<section><h2>${escapeHtml(demo.name)}</h2>${svg}</section>`;
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

export { formatProfileReport };

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
