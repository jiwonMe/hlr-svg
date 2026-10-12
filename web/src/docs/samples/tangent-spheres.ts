import {
  buildTangentSpheresDemo,
  renderTangentSpheresSvg,
} from "@hlr/demo/tangentSpheres.js";

// 반지름 3인 구 S에 외접하는 반지름 1인 세 구 S₁·S₂·S₃.
// 작은 구들은 평면 α 위에 놓이며 S₁–S₂, S₂–S₃가 서로 접합니다.
// S₁과 S₃ 사이에는 간격이 있습니다.
// 기본 시점은 직교 등각 투영(Isometric)이며 라벨도 3D 위치를 따라 움직입니다.
// 평면 β는 S₁·S₂를 자르는 실제 가림면입니다.
// β와 구의 교선은 깊이를 비교해 보이는 부분은 실선, 가려지는 부분은 점선으로 표시합니다.

const width = 700;
const height = 520;
const demo = buildTangentSpheresDemo(width, height);

// 웹 예제와 같은 도형·카메라·라벨로 선 도식을 만듭니다.
// 웹에서는 표면 조명을 켜 곡면의 명암을 실시간으로 채색합니다.
// β는 흰색을 유지하면서 뒤쪽 구의 채색을 가리고, SVG 저장에도 같은 clip을 적용합니다.
const svg = renderTangentSpheresSvg(demo.camera, width, height);
console.log(svg);
