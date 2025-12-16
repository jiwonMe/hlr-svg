import { Camera } from "../../camera/camera.js";
import { Vec3 } from "../../math/vec3.js";
import { Sphere } from "../../scene/primitives/sphere.js";
import { Cylinder } from "../../scene/primitives/cylinder.js";
import { Cone } from "../../scene/primitives/cone.js";
import { BoxAabb } from "../../scene/primitives/boxAabb.js";
import type { DemoCase } from "../types.js";
import {
  cylinderSilhouetteToCubics3,
  coneSilhouetteToCubics3,
  sphereSilhouetteToCubics3,
  lineToCubic3,
} from "../../curves/builders.js";

export function buildSimplePrimitivesCase(): DemoCase {
  const width = 700;
  const height = 520;

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
  const cylinder = new Cylinder("cyl", new Vec3(0.4, -1.1, -0.2), new Vec3(0, 1, 0), 2.4, 0.65, "both");
  const cone = new Cone("cone", new Vec3(2.2, 1.2, 0.0), new Vec3(0, -1, 0), 2.2, 0.9, "base");
  const box = new BoxAabb("box", new Vec3(-0.6, -0.9, 1.3), new Vec3(0.8, 0.5, 2.7));

  return {
    name: "Simple primitives: Sphere / Cylinder / Cone / Box",
    width,
    height,
    camera,
    primitives: [sphere, cylinder, cone, box],
    includeIntersections: false,
    curves: ({ camera }) => [
      ...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: sphere.center, radius: sphere.radius }),
      ...cylinderSilhouetteToCubics3({ cameraPos: camera.position, base: cylinder.base, axis: cylinder.axis, height: cylinder.height, radius: cylinder.radius }),
      ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone.apex, axis: cone.axis, height: cone.height, baseRadius: cone.baseRadius }),
      ...boxEdgesAsCubics(box.min, box.max),
    ],
  };
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
