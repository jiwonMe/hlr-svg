import { Camera, Cylinder, PlaneRect, Scene, SvgRenderer, Vec3 } from "hlr";

// 밑면의 반지름이 2인 원기둥을 밑면과 45°를 이루는 평면 α로 자른 그림.
// 원기둥과 평면이 만나는 타원은 렌더러가 교선으로 직접 계산합니다.
// 평면은 불투명한 가림면이라, 평면 아래로 들어간 원기둥의 윤곽은 점선이 됩니다.
// 단면을 밑면에 정사영하면 넓이가 4π인 원이 되므로 단면의 넓이는 4√2π입니다.

const width = 480;
const height = 470;

const scene = new Scene([
  new Cylinder("cylinder", new Vec3(0, 0, 0), new Vec3(0, 1, 0), 6, 2, "both"),
  // 법선 (0, 1, 1)은 밑면의 법선 (0, 1, 0)과 45°를 이룹니다.
  new PlaneRect("alpha", new Vec3(0, 3, 0), new Vec3(0, 1, 1), new Vec3(1, 0, 0), 3.15, 3.25),
]);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(14.8, 15.4, 20),
  target: new Vec3(0, 3, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 4.2,
  aspect: width / height,
  near: 0.1,
  far: 100,
});

const svg = new SvgRenderer({ width, height }).render(scene, camera);
console.log(svg);
