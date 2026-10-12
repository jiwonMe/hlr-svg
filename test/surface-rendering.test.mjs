import test from "node:test";
import assert from "node:assert/strict";

import { Camera } from "../dist/camera/camera.js";
import {
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
  lightDirectionFromAngles,
  shadeSurfaceBuffer,
} from "../dist/core/surfaceRenderer.js";
import { Vec3 } from "../dist/math/vec3.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";

for (const kind of ["perspective", "orthographic"]) {
  test(`${kind} box clipping returns the real exit surface rather than a near-plane hit`, () => {
    const cameraParams = {
      kind,
      position: new Vec3(0, 0, 5),
      target: Vec3.zero(),
      up: new Vec3(0, 1, 0),
      aspect: 1,
      near: 4.5,
      far: 10,
      ...(kind === "perspective" ? { fovYRad: Math.PI / 3 } : { halfHeight: 2 }),
    };
    const box = new BoxAabb("box", new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    const buffer = buildSurfaceBuffer([box], Camera.from(cameraParams), { width: 1, height: 1 });

    assert.equal(buffer.primitiveIndices[0], 0);
    assert.equal(buffer.depth[0], 6);
    assert.deepEqual(Array.from(buffer.normals), [0, 0, -1]);

    // Both real faces are clipped here; the interior has no surface to fill.
    const clipped = buildSurfaceBuffer([box], Camera.from({ ...cameraParams, far: 5.5 }), { width: 1, height: 1 });
    assert.equal(clipped.primitiveIndices[0], -1);
    assert.equal(clipped.depth[0], Infinity);
  });

  test(`${kind} projection and screen rays agree for a rotated, translated camera`, () => {
    const camera = Camera.from({
      kind,
      position: new Vec3(3.2, 2.2, 4.5),
      target: new Vec3(0.3, -0.2, -0.4),
      up: new Vec3(0, 1, 0),
      aspect: 4 / 3,
      near: 0.1,
      far: 100,
      ...(kind === "perspective" ? { fovYRad: Math.PI / 3 } : { halfHeight: 2 }),
    });

    for (const point of [Vec3.zero(), new Vec3(0.8, -0.3, 0.4), new Vec3(-0.4, 0.5, -0.2)]) {
      const projected = camera.projectToSvg(point, 640, 480);
      const ray = camera.screenToRay(projected.x, projected.y, 640, 480);
      const originToPoint = Vec3.sub(point, ray.origin);
      const t = Vec3.dot(originToPoint, ray.dir);
      const onRay = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
      assert.ok(t > 0);
      assert.ok(Vec3.distance(point, onRay) < 1e-9);
    }
  });

  test(`${kind} surface clipping uses near and far planes for every screen ray`, () => {
    const camera = Camera.from({
      kind,
      position: Vec3.zero(),
      target: new Vec3(0, 0, -1),
      up: new Vec3(0, 1, 0),
      aspect: 3,
      near: 1,
      far: 3,
      ...(kind === "perspective" ? { fovYRad: Math.PI / 2 } : { halfHeight: 1 }),
    });
    const planes = [0.5, 2.5, 3.5].map((distance, index) => new PlaneRect(
      `plane-${index}`,
      new Vec3(0, 0, -distance),
      new Vec3(0, 0, 1),
      new Vec3(1, 0, 0),
      10,
      10,
    ));
    const buffer = buildSurfaceBuffer(planes, camera, { width: 3, height: 1 });

    assert.deepEqual(Array.from(buffer.primitiveIndices), [1, 1, 1]);
    for (const value of buffer.depth) assert.ok(Math.abs(value - 2.5) < 1e-6);
    const outside = buildSurfaceBuffer([planes[0], planes[2]], camera, { width: 3, height: 1 });
    assert.ok(outside.primitiveIndices.every((index) => index === -1));
    assert.ok(outside.depth.every((value) => value === Infinity));
  });
}

test("overlapping spheres keep the nearest owner regardless of primitive order", () => {
  const back = new Sphere("back", Vec3.zero(), 1.1);
  const front = new Sphere("front", new Vec3(0, 0, 1.1), 0.8);
  const options = { width: 33, height: 33 };
  const center = 16 * 33 + 16;

  for (const primitives of [[back, front], [front, back]]) {
    const buffer = buildSurfaceBuffer(primitives, orthographicCamera(), options);
    assert.equal(buffer.primitiveIds[buffer.primitiveIndices[center]], "front");
    assert.ok(Math.abs(buffer.depth[center] - 3.1) < 1e-6);
    assert.equal(buffer.normals[center * 3 + 2], 1);
  }
});

test("intersecting spheres change nearest owner inside their overlapping silhouettes", () => {
  const left = new Sphere("left", new Vec3(-0.5, 0, 0), 1);
  const right = new Sphere("right", new Vec3(0.5, 0, 0), 1);

  for (const primitives of [[left, right], [right, left]]) {
    const buffer = buildSurfaceBuffer(primitives, orthographicCamera(), { width: 64, height: 64 });
    for (const [x, expected] of [[24, "left"], [39, "right"]]) {
      const pixel = 32 * 64 + x;
      const ray = orthographicCamera().screenToRay(x + 0.5, 32.5, 64, 64);
      // Both spheres intersect these rays; a global object drawing order cannot resolve both.
      assert.ok(left.intersect(ray, 0, 100));
      assert.ok(right.intersect(ray, 0, 100));
      assert.equal(buffer.primitiveIds[buffer.primitiveIndices[pixel]], expected);
    }
    for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
      if (buffer.primitiveIndices[pixel] < 0) continue;
      const offset = pixel * 3;
      assert.ok(Math.abs(Math.hypot(...buffer.normals.subarray(offset, offset + 3)) - 1) < 1e-6);
    }
  }
});

