import { BoxAabb, Camera, Scene, SvgRenderer, Vec3, lineToCubic3 } from "hlr";

// 한 모서리의 길이가 2인 정육면체 ABCD–EFGH와 세 점 B, D, E를 지나는 단면.
// 윗면이 ABCD, 아랫면이 EFGH이고 A–E, B–F, C–G, D–H가 세로 모서리입니다.
// BoxAabb의 모서리 12개는 렌더러가 그리고, 단면의 세 변은 곡선으로 더합니다.
// 옆면 AEHD 위의 선분 DE와 꼭짓점 H에 모이는 모서리는 가려져 점선이 됩니다.

const width = 480;
const height = 420;

const B = new Vec3(1, 1, 1);
const D = new Vec3(-1, 1, -1);
const E = new Vec3(-1, -1, 1);

const scene = new Scene([
  new BoxAabb("cube", new Vec3(-1, -1, -1), new Vec3(1, 1, 1)),
]);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(13.2, 10.8, 20),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 1.75,
  aspect: width / height,
  near: 0.1,
  far: 100,
});

const svg = new SvgRenderer({ width, height }).render(scene, camera, {
  curves: [lineToCubic3(B, D), lineToCubic3(D, E), lineToCubic3(E, B)],
});
console.log(svg);
