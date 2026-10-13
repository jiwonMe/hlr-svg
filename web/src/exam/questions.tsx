import type { QuestionSpec } from "./exam";
import { tex } from "./tex";

/** The front-page clipping: sphere and two planes. */
export const LEAD_QUESTION: QuestionSpec = {
  no: 28,
  points: 4,
  answer: 5,
  stem: tex`그림과 같이 중심이 O이고 반지름의 길이가 2인 구가 있다. 점 O를
    지나는 평면 $$\alpha$$와 평면 $$\alpha$$와 45°의 각을 이루는 평면
    $$\beta$$가 구와 만나서 생기는 원을 각각 $$C_1$$, $$C_2$$라 하고, 원
    $$C_2$$의 중심을 A라 하자. 점 A와 평면 $$\alpha$$ 사이의 거리가
    $$\frac{\sqrt{6}}{2}$$일 때, 원 $$C_1$$ 위의 점 P와 원 $$C_2$$ 위의 두 점
    Q, R이 다음 조건을 만족시킨다.`,
  conditions: (
    <>
      <p>
        {tex`(가) $$\overrightarrow{\mathrm{OP}} = 2\overrightarrow{\mathrm{AQ}}$$`}
      </p>
      <p>{tex`(나) $$\angle\mathrm{QAR} = \frac{\pi}{2}$$`}</p>
    </>
  ),
  closing: <>삼각형 PQR의 넓이는?</>,
  figure: {
    id: "sphere-sections",
    label:
      "구와 두 평면 α, β의 단면 C₁, C₂. 점 O, A, P, Q, R과 보조선, 45°와 2분의 루트 6이 표시된 그림",
    ratio: 0.7,
    width: 620,
  },
  caption: tex`구의 윤곽선과 단면 $$C_2$$를 시점마다 다시 계산합니다.`,
  exampleId: "sphere-plane-sections",
  choices: [
    tex`$$\frac{\sqrt{3}}{2}$$`,
    tex`$$1$$`,
    tex`$$\frac{\sqrt{5}}{2}$$`,
    tex`$$\frac{\sqrt{6}}{2}$$`,
    tex`$$\frac{\sqrt{7}}{2}$$`,
  ],
  choiceText: [
    "2분의 루트 3",
    "1",
    "2분의 루트 5",
    "2분의 루트 6",
    "2분의 루트 7",
  ],
  solution: tex`$$\overline{\mathrm{OA}} \perp \beta$$이고 직선 OA가 평면
    $$\alpha$$와 이루는 각이 45°이므로 $$\overline{\mathrm{OA}} = \sqrt{3}$$,
    원 $$C_2$$의 반지름은 1이다. (가)에서 AQ는 두 평면의 교선과 평행하므로
    좌표를 잡아 계산하면 $$\triangle\mathrm{PQR} = \frac{\sqrt{7}}{2}$$.`,
  drawing: tex`구의 윤곽선은 시점이 바뀔 때마다 다시 계산하고, 단면 $$C_2$$는
    해석적으로 구한 원을 3차 베지어 곡선으로 근사했다. 구에 가려진 뒤쪽
    절반은 점선으로 판정된다.`,
};

