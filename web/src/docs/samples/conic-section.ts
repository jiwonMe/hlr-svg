import { Scene, Camera, SvgRenderer, Cone, PlaneRect, Vec3 } from "hlr";

// Conic section 예제
// - Cone(원뿔)을 PlaneRect(평면)로 비스듬히 자르면 교차 곡선이 원뿔 곡선(원/타원/포물선/쌍곡선)이 됩니다.

const width = 700;
const height = 520;

const scene = new Scene();

const cone = new Cone("cone", new Vec3(0.0, -1.2, 0.0), new Vec3(0.1, 1.0, -0.15), 2.6, 1.0, "base");
const plane = new PlaneRect(
  "plane",
  new Vec3(0.15, 0.1, -0.1),
  new Vec3(0.0, 1.0, 0.25),
  new Vec3(1.0, 0.0, 0.0),
  2.6,
  1.9
);

scene.add(cone);
scene.add(plane);

const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(3.8, 2.4, 5.2),
  target: new Vec3(0.0, 0.1, 0.0),
  up: new Vec3(0, 1, 0),
  fovYRad: (55 * Math.PI) / 180,
  aspect: width / height,
  near: 0.1,
  far: 100,
});

const renderer = new SvgRenderer({
  width,
  height,
  background: false,
  style: {
    strokeWidthVisible: 2,
    strokeWidthHidden: 2,
    dashArrayHidden: "6 6",
    opacityHidden: 0.4,
  },
  include: {
    intersections: true,
  },
});

const svg = renderer.render(scene, camera);
console.log(svg);
