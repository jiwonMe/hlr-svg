import type { RenderCaseSvgOptions } from "@hlr/demo/renderCase.js";

/** How the hidden pieces found by HLR are drawn. */
export type HiddenLineMode = "dashed" | "removed" | "solid";

export const HIDDEN_LINE_MODES: readonly HiddenLineMode[] = [
  "dashed",
  "removed",
  "solid",
];

// Exam figures are thin black line work; hidden lines are short dashes.
const BASE = {
  strokeVisible: "#0a0a0a",
  strokeHidden: "#0a0a0a",
  strokeWidthVisible: 1.35,
};
const HIDDEN: Record<HiddenLineMode, RenderCaseSvgOptions["svgStyle"]> = {
  dashed: {
    ...BASE,
    strokeWidthHidden: 1.05,
    dashArrayHidden: "3.2 2.6",
    opacityHidden: 0.9,
  },
  removed: { ...BASE, strokeWidthHidden: 1.05, opacityHidden: 0 },
  solid: {
    ...BASE,
    strokeWidthHidden: 1.35,
    dashArrayHidden: "none",
    opacityHidden: 1,
  },
};

// Stable objects per mode keep useDemoSvg's memoization effective.
// Coarser visibility sampling keeps dragging responsive; release restores it.
const OPTIONS = Object.fromEntries(
  HIDDEN_LINE_MODES.map((mode) => [
    mode,
    {
      idle: { background: false, svgStyle: HIDDEN[mode] },
      drag: {
        background: false,
        svgStyle: HIDDEN[mode],
        hlr: { samples: 96, coarseSamples: 24 },
      },
    },
  ]),
) as Record<
  HiddenLineMode,
  { idle: RenderCaseSvgOptions; drag: RenderCaseSvgOptions }
>;

export function lineRenderOptions(
  mode: HiddenLineMode,
  moving = false,
): RenderCaseSvgOptions {
  return OPTIONS[mode][moving ? "drag" : "idle"];
}
