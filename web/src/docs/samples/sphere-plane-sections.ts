import {
  buildSpherePlaneSectionsDemo,
  renderSpherePlaneSectionsSvg,
} from "@hlr/demo/spherePlaneSections.js";

// 반지름 2인 구를 45°를 이루는 두 평면으로 자른 원 C₁·C₂의 수학 도식.
// 주어진 관계: OP ∥ AQ, ∠QAR = 90°.
// 평면은 윤곽선으로만 표시하므로 구의 채색이나 숨은선을 가리지 않습니다.
// 라벨·보조선은 3D 위치에 연결되어 camera가 움직여도 함께 투영됩니다.

const width = 700;
const height = 520;
const demo = buildSpherePlaneSectionsDemo(width, height);

// 웹 예제와 동일한 도형 정의, 초기 시점, 라벨을 사용합니다.
const svg = renderSpherePlaneSectionsSvg(demo.camera, width, height);
console.log(svg);
