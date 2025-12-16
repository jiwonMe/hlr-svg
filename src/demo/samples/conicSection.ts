import { Camera } from "../../camera/camera.js";
import { Vec3 } from "../../math/vec3.js";
import { Cone } from "../../scene/primitives/cone.js";
import { PlaneRect } from "../../scene/primitives/planeRect.js";
import type { DemoCase } from "../types.js";
import { coneSilhouetteToCubics3 } from "../../curves/builders.js";

export function buildConicSectionCase(): DemoCase {
  const width = 700;
  const height = 520;

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

  // Cone (z축 쪽으로 약간 기울어진 원뿔)
  const cone = new Cone("cone", new Vec3(0.0, -1.2, 0.0), new Vec3(0.1, 1.0, -0.15), 2.6, 1.0, "base");

  // PlaneRect (원뿔을 비스듬히 자르는 평면)
  const plane = new PlaneRect(
    "plane",
    new Vec3(0.15, 0.1, -0.1),
    new Vec3(0.0, 1.0, 0.25),
    new Vec3(1.0, 0.0, 0.0),
    2.6,
    1.9
  );

  return {
    name: "Conic section: Plane × Cone (ellipse / hyperbola / parabola)",
    width,
    height,
    camera,
    primitives: [cone, plane],
    includeIntersections: true,
    curves: ({ camera }) => [
      ...coneSilhouetteToCubics3({ cameraPos: camera.position, apex: cone.apex, axis: cone.axis, height: cone.height, baseRadius: cone.baseRadius }),
    ],
  };
}
