import { Camera, Scene, SvgRenderer, TriangleMesh, Vec3, lineToCubic3 } from "hlr";

// 좌표공간의 세 점 A(2, 0, 0), B(0, 2, 0), C(0, 0, 2)를 지나는 평면과 좌표축.
// 수학의 (x, y, z)를 y가 위쪽인 장면 좌표 (y, z, x)로 옮겨 그립니다.
// 삼각형 ABC를 면 하나짜리 TriangleMesh로 두면 이 면이 가림면이 되어,
// 그 뒤를 지나는 좌표축의 원점 쪽 구간과 선분 OH가 점선으로 판정됩니다.

const width = 480;
const height = 400;
const space = (x: number, y: number, z: number) => new Vec3(y, z, x);

const O = space(0, 0, 0);
const A = space(2, 0, 0);
const B = space(0, 2, 0);
const C = space(0, 0, 2);
const H = space(2 / 3, 2 / 3, 2 / 3); // O에서 평면 ABC에 내린 수선의 발

const scene = new Scene([new TriangleMesh("plane-abc", [A, B, C], [[0, 1, 2]])]);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(12.6, 10.2, 26.6),
  target: new Vec3(1.05, 1.32, 0.39),
  up: new Vec3(0, 1, 0),
  halfHeight: 2.2,
  aspect: width / height,
  near: 0.1,
  far: 100,
});

// 삼각형의 세 변은 메시 경계선으로 그려지고, 좌표축과 OH는 곡선으로 더합니다.
const axes = [space(3.15, 0, 0), space(0, 3.15, 0), space(0, 0, 3.05)];
const svg = new SvgRenderer({ width, height }).render(scene, camera, {
  curves: [...axes.map((end) => lineToCubic3(O, end)), lineToCubic3(O, H)],
});
console.log(svg);
