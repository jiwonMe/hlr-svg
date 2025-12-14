import { Camera } from "../camera/camera.js";
import { Vec3 } from "../math/vec3.js";
import { circleToCubics3, coneSilhouetteToCubics3, cylinderSilhouetteToCubics3, lineToCubic3, sphereSilhouetteToCubics3 } from "../curves/builders.js";
import { splitCubicByVisibility } from "../hlr/splitByVisibility.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";
import { piecesToSvg } from "../svg/svgWriter.js";
import { Scene } from "../scene/scene.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Cone } from "../scene/primitives/cone.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";

function main(): void {
  const width = 900;
  const height = 650;

  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(3.2, 2.2, 4.5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  // Occluders (scene primitives)
  const sphere = new Sphere("sphere", new Vec3(0, 0, 0), 1);
  const cylinder = new Cylinder("cyl", new Vec3(-2.0, -1.0, -0.2), new Vec3(0, 1, 0), 2.2, 0.7, "both");
  const cone = new Cone("cone", new Vec3(1.8, -1.0, -0.3), new Vec3(0, 1, 0), 2.2, 0.9, "base");
  const box = new BoxAabb("box", new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8));

  const scene = new Scene([sphere, cylinder, cone, box], camera);

  // Curves to draw (edges / circles)
  const cubics = [
    // Sphere silhouette (occluding contour)
    ...sphereSilhouetteToCubics3({ cameraPos: camera.position, center: new Vec3(0, 0, 0), radius: 1 }),

    // Sphere equator (XZ plane)
    ...circleToCubics3({ center: new Vec3(0, 0, 0), normal: new Vec3(0, 1, 0), radius: 1 }),
    // Sphere "meridian" (YZ plane)
    ...circleToCubics3({ center: new Vec3(0, 0, 0), normal: new Vec3(1, 0, 0), radius: 1 }),

    // Cylinder base circle (y = -1.0)
    ...circleToCubics3({ center: new Vec3(-2.0, -1.0, -0.2), normal: new Vec3(0, 1, 0), radius: 0.7 }),
    // Cylinder top circle (y = 1.2)
    ...circleToCubics3({ center: new Vec3(-2.0, 1.2, -0.2), normal: new Vec3(0, 1, 0), radius: 0.7 }),
    // Cylinder generators(모선 2개) - 원래 데모 구도 유지 + 추가
    ...cylinderSilhouetteToCubics3({
      cameraPos: camera.position,
      base: new Vec3(-2.0, -1.0, -0.2),
      axis: new Vec3(0, 1, 0),
      height: 2.2,
      radius: 0.7,
    }),

    // Cone base circle (y = -1.0 + height)
    ...circleToCubics3({ center: new Vec3(1.8, 1.2, -0.3), normal: new Vec3(0, 1, 0), radius: 0.9 }),
    // Cone generators(모선 2개) - 원래 데모 구도 유지 + 추가
    ...coneSilhouetteToCubics3({
      cameraPos: camera.position,
      apex: new Vec3(1.8, -1.0, -0.3),
      axis: new Vec3(0, 1, 0),
      height: 2.2,
      baseRadius: 0.9,
    }),

    // Box edges (AABB 12 edges)
    ...boxEdgesAsCubics(new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8)),
  ];

  const params = {
    samples: 192,
    refineIters: 22,
    epsVisible: 2e-4,
    cutEps: 1e-6,
    minSegLenSq: 1e-6,
  } as const;

  const pieces: StyledPiece[] = [];
  for (const b of cubics) {
    pieces.push(...splitCubicByVisibility(b, scene, params));
  }

  // z-order(선택): visible을 뒤에 두면 solid가 dashed 위에 올라가 보임
  const sorted = [...pieces].sort((a, b) => Number(a.visible) - Number(b.visible));

  const svg = piecesToSvg(sorted, camera, {
    width,
    height,
    style: { strokeWidth: 1.8, dashArrayHidden: "4 4" },
  });

  process.stdout.write(svg);
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

main();


