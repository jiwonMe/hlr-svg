import { Camera } from "../camera/camera.js";
import { Vec3 } from "../math/vec3.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Cone } from "../scene/primitives/cone.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import type { DemoCase } from "./types.js";
import {
  circleToCubics3,
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  sphereSilhouetteToCubics3,
  lineToCubic3,
} from "../curves/builders.js";

export function buildDemoCases(): DemoCase[] {
  const width = 700;
  const height = 520;

  const cam = Camera.from({
    kind: "perspective",
    position: new Vec3(3.2, 2.2, 4.5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  const sphere = new Sphere("sphere", new Vec3(0, 0, 0), 1);
  const cyl = new Cylinder("cyl", new Vec3(-2.0, -1.0, -0.2), new Vec3(0, 1, 0), 2.2, 0.7, "both");
  const cyl2 = new Cylinder("cyl2", new Vec3(-3.1, -0.2, -0.2), new Vec3(1, 0, 0), 2.2, 0.55, "both");
  const cone = new Cone("cone", new Vec3(1.8, -1.0, -0.3), new Vec3(0, 1, 0), 2.2, 0.9, "base");
  const cone2 = new Cone("cone2", new Vec3(1.4, -0.8, 0.2), new Vec3(0.2, 1, -0.1), 2.0, 0.85, "base");
  const box = new BoxAabb("box", new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8));
  const planeA = new PlaneRect("planeA", new Vec3(0.0, -0.2, -1.2), new Vec3(0, 1, 0.15), new Vec3(1, 0, 0), 2.2, 1.4);
  const planeB = new PlaneRect("planeB", new Vec3(0.2, 0.3, -1.0), new Vec3(1, 0.1, 0), new Vec3(0, 0, 1), 2.0, 1.6);

  const planeC = new PlaneRect("planeC", new Vec3(0.0, -0.15, 0.2), new Vec3(0, 1, 0), new Vec3(1, 0, 0), 2.8, 2.0);
  const planeD = new PlaneRect("planeD", new Vec3(0.1, 0.35, 0.0), new Vec3(0.25, 1, 0.2), new Vec3(1, 0, 0), 2.6, 1.9);

  const cubeA = new BoxAabb("cubeA", new Vec3(-1.2, -0.8, -0.6), new Vec3(-0.2, 0.2, 0.4));
  const cubeB = new BoxAabb("cubeB", new Vec3(-0.1, -0.6, -0.2), new Vec3(0.9, 0.4, 0.8));
  const cubeC = new BoxAabb("cubeC", new Vec3(0.6, -0.9, 0.2), new Vec3(1.6, 0.1, 1.2));
  const cubeD = new BoxAabb("cubeD", new Vec3(-0.5, 0.0, 0.1), new Vec3(0.5, 1.0, 1.1));

  // BoxAabb × Curved primitives test
  const boxForCurved = new BoxAabb("boxForCurved", new Vec3(-0.6, -0.6, -0.6), new Vec3(0.6, 0.6, 0.6));
  const sphereForBox = new Sphere("sphereForBox", new Vec3(0, 0, 0), 0.9);
  const cylForBox = new Cylinder("cylForBox", new Vec3(0, -1.0, 0), new Vec3(0, 1, 0), 2.0, 0.5, "both");
  const coneForBox = new Cone("coneForBox", new Vec3(0, -1.0, 0), new Vec3(0, 1, 0), 2.0, 0.8, "base");

  return [
    {
      name: "Sphere: silhouette + great circles",
      width,
      height,
      camera: cam,
      primitives: [sphere],
      includeIntersections: false,
      curves: ({ camera }) => [
        ...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: sphere.center, radius: sphere.radius }),
        ...circleToCubics3({ center: sphere.center, normal: new Vec3(0, 1, 0), radius: sphere.radius }),
        ...circleToCubics3({ center: sphere.center, normal: new Vec3(1, 0, 0), radius: sphere.radius }),
      ],
    },
    {
      name: "Cylinder: silhouette generators + rims",
      width,
      height,
      camera: cam,
      primitives: [cyl],
      includeIntersections: false,
      curves: ({ camera }) => [
        ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cyl.base, axis: cyl.axis, height: cyl.height, radius: cyl.radius }),
      ],
    },
    {
      name: "Cone: silhouette generators + base rim",
      width,
      height,
      camera: cam,
      primitives: [cone],
      includeIntersections: false,
      curves: ({ camera }) => [
        ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone.apex, axis: cone.axis, height: cone.height, baseRadius: cone.baseRadius }),
      ],
    },
    {
      name: "Box: 12 edges",
      width,
      height,
      camera: cam,
      primitives: [box],
      includeIntersections: false,
      curves: () => boxEdgesAsCubics(new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8)),
    },
    {
      name: "Intersection: Plane × Plane (with HLR)",
      width,
      height,
      camera: cam,
      primitives: [planeA, planeB],
      includeIntersections: true,
      curves: () => [],
    },
    {
      name: "Intersection: Cylinder × Cylinder (with HLR)",
      width,
      height,
      camera: cam,
      primitives: [cyl, cyl2],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cyl.base, axis: cyl.axis, height: cyl.height, radius: cyl.radius }),
        ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cyl2.base, axis: cyl2.axis, height: cyl2.height, radius: cyl2.radius }),
      ],
    },
    {
      name: "Intersection: Cylinder × Cone (with HLR)",
      width,
      height,
      camera: cam,
      // Use a separate cone with coaxial configuration to ensure intersection curves are generated
      primitives: [
        cyl,
        new Cone("coneCC", new Vec3(-2.0, -1.0, -0.2), new Vec3(0, 1, 0), 2.2, 1.4, "base"),
      ],
      includeIntersections: true,
      curves: ({ camera, primitives }) => {
        const coneCC = primitives.find((p) => p.id === "coneCC") as Cone;
        return [
          ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cyl.base, axis: cyl.axis, height: cyl.height, radius: cyl.radius }),
          ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: coneCC.apex, axis: coneCC.axis, height: coneCC.height, baseRadius: coneCC.baseRadius }),
        ];
      },
    },
    {
      name: "Intersection: Cone × Cone (with HLR)",
      width,
      height,
      camera: cam,
      primitives: [cone, cone2],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone.apex, axis: cone.axis, height: cone.height, baseRadius: cone.baseRadius }),
        ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone2.apex, axis: cone2.axis, height: cone2.height, baseRadius: cone2.baseRadius }),
      ],
    },
    {
      name: "Overlap: multiple cubes × planes (with HLR)",
      width,
      height,
      camera: Camera.from({
        kind: "perspective",
        position: new Vec3(3.6, 2.4, 3.8),
        target: new Vec3(0.2, 0.0, 0.3),
        up: new Vec3(0, 1, 0),
        fovYRad: (55 * Math.PI) / 180,
        aspect: width / height,
        near: 0.1,
        far: 100,
      }),
      primitives: [cubeA, cubeB, cubeC, cubeD, planeC, planeD],
      includeIntersections: true,
      curves: () => [
        ...boxEdgesAsCubics(cubeA.min, cubeA.max),
        ...boxEdgesAsCubics(cubeB.min, cubeB.max),
        ...boxEdgesAsCubics(cubeC.min, cubeC.max),
        ...boxEdgesAsCubics(cubeD.min, cubeD.max),
      ],
    },
    {
      name: "Full scene: silhouettes + rims + edges + intersections",
      width,
      height,
      camera: cam,
      primitives: [sphere, cyl, cyl2, cone, cone2, box, planeA, planeB],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: sphere.center, radius: sphere.radius }),
        ...circleToCubics3({ center: sphere.center, normal: new Vec3(0, 1, 0), radius: sphere.radius }),
        ...circleToCubics3({ center: sphere.center, normal: new Vec3(1, 0, 0), radius: sphere.radius }),
        ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cyl.base, axis: cyl.axis, height: cyl.height, radius: cyl.radius }),
        ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone.apex, axis: cone.axis, height: cone.height, baseRadius: cone.baseRadius }),
        ...boxEdgesAsCubics(new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8)),
      ],
    },
    {
      name: "Intersection: Box × Sphere (with HLR)",
      width,
      height,
      camera: Camera.from({
        kind: "perspective",
        position: new Vec3(2.5, 1.8, 2.5),
        target: new Vec3(0, 0, 0),
        up: new Vec3(0, 1, 0),
        fovYRad: (55 * Math.PI) / 180,
        aspect: width / height,
        near: 0.1,
        far: 100,
      }),
      primitives: [boxForCurved, sphereForBox],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: sphereForBox.center, radius: sphereForBox.radius }),
        ...boxEdgesAsCubics(boxForCurved.min, boxForCurved.max),
      ],
    },
    {
      name: "Intersection: Box × Cylinder (with HLR)",
      width,
      height,
      camera: Camera.from({
        kind: "perspective",
        position: new Vec3(2.5, 1.8, 2.5),
        target: new Vec3(0, 0, 0),
        up: new Vec3(0, 1, 0),
        fovYRad: (55 * Math.PI) / 180,
        aspect: width / height,
        near: 0.1,
        far: 100,
      }),
      primitives: [boxForCurved, cylForBox],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cylForBox.base, axis: cylForBox.axis, height: cylForBox.height, radius: cylForBox.radius }),
        ...boxEdgesAsCubics(boxForCurved.min, boxForCurved.max),
      ],
    },
    {
      name: "Intersection: Box × Cone (with HLR)",
      width,
      height,
      camera: Camera.from({
        kind: "perspective",
        position: new Vec3(2.5, 1.8, 2.5),
        target: new Vec3(0, 0, 0),
        up: new Vec3(0, 1, 0),
        fovYRad: (55 * Math.PI) / 180,
        aspect: width / height,
        near: 0.1,
        far: 100,
      }),
      primitives: [boxForCurved, coneForBox],
      includeIntersections: true,
      curves: ({ camera }) => [
        ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: coneForBox.apex, axis: coneForBox.axis, height: coneForBox.height, baseRadius: coneForBox.baseRadius }),
        ...boxEdgesAsCubics(boxForCurved.min, boxForCurved.max),
      ],
    },
  ];
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


