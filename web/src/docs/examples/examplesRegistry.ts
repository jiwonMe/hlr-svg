import simpleCode from "../samples/simple-primitives.ts?raw";
import randomCode from "../samples/random-primitives.ts?raw";
import conicCode from "../samples/conic-section.ts?raw";

export type ExampleId = "simple-primitives" | "random-primitives" | "conic-section";

type Locale = "ko-kr" | "en-us";

type ExampleText = {
  title: string;
  description: string;
};

type ExampleSpec = {
  id: ExampleId;
  githubPath: string;
  code: string;
  text: Record<Locale, ExampleText>;
};

const GITHUB_BASE = "https://github.com/jiwonMe/hlr-svg/blob/main";

export function getGithubUrl(githubPath: string): string {
  return `${GITHUB_BASE}/${githubPath}`;
}

export const EXAMPLES: readonly ExampleSpec[] = [
  {
    id: "simple-primitives",
    githubPath: "web/src/docs/samples/simple-primitives.ts",
    code: simpleCode,
    text: {
      "ko-kr": {
        title: "단순 primitives",
        description: "Sphere / Cylinder / Cone / BoxAabb 를 한 장면에 배치하고 SVG로 렌더링합니다.",
      },
      "en-us": {
        title: "Simple primitives",
        description: "Render Sphere / Cylinder / Cone / BoxAabb in a single scene.",
      },
    },
  },
  {
    id: "random-primitives",
    githubPath: "web/src/docs/samples/random-primitives.ts",
    code: randomCode,
    text: {
      "ko-kr": {
        title: "랜덤 도형 생성 (seed 기반)",
        description: "seed를 고정해 문서/CI에서 항상 같은 랜덤 씬을 재현합니다.",
      },
      "en-us": {
        title: "Random primitives (seeded)",
        description: "Seeded randomness makes docs/CI output reproducible.",
      },
    },
  },
  {
    id: "conic-section",
    githubPath: "web/src/docs/samples/conic-section.ts",
    code: conicCode,
    text: {
      "ko-kr": {
        title: "Conic section (Plane × Cone)",
        description: "원뿔을 비스듬한 평면으로 자르면 교차 곡선이 원뿔 곡선(타원/포물선/쌍곡선)이 됩니다.",
      },
      "en-us": {
        title: "Conic section (Plane × Cone)",
        description: "A plane slicing a cone produces a conic section (ellipse/parabola/hyperbola).",
      },
    },
  },
] as const;

export function getExampleById(id: string): ExampleSpec | undefined {
  return EXAMPLES.find((x) => x.id === id);
}
