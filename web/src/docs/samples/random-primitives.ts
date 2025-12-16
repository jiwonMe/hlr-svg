import { Scene, Camera, SvgRenderer, Sphere, Cylinder, Cone, BoxAabb, Vec3 } from "hlr";

// 랜덤 도형 생성 예제 (seed 기반)
// - seed만 고정하면 문서/CI에서 항상 동일한 결과를 얻을 수 있습니다.

const width = 700;
const height = 520;

const seed = 1337;
const rng = mulberry32(seed);

const scene = new Scene();

for (let i = 0; i < 10; i++) {
  const t = Math.floor(rng() * 4);
  const pos = new Vec3(randRange(-3.5, 3.5), randRange(-2.0, 2.0), randRange(-2.5, 2.5));

  if (t === 0) {
    scene.add(new Sphere(`p_${i}`, pos, randRange(0.45, 1.15)));
    continue;
  }

  if (t === 1) {
    scene.add(new Cylinder(`p_${i}`, pos, randUnitVec3(), randRange(1.0, 2.5), randRange(0.3, 0.8), "both"));
    continue;
  }

  if (t === 2) {
    scene.add(new Cone(`p_${i}`, pos, randUnitVec3(), randRange(1.0, 2.5), randRange(0.5, 1.0), "base"));
    continue;
  }

  const size = randRange(0.5, 1.2);
  scene.add(new BoxAabb(`p_${i}`, pos, Vec3.add(pos, new Vec3(size, size * randRange(0.6, 1.6), size))));
}

const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(5.0, 3.6, 6.2),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  fovYRad: (50 * Math.PI) / 180,
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

function randRange(min: number, max: number): number {
  return min + rng() * (max - min);
}

function randUnitVec3(): Vec3 {
  const v = new Vec3(randRange(-1, 1), randRange(-1, 1), randRange(-1, 1));
  return Vec3.normalize(v);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