export const PAPER_QUESTIONS: readonly QuestionSpec[] = [
  {
    no: 24,
    points: 3,
    answer: 3,
    stem: (
      <>
        좌표공간에서 세 점 A(2, 0, 0), B(0, 2, 0), C(0, 0, 2)가 있다. 원점 O에서
        평면 ABC에 내린 수선의 발을 H라 할 때, 선분 OH의 길이는?
      </>
    ),
    figure: {
      id: "coordinate-tetrahedron",
      label:
        "좌표축과 세 점 A, B, C를 지나는 평면. 평면에 가려진 축의 원점 쪽 구간과 선분 OH가 점선으로 그려진 그림",
      ratio: 0.82,
      width: 340,
    },
    caption: <>삼각형 메시 한 장에 가려진 좌표축이 점선이 됩니다.</>,
    exampleId: "coordinate-tetrahedron",
    choices: [
      tex`$$\frac{\sqrt{3}}{3}$$`,
      tex`$$\frac{\sqrt{2}}{2}$$`,
      tex`$$\frac{2\sqrt{3}}{3}$$`,
      tex`$$\sqrt{2}$$`,
      tex`$$\sqrt{3}$$`,
    ],
    choiceText: [
      "3분의 루트 3",
      "2분의 루트 2",
      "3분의 2 루트 3",
      "루트 2",
      "루트 3",
    ],
    solution: tex`평면 ABC의 방정식은 $$x + y + z = 2$$이므로
      $$\overline{\mathrm{OH}} = \frac{2}{\sqrt{3}} = \frac{2\sqrt{3}}{3}$$.`,
    drawing: (
      <>
        삼각형 ABC 한 장을 TriangleMesh로 두었다. 이 면 뒤로 지나는 좌표축의
        원점 쪽 구간과 선분 OH가 저절로 점선이 된다.
      </>
    ),
  },
  {
    no: 25,
    points: 3,
    answer: 2,
    stem: tex`그림과 같이 한 모서리의 길이가 2인 정육면체 ABCD–EFGH에서 세 점
      B, D, E를 지나는 평면과 평면 ABCD가 이루는 예각의 크기를 $$\theta$$라
      할 때, $$\cos\theta$$의 값은?`,
    figure: {
      id: "cube-section",
      label:
        "정육면체 ABCD–EFGH와 세 점 B, D, E를 지나는 단면. 가려진 모서리와 선분 DE가 점선으로 그려진 그림",
      ratio: 0.86,
      width: 290,
    },
    caption: <>옆면 위의 선분 DE는 정육면체에 가려 점선이 됩니다.</>,
    exampleId: "cube-section",
    choices: [
      tex`$$\frac{1}{3}$$`,
      tex`$$\frac{\sqrt{3}}{3}$$`,
      tex`$$\frac{\sqrt{2}}{2}$$`,
      tex`$$\frac{\sqrt{6}}{3}$$`,
      tex`$$\frac{\sqrt{3}}{2}$$`,
    ],
    choiceText: [
      "3분의 1",
      "3분의 루트 3",
      "2분의 루트 2",
      "3분의 루트 6",
      "2분의 루트 3",
    ],
    solution: tex`한 변의 길이가 $$2\sqrt{2}$$인 정삼각형 BDE의 넓이는
      $$2\sqrt{3}$$이고, 평면 ABCD 위로의 정사영은 넓이가 2인 삼각형 ABD이므로
      $$\cos\theta = \frac{2}{2\sqrt{3}} = \frac{\sqrt{3}}{3}$$.`,
    drawing: (
      <>
        정육면체를 BoxAabb로 두고 모서리 12개와 단면의 세 변을 곡선으로 넘겼다.
        옆면 AEHD 위의 선분 DE는 정육면체에 가려 점선이 된다.
      </>
    ),
  },
  {
    no: 26,
    points: 3,
    answer: 4,
    stem: tex`그림과 같이 밑면의 반지름의 길이가 2인 원기둥을 밑면과 이루는
      각의 크기가 45°인 평면 $$\alpha$$로 자를 때 생기는 단면의 넓이는?`,
    figure: {
      id: "cylinder-section",
      label:
        "원기둥과 밑면에 대하여 45° 기울어진 평면 α. 단면의 타원과 평면 아래로 가려진 부분이 점선으로 그려진 그림",
      ratio: 0.98,
      width: 300,
    },
    caption: <>원기둥과 평면이 만나는 타원을 직접 계산합니다.</>,
    exampleId: "cylinder-section",
    choices: [
      tex`$$2\sqrt{2}\pi$$`,
      tex`$$4\pi$$`,
      tex`$$2\sqrt{6}\pi$$`,
      tex`$$4\sqrt{2}\pi$$`,
      tex`$$6\pi$$`,
    ],
    choiceText: [
      "2 루트 2 파이",
      "4 파이",
      "2 루트 6 파이",
      "4 루트 2 파이",
      "6 파이",
    ],
    solution: tex`단면을 밑면 위로 정사영하면 넓이가 $$4\pi$$인 원이 되므로,
      단면의 넓이를 $$S$$라 하면 $$S\cos 45^\circ = 4\pi$$에서
      $$S = 4\sqrt{2}\pi$$.`,
    drawing: (
      <>
        원기둥(Cylinder)과 평면(PlaneRect)이 만나는 타원은 라이브러리가 직접
        계산했다. 평면 아래로 들어간 원기둥의 윤곽은 점선으로 바뀐다.
      </>
    ),
  },
  {
    no: 27,
    points: 3,
    answer: 1,
    stem: tex`그림과 같이 평면 $$\alpha$$ 위에 반지름의 길이가 3인 구 $$S$$와
      반지름의 길이가 1인 세 구 $$S_1$$, $$S_2$$, $$S_3$$이 놓여 있다. 세 구
      $$S_1$$, $$S_2$$, $$S_3$$은 모두 구 $$S$$와 접하고, 두 구 $$S_1$$,
      $$S_2$$와 두 구 $$S_2$$, $$S_3$$은 각각 서로 접한다. 두 구 $$S_1$$,
      $$S_2$$의 중심을 지나고 평면 $$\alpha$$에 수직인 평면을 $$\beta$$라 할
      때, 구 $$S$$의 중심과 평면 $$\beta$$ 사이의 거리는?`,
    figure: {
      id: "tangent-spheres",
      label:
        "평면 α 위에 놓인 구 S와 세 구 S₁, S₂, S₃, 그리고 S₁, S₂를 자르는 평면 β",
      ratio: 0.74,
      width: 420,
    },
    caption: tex`평면 $$\beta$$와 네 구가 서로 가리는 관계를 판정합니다.`,
    exampleId: "tangent-spheres",
    choices: [
      tex`$$\sqrt{11}$$`,
      tex`$$2\sqrt{3}$$`,
      tex`$$\sqrt{13}$$`,
      tex`$$\sqrt{14}$$`,
      tex`$$\sqrt{15}$$`,
    ],
    choiceText: ["루트 11", "2 루트 3", "루트 13", "루트 14", "루트 15"],
    solution: tex`구 $$S$$와 작은 구의 중심 사이의 거리는 4, 높이의 차는
      2이므로 수평 거리는 $$2\sqrt{3}$$이다. 반지름이 $$2\sqrt{3}$$인 원에서
      길이가 2인 현까지의 거리는 $$\sqrt{12 - 1} = \sqrt{11}$$.`,
    drawing: tex`네 구의 윤곽선과 평면 $$\beta$$의 단면이 서로를 가리는 관계를
      광선으로 판정했다. $$\beta$$에 가려진 구의 윤곽은 점선이 된다.`,
  },
];
