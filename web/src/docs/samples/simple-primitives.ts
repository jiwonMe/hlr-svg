import { Scene, Camera, SvgRenderer, Sphere, Cylinder, Cone, BoxAabb, Vec3 } from "hlr";

// 단순 primitives 예제
// - Sphere / Cylinder / Cone / BoxAabb 를 한 장면에 배치하고 SVG로 렌더링

const width = 700;
const height = 520;

const scene = new Scene();

scene.add(new Sphere("sphere", new Vec3(-1.6, 0.2, 0.0), 1.0));
scene.add(new Cylinder("cyl", new Vec3(0.4, -1.1, -0.2), new Vec3(0, 1, 0), 2.4, 0.65, "both"));
scene.add(new Cone("cone", new Vec3(2.2, 1.2, 0.0), new Vec3(0, -1, 0), 2.2, 0.9, "base"));
scene.add(new BoxAabb("box", new Vec3(-0.6, -0.9, 1.3), new Vec3(0.8, 0.5, 2.7)));

const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(4.2, 2.8, 5.4),
  target: new Vec3(0.2, 0.0, 0.0),
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
});

const svg = renderer.render(scene, camera);
console.log(svg);
