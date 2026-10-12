import { useMemo } from "react";
import { Scene } from "@hlr/core/scene.js";
import { SvgRenderer } from "@hlr/core/svgRenderer.js";
import type { DemoCase } from "@hlr/demo/types.js";
import type { RenderCaseSvgOptions } from "@hlr/demo/renderCase.js";

/** Preserve demo-authored curves while reusing scene and renderer caches. */
export function useDemoSvg(
  demo: DemoCase,
  options: RenderCaseSvgOptions,
): string {
  const scene = useMemo(() => new Scene(demo.primitives), [demo.primitives]);
  const renderer = useMemo(
    () =>
      new SvgRenderer({
        width: demo.width,
        height: demo.height,
        include: { silhouettes: false, boxEdges: false, meshEdges: false },
        hlr: { samples: 192, coarseSamples: 64, refineIters: 22 },
        intersections: {
          angularSamples: 256,
          useBezierFit: true,
          fitMode: "stitchThenFit",
        },
      }),
    [demo.width, demo.height],
  );
  const curves = useMemo(
    () => demo.curves({ camera: demo.camera, primitives: demo.primitives }),
    [demo.curves, demo.camera, demo.primitives],
  );
  return useMemo(
    () =>
      renderer.render(scene, demo.camera, {
        curves,
        background: options.background,
        include: { intersections: demo.includeIntersections },
        style: {
          strokeWidthVisible: 1.8,
          strokeWidthHidden: 1.8,
          dashArrayHidden: "4 4",
          ...options.svgStyle,
        },
        hlr: options.hlr,
        intersections: options.intersections,
        profiler: options.profiler,
      }),
    [renderer, scene, demo.camera, demo.includeIntersections, curves, options],
  );
}