test("lighting and selection recolor cached surfaces without raycasts or owner changes", () => {
  let raycasts = 0;
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const counted = {
    id: sphere.id,
    intersect(...args) {
      raycasts++;
      return sphere.intersect(...args);
    },
  };
  const buffer = buildSurfaceBuffer([counted], orthographicCamera(), { width: 33, height: 33 });
  const ownership = buffer.primitiveIndices.slice();
  const normals = buffer.normals.slice();
  const depth = buffer.depth.slice();
  const initialRaycasts = raycasts;
  const frontLight = shadeSurfaceBuffer(buffer, { lightDirection: new Vec3(0, 0, 1), ambient: 0 });
  const backLight = shadeSurfaceBuffer(buffer, { lightDirection: new Vec3(0, 0, -1), ambient: 0 });
  const selected = shadeSurfaceBuffer(buffer, { lightDirection: new Vec3(0, 0, 1), selectedId: "sphere" });
  const center = (16 * 33 + 16) * 4;

  assert.ok(frontLight[center] > backLight[center]);
  assert.equal(frontLight[center], frontLight[center + 1]);
  assert.equal(frontLight[center + 1], frontLight[center + 2]);
  assert.ok(selected[center + 1] > selected[center]);
  assert.ok(selected[center + 1] > selected[center + 2]);
  assert.equal(frontLight[center + 3], 255);
  assert.equal(frontLight[3], 0);
  assert.equal(raycasts, initialRaycasts);
  assert.deepEqual(buffer.primitiveIndices, ownership);
  assert.deepEqual(buffer.normals, normals);
  assert.deepEqual(buffer.depth, depth);
});

test("light angles use world Y elevation and normalized directions", () => {
  assert.ok(Vec3.distance(lightDirectionFromAngles(0, 0), new Vec3(0, 0, 1)) < 1e-12);
  assert.ok(Vec3.distance(lightDirectionFromAngles(90, 0), new Vec3(1, 0, 0)) < 1e-12);
  assert.ok(Vec3.distance(lightDirectionFromAngles(-45, 90), new Vec3(0, 1, 0)) < 1e-12);
  assert.ok(Math.abs(Vec3.len(lightDirectionFromAngles(35, 20)) - 1) < 1e-12);
});

