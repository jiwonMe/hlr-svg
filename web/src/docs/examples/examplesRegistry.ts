import simpleCode from "../samples/simple-primitives.ts?raw";
import randomCode from "../samples/random-primitives.ts?raw";
import conicCode from "../samples/conic-section.ts?raw";
import sphereSectionsCode from "../samples/sphere-plane-sections.ts?raw";
import tangentSpheresCode from "../samples/tangent-spheres.ts?raw";
import coordinateTetrahedronCode from "../samples/coordinate-tetrahedron.ts?raw";
import cubeSectionCode from "../samples/cube-section.ts?raw";
import cylinderSectionCode from "../samples/cylinder-section.ts?raw";
import meshImportCode from "../samples/mesh-import.ts?raw";

export type ExampleId =
  | "coordinate-tetrahedron"
  | "cube-section"
  | "cylinder-section"
  | "tangent-spheres"
  | "sphere-plane-sections"
  | "simple-primitives"
  | "random-primitives"
  | "conic-section"
  | "mesh-import";

type Locale = "ko-kr" | "en-us";

type ExampleText = {
  title: string;
  description: string;
  tags: readonly string[];
};

type ExampleSpec = {
  id: ExampleId;
  /** Exam-style figures are numbered like the landing page's questions. */
  kind: "exam" | "basic";
  question?: number;
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
    id: "coordinate-tetrahedron",
    kind: "exam",
    question: 24,
    githubPath: "web/src/docs/samples/coordinate-tetrahedron.ts",
    code: coordinateTetrahedronCode,
    text: {
      "ko-kr": {
        title: "좌표공간의 평면과 좌표축",
        description:
          "세 점 A(2, 0, 0), B(0, 2, 0), C(0, 0, 2)를 지나는 평면을 삼각형 메시 한 장으로 두었습니다. 평면 뒤를 지나는 좌표축의 원점 쪽 구간과 선분 OH가 점선으로 판정됩니다.",
        tags: ["좌표공간", "TriangleMesh"],
      },
      "en-us": {
        title: "Plane ABC and the coordinate axes",
        description:
          "The plane through A(2, 0, 0), B(0, 2, 0) and C(0, 0, 2) is a single-triangle mesh. The axes behind it and the segment OH are judged hidden and drawn dashed.",
        tags: ["Coordinate space", "TriangleMesh"],
      },
    },
  },
  {
    id: "cube-section",
    kind: "exam",
    question: 25,
    githubPath: "web/src/docs/samples/cube-section.ts",
    code: cubeSectionCode,
    text: {
      "ko-kr": {
        title: "정육면체의 단면",
        description:
          "한 모서리의 길이가 2인 정육면체 ABCD–EFGH와 세 점 B, D, E를 지나는 단면입니다. 옆면 AEHD 위의 선분 DE와 꼭짓점 H에 모이는 모서리가 점선으로 그려집니다.",
        tags: ["공간도형", "BoxAabb"],
      },
      "en-us": {
        title: "Section of a cube",
        description:
          "Cube ABCD–EFGH with edge 2 and the section through B, D and E. Segment DE on face AEHD and the edges meeting at H are drawn dashed.",
        tags: ["Solid geometry", "BoxAabb"],
      },
    },
  },
  {
    id: "cylinder-section",
    kind: "exam",
    question: 26,
    githubPath: "web/src/docs/samples/cylinder-section.ts",
    code: cylinderSectionCode,
    text: {
      "ko-kr": {
        title: "원기둥과 45° 평면",
        description:
          "밑면의 반지름이 2인 원기둥을 밑면과 45°를 이루는 평면 α로 잘랐습니다. 교선인 타원은 렌더러가 계산하고, 평면 아래로 가려진 윤곽은 점선이 됩니다.",
        tags: ["정사영", "Cylinder × PlaneRect"],
      },
      "en-us": {
        title: "Cylinder cut at 45°",
        description:
          "A cylinder of radius 2 cut by a plane α at 45° to its base. The renderer computes the elliptical section; outlines hidden under the plane are dashed.",
        tags: ["Projection", "Cylinder × PlaneRect"],
      },
    },
  },
  {
    id: "tangent-spheres",
    kind: "exam",
    question: 27,
    githubPath: "web/src/docs/samples/tangent-spheres.ts",
    code: tangentSpheresCode,
    text: {
      "ko-kr": {
        title: "구에 접하는 세 구",
        description:
          "반지름 3인 구 S와 평면 α 위의 반지름 1인 세 구 S₁·S₂·S₃를 배치합니다. 세 구는 모두 S에 접하고 S₁–S₂, S₂–S₃가 서로 접합니다. 평면 β가 S₁·S₂를 자르며, 교선과 구의 윤곽을 앞뒤 관계에 따라 실선·점선으로 표시합니다.",
        tags: ["구의 위치 관계", "Sphere × PlaneRect"],
      },
      "en-us": {
        title: "Three spheres tangent to a sphere",
        description:
          "A sphere S of radius 3 and three spheres S₁, S₂, S₃ of radius 1 resting on plane α. All three touch S; S₁ touches S₂ and S₂ touches S₃. Plane β cuts S₁ and S₂; visible curves are solid and hidden curves are dashed.",
        tags: ["Tangent spheres", "Sphere × PlaneRect"],
      },
    },
  },
  {
    id: "sphere-plane-sections",
    kind: "exam",
    question: 28,
    githubPath: "web/src/docs/samples/sphere-plane-sections.ts",
    code: sphereSectionsCode,
    text: {
      "ko-kr": {
        title: "구와 두 평면의 단면",
        description:
          "반지름 2인 구와 45°를 이루는 두 평면의 단면, OP ∥ AQ 및 ∠QAR=90°를 재현합니다.",
        tags: ["구와 평면", "Sphere"],
      },
      "en-us": {
        title: "Sphere and two plane sections",
        description:
          "A sphere of radius 2 cut by two planes meeting at 45°, with OP ∥ AQ and ∠QAR = 90°.",
        tags: ["Sphere and planes", "Sphere"],
      },
    },
  },
  {
    id: "simple-primitives",
    kind: "basic",
    githubPath: "web/src/docs/samples/simple-primitives.ts",
    code: simpleCode,
    text: {
      "ko-kr": {
        title: "기본 도형 네 가지",
        description:
          "구, 원기둥, 원뿔, 직육면체를 한 장면에 놓고 원근 투영으로 렌더링합니다.",
        tags: ["기본 도형", "Perspective"],
      },
      "en-us": {
        title: "Simple primitives",
        description:
          "Render Sphere / Cylinder / Cone / BoxAabb in a single scene.",
        tags: ["Primitives", "Perspective"],
      },
    },
  },
  {
    id: "conic-section",
    kind: "basic",
    githubPath: "web/src/docs/samples/conic-section.ts",
    code: conicCode,
    text: {
      "ko-kr": {
        title: "원뿔과 평면의 교선",
        description:
          "원뿔을 비스듬한 평면으로 자르면 교차 곡선이 원뿔 곡선(타원/포물선/쌍곡선)이 됩니다.",
        tags: ["이차곡선", "Cone × PlaneRect"],
      },
      "en-us": {
        title: "Conic section (Plane × Cone)",
        description:
          "A plane slicing a cone produces a conic section (ellipse/parabola/hyperbola).",
        tags: ["Conics", "Cone × PlaneRect"],
      },
    },
  },
  {
    id: "random-primitives",
    kind: "basic",
    githubPath: "web/src/docs/samples/random-primitives.ts",
    code: randomCode,
    text: {
      "ko-kr": {
        title: "무작위 도형 (seed 고정)",
        description:
          "seed를 고정해 문서/CI에서 항상 같은 랜덤 씬을 재현합니다.",
        tags: ["교선", "seed"],
      },
      "en-us": {
        title: "Random primitives (seeded)",
        description: "Seeded randomness makes docs/CI output reproducible.",
        tags: ["Intersections", "seed"],
      },
    },
  },
  {
    id: "mesh-import",
    kind: "basic",
    githubPath: "web/src/docs/samples/mesh-import.ts",
    code: meshImportCode,
    text: {
      "ko-kr": {
        title: "OBJ·STL 메시 불러오기",
        description:
          "OBJ/STL 파일을 업로드하거나 드롭해서 feature-line 기반 SVG HLR 결과를 바로 확인합니다.",
        tags: ["OBJ · STL", "TriangleMesh"],
      },
      "en-us": {
        title: "OBJ/STL mesh import",
        description:
          "Upload or drop an OBJ/STL file to preview feature-line SVG HLR output.",
        tags: ["OBJ · STL", "TriangleMesh"],
      },
    },
  },
] as const;

export function getExampleById(id: string): ExampleSpec | undefined {
  return EXAMPLES.find((x) => x.id === id);
}
