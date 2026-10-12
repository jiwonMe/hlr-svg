import simpleCode from "../samples/simple-primitives.ts?raw";
import randomCode from "../samples/random-primitives.ts?raw";
import conicCode from "../samples/conic-section.ts?raw";
import sphereSectionsCode from "../samples/sphere-plane-sections.ts?raw";
import meshImportCode from "../samples/mesh-import.ts?raw";

export type ExampleId =
  | "simple-primitives"
  | "random-primitives"
  | "conic-section"
  | "sphere-plane-sections"
  | "mesh-import";

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
        description:
          "Sphere / Cylinder / Cone / BoxAabb 를 한 장면에 배치하고 SVG로 렌더링합니다.",
      },
      "en-us": {
        title: "Simple primitives",
        description:
          "Render Sphere / Cylinder / Cone / BoxAabb in a single scene.",
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
        description:
          "seed를 고정해 문서/CI에서 항상 같은 랜덤 씬을 재현합니다.",
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
        description:
          "원뿔을 비스듬한 평면으로 자르면 교차 곡선이 원뿔 곡선(타원/포물선/쌍곡선)이 됩니다.",
      },
      "en-us": {
        title: "Conic section (Plane × Cone)",
        description:
          "A plane slicing a cone produces a conic section (ellipse/parabola/hyperbola).",
      },
    },
  },
  {
    id: "sphere-plane-sections",
    githubPath: "web/src/docs/samples/sphere-plane-sections.ts",
    code: sphereSectionsCode,
    text: {
      "ko-kr": {
        title: "구와 두 평면의 단면",
        description:
          "반지름 2인 구와 45°를 이루는 두 평면의 단면, OP ∥ AQ 및 ∠QAR=90°를 재현합니다.",
      },
      "en-us": {
        title: "Sphere and two plane sections",
        description:
          "A sphere of radius 2 cut by two planes meeting at 45°, with OP ∥ AQ and ∠QAR = 90°.",
      },
    },
  },
  {
    id: "mesh-import",
    githubPath: "web/src/docs/samples/mesh-import.ts",
    code: meshImportCode,
    text: {
      "ko-kr": {
        title: "OBJ/STL 메시 임포트",
        description:
          "OBJ/STL 파일을 업로드하거나 드롭해서 feature-line 기반 SVG HLR 결과를 바로 확인합니다.",
      },
      "en-us": {
        title: "OBJ/STL mesh import",
        description:
          "Upload or drop an OBJ/STL file to preview feature-line SVG HLR output.",
      },
    },
  },
] as const;

export function getExampleById(id: string): ExampleSpec | undefined {
  return EXAMPLES.find((x) => x.id === id);
}
