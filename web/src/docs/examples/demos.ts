import { Camera } from "@hlr/camera/camera.js";
import {
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "@hlr/curves/builders.js";
import type { DemoCase } from "@hlr/demo/types.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";

/** Scenes for the general (non-exam) examples, shared by gallery and pages. */
export function buildSimplePrimitivesDemo(
  width: number,
  height: number,
): DemoCase {
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

  const sphere = new Sphere("sphere", new Vec3(-1.6, 0.2, 0.0), 1.0);
  const cylinder = new Cylinder(
    "cyl",
    new Vec3(0.4, -1.1, -0.2),
    new Vec3(0, 1, 0),
    2.4,
    0.65,
    "both",
  );
  const cone = new Cone(
    "cone",
    new Vec3(2.2, 1.2, 0.0),
    new Vec3(0, -1, 0),
    2.2,
    0.9,
    "base",
  );
  const box = new BoxAabb(
    "box",
    new Vec3(-0.6, -0.9, 1.3),
    new Vec3(0.8, 0.5, 2.7),
  );

  return {
    name: "simple-primitives",
    width,
    height,
    camera,
    primitives: [sphere, cylinder, cone, box],
    includeIntersections: false,
    curves: ({ camera }) => [
      ...sphereSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        center: sphere.center,
        radius: sphere.radius,
      }),
      ...cylinderSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        base: cylinder.base,
        axis: cylinder.axis,
        height: cylinder.height,
        radius: cylinder.radius,
      }),
      ...coneSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        apex: cone.apex,
        axis: cone.axis,
        height: cone.height,
        baseRadius: cone.baseRadius,
      }),
      ...boxEdgesAsCubics(box.min, box.max),
    ],
  };
}

export function buildRandomPrimitivesDemo(
  width: number,
  height: number,
  seed: number,
): DemoCase {
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
    name: `random-primitives (seed: ${seed})`,
    width,
    height,
    camera,
    primitives,
    includeIntersections: true,
    curves: ({ camera, primitives }) => {
      const out: ReturnType<typeof sphereSilhouetteToCubics3> = [];
      for (const p of primitives) {
        if (p instanceof Sphere)
          out.push(
            ...sphereSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              center: p.center,
              radius: p.radius,
            }),
          );
        else if (p instanceof Cylinder)
          out.push(
            ...cylinderSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              base: p.base,
              axis: p.axis,
              height: p.height,
              radius: p.radius,
            }),
          );
        else if (p instanceof Cone)
          out.push(
            ...coneSilhouetteToCubics3({
              cameraPos: camera.position,
              viewDirection:
                camera.kind === "orthographic" ? camera.forward : undefined,
              apex: p.apex,
              axis: p.axis,
              height: p.height,
              baseRadius: p.baseRadius,
            }),
          );
        else if (p instanceof BoxAabb)
          out.push(...boxEdgesAsCubics(p.min, p.max));
      }
      return out;
    },
  };
}

export function buildConicSectionDemo(
  width: number,
  height: number,
  tilt: number,
): DemoCase {
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

  const cone = new Cone(
    "cone",
    new Vec3(0.0, -1.2, 0.0),
    new Vec3(0.1, 1.0, -0.15),
    2.6,
    1.0,
    "base",
  );
  const plane = new PlaneRect(
    "plane",
    new Vec3(0.15, 0.1, -0.1),
    new Vec3(0.0, 1.0, tilt),
    new Vec3(1.0, 0.0, 0.0),
    2.6,
    1.9,
  );

  return {
    name: "conic-section",
    width,
    height,
    camera,
    primitives: [cone, plane],
    includeIntersections: true,
    curves: ({ camera }) => [
      ...coneSilhouetteToCubics3({
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
        apex: cone.apex,
        axis: cone.axis,
        height: cone.height,
        baseRadius: cone.baseRadius,
      }),
    ],
  };
}