test("surface clip paths preserve disconnected regions and holes at the output scale", () => {
  const buffer = {
    width: 7,
    height: 5,
    primitiveIds: ["left", "right", "hidden"],
    primitiveIndices: new Int32Array([
      0, 0, 0, -1, 1, 1, -1,
      0, -1, 0, -1, 1, 1, -1,
      0, 0, 0, -1, 1, 1, -1,
      -1, -1, -1, -1, 1, 1, -1,
      0, 0, -1, -1, 1, 1, -1,
    ]),
    normals: new Float32Array(7 * 5 * 3),
    depth: new Float32Array(7 * 5),
  };
  const owners = buffer.primitiveIndices.slice();
  const paths = buildSurfaceClipPaths(buffer, { width: 14, height: 10 });
  assert.equal(paths.find(({ primitiveId }) => primitiveId === "hidden").path, "");
  const right = paths.find(({ primitiveId }) => primitiveId === "right");
  assert.equal((right.path.match(/M/g) ?? []).length, 1);

  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const index = buffer.primitiveIndices[y * buffer.width + x];
      for (const { primitiveId, path } of paths) {
        assert.equal(
          insideClipPath(path, (x + 0.5) * 2, (y + 0.5) * 2),
          primitiveId === buffer.primitiveIds[index],
        );
      }
    }
  }
  assert.deepEqual(buffer.primitiveIndices, owners);
});

test("intersecting surface clip regions split by nearest owner independently of object order", () => {
  const left = new Sphere("left", new Vec3(-0.5, 0, 0), 1);
  const right = new Sphere("right", new Vec3(0.5, 0, 0), 1);
  const camera = orthographicCamera();
  const pathsByOrder = [[left, right], [right, left]].map((primitives) => {
    const buffer = buildSurfaceBuffer(primitives, camera, { width: 64, height: 64 });
    return new Map(buildSurfaceClipPaths(buffer).map(({ primitiveId, path }) => [primitiveId, path]));
  });

  for (const primitiveId of ["left", "right"]) {
    assert.equal(pathsByOrder[0].get(primitiveId), pathsByOrder[1].get(primitiveId));
  }
  for (const [x, expected] of [[24, "left"], [39, "right"]]) {
    for (const primitiveId of ["left", "right"]) {
      assert.equal(insideClipPath(pathsByOrder[0].get(primitiveId), x + 0.5, 32.5), primitiveId === expected);
    }
  }

  const moved = new Sphere("right", new Vec3(0.5, 0, 0.8), 1);
  const movedBuffer = buildSurfaceBuffer([left, moved], camera, { width: 64, height: 64 });
  const movedPaths = new Map(buildSurfaceClipPaths(movedBuffer).map(({ primitiveId, path }) => [primitiveId, path]));
  assert.notEqual(movedPaths.get("left"), pathsByOrder[0].get("left"));
  assert.notEqual(movedPaths.get("right"), pathsByOrder[0].get("right"));
});

function insideClipPath(path, x, y) {
  // General nonzero winding evaluation for the emitted SVG M/H/V/Z polygons.
  const tokens = path.match(/[MHVZ]|-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi) ?? [];
  const contours = [];
  let contour = [];
  let point = [0, 0];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (command === "M") {
      point = [Number(tokens[i++]), Number(tokens[i++])];
      contour = [point];
    } else if (command === "H") {
      point = [Number(tokens[i++]), point[1]];
      contour.push(point);
    } else if (command === "V") {
      point = [point[0], Number(tokens[i++])];
      contour.push(point);
    } else if (command === "Z") contours.push(contour);
    else throw new Error(`Unexpected path command ${command}`);
  }
  let winding = 0;
  for (const polygon of contours) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const side = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y && b[1] > y && side > 0) winding++;
      if (a[1] > y && b[1] <= y && side < 0) winding--;
    }
  }
  return winding !== 0;
}

function orthographicCamera() {
  return Camera.from({
    kind: "orthographic",
    position: new Vec3(0, 0, 5),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    halfHeight: 2,
    aspect: 1,
    near: 0.1,
    far: 100,
  });
}
