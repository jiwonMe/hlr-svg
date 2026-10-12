import {
  buildExamFigure,
  type ExamFigureModel,
  type FigureId,
} from "../../exam/figures";
import type { ExampleId } from "./examplesRegistry";
import {
  buildConicSectionDemo,
  buildMeshPreviewDemo,
  buildRandomPrimitivesDemo,
  buildSimplePrimitivesDemo,
} from "./demos";

export type ExampleParams = { seed: number; planeTilt: number };
export const DEFAULT_EXAMPLE_PARAMS: ExampleParams = {
  seed: 1337,
  planeTilt: 0.25,
};

const EXAM_FIGURES: Partial<Record<ExampleId, FigureId>> = {
  "sphere-plane-sections": "sphere-sections",
  "tangent-spheres": "tangent-spheres",
  "coordinate-tetrahedron": "coordinate-tetrahedron",
  "cube-section": "cube-section",
  "cylinder-section": "cylinder-section",
};

const noLabels = () => "";

/** Lines and labels for an example, rendered at the given size. */
export function buildExampleModel(
  id: ExampleId,
  width: number,
  height: number,
  params: ExampleParams = DEFAULT_EXAMPLE_PARAMS,
): ExamFigureModel {
  const figure = EXAM_FIGURES[id];
  if (figure) return buildExamFigure(figure, width, height);
  switch (id) {
    case "simple-primitives":
      return {
        demo: buildSimplePrimitivesDemo(width, height),
        annotate: noLabels,
      };
    case "random-primitives":
      return {
        demo: buildRandomPrimitivesDemo(width, height, params.seed),
        annotate: noLabels,
      };
    case "conic-section":
      return {
        demo: buildConicSectionDemo(width, height, params.planeTilt),
        annotate: noLabels,
      };
    default:
      return { demo: buildMeshPreviewDemo(width, height), annotate: noLabels };
  }
}

/** Stable per-example builders for static gallery thumbnails. */
export const THUMBNAIL_BUILDERS = Object.fromEntries(
  (
    [
      "sphere-plane-sections",
      "tangent-spheres",
      "coordinate-tetrahedron",
      "cube-section",
      "cylinder-section",
      "simple-primitives",
      "random-primitives",
      "conic-section",
      "mesh-import",
    ] as const
  ).map((id) => [
    id,
    (width: number, height: number) => buildExampleModel(id, width, height),
  ]),
) as Record<ExampleId, (width: number, height: number) => ExamFigureModel>;