function createRandomPrimitives(rng: () => number, count: number) {
  const out: Array<Sphere | Cylinder | Cone | BoxAabb> = [];

  for (let i = 0; i < count; i++) {
    const t = Math.floor(rng() * 4);
    const pos = new Vec3(
      randRange(rng, -3.5, 3.5),
      randRange(rng, -2.0, 2.0),
      randRange(rng, -2.5, 2.5),
    );
    const id = `p_${i}`;

    if (t === 0) out.push(new Sphere(id, pos, randRange(rng, 0.45, 1.15)));
    else if (t === 1)
      out.push(
        new Cylinder(
          id,
          pos,
          randUnitVec3(rng),
          randRange(rng, 1.0, 2.5),
          randRange(rng, 0.3, 0.8),
          "both",
        ),
      );
    else if (t === 2)
      out.push(
        new Cone(
          id,
          pos,
          randUnitVec3(rng),
          randRange(rng, 1.0, 2.5),
          randRange(rng, 0.5, 1.0),
          "base",
        ),
      );
    else {
      const size = randRange(rng, 0.5, 1.2);
      out.push(
        new BoxAabb(
          id,
          pos,
          Vec3.add(pos, new Vec3(size, size * randRange(rng, 0.6, 1.6), size)),
        ),
      );
    }
  }

  return out;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randUnitVec3(rng: () => number): Vec3 {
  const v = new Vec3(
    randRange(rng, -1, 1),
    randRange(rng, -1, 1),
    randRange(rng, -1, 1),
  );
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

function boxEdgesAsCubics(min: Vec3, max: Vec3) {
  const x0 = min.x,
    y0 = min.y,
    z0 = min.z;
  const x1 = max.x,
    y1 = max.y,
    z1 = max.z;

  const v000 = new Vec3(x0, y0, z0);
  const v100 = new Vec3(x1, y0, z0);
  const v010 = new Vec3(x0, y1, z0);
  const v110 = new Vec3(x1, y1, z0);
  const v001 = new Vec3(x0, y0, z1);
  const v101 = new Vec3(x1, y0, z1);
  const v011 = new Vec3(x0, y1, z1);
  const v111 = new Vec3(x1, y1, z1);

  const edges: Array<[Vec3, Vec3]> = [
    [v000, v100],
    [v010, v110],
    [v001, v101],
    [v011, v111],
    [v000, v010],
    [v100, v110],
    [v001, v011],
    [v101, v111],
    [v000, v001],
    [v100, v101],
    [v010, v011],
    [v110, v111],
  ];

  return edges.map(([a, b]) => lineToCubic3(a, b));
}

/** A small octahedron mesh whose edges stand in for an imported OBJ/STL. */
export function buildMeshPreviewDemo(width: number, height: number): DemoCase {
  const r = 1.6;
  const vertices = [
    new Vec3(0, r, 0),
    new Vec3(0, -r, 0),
    new Vec3(r, 0, 0),
    new Vec3(0, 0, r),
    new Vec3(-r, 0, 0),
    new Vec3(0, 0, -r),
  ];
  const faces: [number, number, number][] = [
    [0, 3, 2],
    [0, 4, 3],
    [0, 5, 4],
    [0, 2, 5],
    [1, 2, 3],
    [1, 3, 4],
    [1, 4, 5],
    [1, 5, 2],
  ];
  const mesh = new TriangleMesh("octahedron", vertices, faces);
  return {
    name: "mesh-preview",
    width,
    height,
    camera: Camera.from({
      kind: "orthographic",
      position: new Vec3(7, 4.2, 9),
      target: Vec3.zero(),
      up: new Vec3(0, 1, 0),
      halfHeight: 2.25 * Math.max(1, (height / width) * 1.1),
      aspect: width / height,
      near: 0.1,
      far: 100,
    }),
    primitives: [mesh],
    includeIntersections: false,
    curves: ({ camera }) =>
      mesh
        .featureEdges(camera)
        .map((edge) => lineToCubic3(edge.start, edge.end)),
  };
}
