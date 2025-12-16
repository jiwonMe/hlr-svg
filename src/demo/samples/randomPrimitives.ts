import { Camera } from "../../camera/camera.js";
import { Vec3 } from "../../math/vec3.js";
import { Sphere } from "../../scene/primitives/sphere.js";
import { Cylinder } from "../../scene/primitives/cylinder.js";
import { Cone } from "../../scene/primitives/cone.js";
import { BoxAabb } from "../../scene/primitives/boxAabb.js";
import type { DemoCase } from "../types.js";
import type { Primitive } from "../../scene/primitive.js";
import {
  cylinderSilhouetteToCubics3,
  coneSilhouetteToCubics3,
  sphereSilhouetteToCubics3,
  lineToCubic3,
} from "../../curves/builders.js";

export function buildRandomPrimitivesCase(seed = 1337): DemoCase {
  const width = 700;
  const height = 520;

  const rng = mulberry32(seed);

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

  const primitives = createRandomPrimitives(rng, 10);

  return {
    name: `Random primitives (seed: ${seed})`,
    width,
    height,
    camera,
    primitives,
    includeIntersections: true,
    curves: ({ camera, primitives }) => buildCurvesForPrimitives(camera.position, primitives),
  };
}

function buildCurvesForPrimitives(cameraPos: Vec3, primitives: readonly Primitive[]) {
  const out: ReturnType<typeof sphereSilhouetteToCubics3> = [];

  for (const p of primitives) {
    if (p instanceof Sphere) {
      out.push(...sphereSilhouetteToCubics3({ cameraPos, center: p.center, radius: p.radius }));
      continue;
    }

    if (p instanceof Cylinder) {
      out.push(...cylinderSilhouetteToCubics3({ cameraPos, base: p.base, axis: p.axis, height: p.height, radius: p.radius }));
      continue;
    }

    if (p instanceof Cone) {
      out.push(...coneSilhouetteToCubics3({ cameraPos, apex: p.apex, axis: p.axis, height: p.height, baseRadius: p.baseRadius }));
      continue;
    }

    if (p instanceof BoxAabb) {
      out.push(...boxEdgesAsCubics(p.min, p.max));
    }
  }

  return out;
}

function createRandomPrimitives(rng: () => number, count: number): Primitive[] {
  const primitives: Primitive[] = [];

  for (let i = 0; i < count; i++) {
    const t = Math.floor(rng() * 4);
    const pos = new Vec3(randRange(rng, -3.5, 3.5), randRange(rng, -2.0, 2.0), randRange(rng, -2.5, 2.5));
    const id = `p_${i}`;

    if (t === 0) {
      primitives.push(new Sphere(id, pos, randRange(rng, 0.45, 1.15)));
      continue;
    }

    if (t === 1) {
      primitives.push(new Cylinder(id, pos, randUnitVec3(rng), randRange(rng, 1.0, 2.5), randRange(rng, 0.3, 0.8), "both"));
      continue;
    }

    if (t === 2) {
      primitives.push(new Cone(id, pos, randUnitVec3(rng), randRange(rng, 1.0, 2.5), randRange(rng, 0.5, 1.0), "base"));
      continue;
    }

    const size = randRange(rng, 0.5, 1.2);
    primitives.push(new BoxAabb(id, pos, Vec3.add(pos, new Vec3(size, size * randRange(rng, 0.6, 1.6), size))));
  }

  return primitives;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randUnitVec3(rng: () => number): Vec3 {
  const v = new Vec3(randRange(rng, -1, 1), randRange(rng, -1, 1), randRange(rng, -1, 1));
  return Vec3.normalize(v);
}

function boxEdgesAsCubics(min: Vec3, max: Vec3) {
  const x0 = min.x, y0 = min.y, z0 = min.z;
  const x1 = max.x, y1 = max.y, z1 = max.z;

  const v000 = new Vec3(x0, y0, z0);
  const v100 = new Vec3(x1, y0, z0);
  const v010 = new Vec3(x0, y1, z0);
  const v110 = new Vec3(x1, y1, z0);
  const v001 = new Vec3(x0, y0, z1);
  const v101 = new Vec3(x1, y0, z1);
  const v011 = new Vec3(x0, y1, z1);
  const v111 = new Vec3(x1, y1, z1);

  const edges: Array<[Vec3, Vec3]> = [
    [v000, v100], [v010, v110], [v001, v101], [v011, v111],
    [v000, v010], [v100, v110], [v001, v011], [v101, v111],
    [v000, v001], [v100, v101], [v010, v011], [v110, v111],
  ];

  return edges.map(([a, b]) => lineToCubic3(a, b));
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
