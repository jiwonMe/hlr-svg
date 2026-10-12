import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import {
  buildSurfaceBuffer,
  shadeSurfaceBuffer,
  buildSurfaceClipPaths,
} from "../dist/core/surfaceRenderer.js";
import { bruteSurfaceBuffer } from "../test/helpers/surface-oracle.mjs";

const scenes = [
  [
    "spheres",
    [
      new Sphere("a", new Vec3(-0.45, 0, 0), 1),
      new Sphere("b", new Vec3(0.45, 0.1, 0.4), 0.9),
      new Sphere("c", new Vec3(0.1, 0.5, -0.2), 0.65),
    ],
  ],
  [
    "curved",
    [
      new Sphere("a", new Vec3(-0.35, 0.2, 0.1), 1),
      new Cylinder(
        "b",
        new Vec3(0.2, -1, -0.2),
        new Vec3(0.1, 1, 0.15),
        2.2,
        0.75,
      ),
      new Cone("c", new Vec3(-0.4, 1.2, 0.3), new Vec3(0.1, -1, 0.1), 2.4, 0.9),
    ],
  ],
  [
    "mixed",
    [
      new BoxAabb("a", new Vec3(-0.9, -0.8, -0.7), new Vec3(0.5, 0.7, 0.5)),
      new Cylinder("b", new Vec3(0.35, -1, 0), new Vec3(0, 1, 0.2), 2.2, 0.65),
      new Cone("c", new Vec3(-0.4, 1.2, 0.3), new Vec3(0.1, -1, 0.1), 2.4, 0.9),
    ],
  ],
];
function median(operation) {
  const times = [];
  for (let i = 0; i < 9; i++) {
    const start = performance.now();
    operation();
    if (i >= 2) times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[3];
}
const rows = [];
for (const [width, height] of [
  [720, 520],
  [320, 231],
]) {
  for (const kind of ["orthographic", "perspective"]) {
    const camera = Camera.from({
      kind,
      position: new Vec3(3.2, 2.2, 4.5),
      target: Vec3.zero(),
      up: new Vec3(0, 1, 0),
      near: 0.1,
      far: 100,
      aspect: width / height,
      ...(kind === "orthographic"
        ? { halfHeight: 2 }
        : { fovYRad: Math.PI / 3 }),
    });
    for (const [scene, primitives] of scenes) {
      const options = { width, height };
      const reference = bruteSurfaceBuffer(primitives, camera, options);
      const buffer = buildSurfaceBuffer(primitives, camera, options);
      assert.deepEqual(buffer.primitiveIndices, reference.primitiveIndices);
      let maxDepthError = 0,
        maxNormalError = 0;
      for (let pixel = 0; pixel < buffer.depth.length; pixel++) {
        if (buffer.primitiveIndices[pixel] < 0) continue;
        maxDepthError = Math.max(
          maxDepthError,
          Math.abs(buffer.depth[pixel] - reference.depth[pixel]),
        );
        for (let axis = 0; axis < 3; axis++)
          maxNormalError = Math.max(
            maxNormalError,
            Math.abs(
              buffer.normals[pixel * 3 + axis] -
                reference.normals[pixel * 3 + axis],
            ),
          );
      }
      assert.ok(maxDepthError < 2e-6 && maxNormalError < 2e-6);
      const baselineMs = median(() =>
        bruteSurfaceBuffer(primitives, camera, options),
      );
      const optimizedMs = median(() =>
        buildSurfaceBuffer(primitives, camera, options),
      );
      const lighting = {
        lightDirection: new Vec3(0.2, 0.6, 1),
        selectedId: "a",
      };
      rows.push({
        width,
        height,
        kind,
        scene,
        baselineMs,
        optimizedMs,
        speedup: baselineMs / optimizedMs,
        shadeMs: median(() => shadeSurfaceBuffer(buffer, lighting)),
        clipMs: median(() => buildSurfaceClipPaths(buffer)),
        maxDepthError,
        maxNormalError,
      });
    }
  }
}
console.log(JSON.stringify(rows, null, 2));
