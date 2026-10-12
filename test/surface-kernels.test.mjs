import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import {
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
  shadeSurfaceBuffer,
} from "../dist/core/surfaceRenderer.js";
import { createPreparedPrimitiveIntersector } from "../dist/core/surfaceKernels.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { Disk } from "../dist/scene/primitives/disk.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { TriangleMesh } from "../dist/scene/primitives/triangleMesh.js";
import {
  bruteSurfaceBuffer,
  bruteShadeSurfaceBuffer,
} from "./helpers/surface-oracle.mjs";

const options = { width: 79, height: 57 };
const objects = () => [
  new Sphere("sphere", new Vec3(-0.45, 0.15, 0.35), 0.95),
  new Cylinder(
    "cylinder",
    new Vec3(0.35, -1.1, -0.2),
    new Vec3(0.15, 1, 0.2),
    2.25,
    0.7,
  ),
  new Cone(
    "cone",
    new Vec3(-0.3, 1.25, 0.3),
    new Vec3(0.1, -1, 0.15),
    2.5,
    0.9,
  ),
  new BoxAabb("box", new Vec3(-0.85, -0.8, -0.85), new Vec3(0.6, 0.6, 0.25)),
  new Disk("disk", new Vec3(0.3, 0.75, 0.4), new Vec3(0.2, 1, 0.1), 0.8),
  new PlaneRect(
    "rect",
    new Vec3(-0.2, 0.1, -0.5),
    new Vec3(0.3, 0.2, 1),
    new Vec3(1, 0, 0),
    0.95,
    0.7,
  ),
];

function camera(
  kind,
  near = 0.1,
  far = 100,
  position = new Vec3(3.2, 2.2, 4.5),
) {
  return Camera.from({
    kind,
    position,
    target: Vec3.zero(),
    up: new Vec3(0.1, 1, 0.05),
    aspect: options.width / options.height,
    near,
    far,
    ...(kind === "perspective"
      ? { fovYRad: Math.PI / 2.2 }
      : { halfHeight: 2 }),
  });
}

function equivalent(actual, expected) {
  assert.deepEqual(actual.primitiveIndices, expected.primitiveIndices);
  assert.deepEqual(actual.primitiveIds, expected.primitiveIds);
  for (let pixel = 0; pixel < actual.depth.length; pixel++) {
    if (expected.primitiveIndices[pixel] < 0) {
      assert.equal(actual.depth[pixel], Infinity);
      continue;
    }
    assert.ok(
      Math.abs(actual.depth[pixel] - expected.depth[pixel]) <=
        2e-6 * Math.max(1, expected.depth[pixel]),
      `depth ${pixel}`,
    );
    for (let axis = 0; axis < 3; axis++)
      assert.ok(
        Math.abs(
          actual.normals[pixel * 3 + axis] - expected.normals[pixel * 3 + axis],
        ) < 2e-6,
        `normal ${pixel}:${axis}`,
      );
  }
}

for (const kind of ["orthographic", "perspective"]) {
  test(`${kind} bounded scalar surfaces match brute rays for every built-in and clipped overlap`, () => {
    for (const [near, far, position] of [
      [0.1, 100, new Vec3(3.2, 2.2, 4.5)],
      [5.7, 6.8, new Vec3(3.2, 2.2, 4.5)],
      [0.15, 3, new Vec3(0.25, 0.2, 0.65)],
    ]) {
      const view = camera(kind, near, far, position);
      const primitives = objects();
      for (const scene of [
        primitives,
        primitives.slice().reverse(),
        ...primitives.map((p) => [p]),
      ]) {
        equivalent(
          buildSurfaceBuffer(scene, view, options),
          bruteSurfaceBuffer(scene, view, options),
        );
      }
    }
  });

  test(`${kind} scalar ownership preserves clip paths and relighting exactly`, () => {
    const primitives = objects(),
      view = camera(kind);
    const optimized = buildSurfaceBuffer(primitives, view, options),
      brute = bruteSurfaceBuffer(primitives, view, options);
    assert.deepEqual(
      buildSurfaceClipPaths(optimized),
      buildSurfaceClipPaths(brute),
    );
    for (const selectedId of [null, "sphere", "cone"]) {
      const lighting = {
        lightDirection: new Vec3(0.25, 0.65, 0.8),
        ambient: 0.2,
        selectedId,
      };
      assert.deepEqual(
        shadeSurfaceBuffer(optimized, lighting),
        shadeSurfaceBuffer(brute, lighting),
      );
    }
  });
}

test("prepared raycasts preserve cap, axial, tangent, inside and clipping behavior", () => {
  const primitives = objects();
  let seed = 137;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const scratch = { t: 0, nx: 0, ny: 0, nz: 0 };
  for (const primitive of primitives) {
    const prepared = createPreparedPrimitiveIntersector(primitive);
    assert.ok(prepared);
    for (let i = 0; i < 1000; i++) {
      const origin = new Vec3(
        (random() - 0.5) * 6,
        (random() - 0.5) * 6,
        (random() - 0.5) * 6,
      );
      const dir = Vec3.normalize(
        new Vec3(random() - 0.5, random() - 0.5, random() - 0.5),
      );
      const tMin = random() * 1.5,
        tMax = tMin + random() * 6;
      const expected = primitive.intersect({ origin, dir }, tMin, tMax);
      const found = prepared.intersect(
        origin.x,
        origin.y,
        origin.z,
        dir.x,
        dir.y,
        dir.z,
        tMin,
        tMax,
        scratch,
      );
      assert.equal(found, expected !== null, `${primitive.id} ray ${i}`);
      if (!found) continue;
      assert.ok(Math.abs(scratch.t - expected.t) < 1e-10);
      assert.ok(Math.abs(scratch.nx - expected.normal.x) < 1e-10);
      assert.ok(Math.abs(scratch.ny - expected.normal.y) < 1e-10);
      assert.ok(Math.abs(scratch.nz - expected.normal.z) < 1e-10);
    }
  }
});

test("overrides and subclasses retain generic raycast semantics", () => {
  const sphere = new Sphere("custom", Vec3.zero(), 1);
  let calls = 0;
  sphere.intersect = function (...args) {
    calls++;
    return Sphere.prototype.intersect.apply(this, args);
  };
  class CustomSphere extends Sphere {
    intersect(...args) {
      return super.intersect(...args);
    }
  }
  const subclass = new CustomSphere("subclass", new Vec3(0.3, 0.2, 0.1), 0.65);
  assert.equal(createPreparedPrimitiveIntersector(sphere), undefined);
  assert.equal(createPreparedPrimitiveIntersector(subclass), undefined);
  const view = camera("perspective");
  equivalent(
    buildSurfaceBuffer([sphere, subclass], view, options),
    bruteSurfaceBuffer([sphere, subclass], view, options),
  );
  assert.ok(calls >= options.width * options.height);
});

test("coincident surfaces keep first-owner ties and offscreen bounds do not invent hits", () => {
  const a = new Sphere("first", Vec3.zero(), 1),
    b = new Sphere("second", Vec3.zero(), 1);
  const outside = new Sphere("outside", new Vec3(100, 100, 0), 1);
  const view = camera("orthographic");
  for (const scene of [
    [a, b, outside],
    [b, a, outside],
  ]) {
    const buffer = buildSurfaceBuffer(scene, view, options);
    equivalent(buffer, bruteSurfaceBuffer(scene, view, options));
    assert.ok(
      buffer.primitiveIndices.every((owner) => owner === -1 || owner === 0),
    );
  }
});

test("prototype overrides retain custom semantics rather than specializing the class", () => {
  const original = Sphere.prototype.intersect;
  let calls = 0;
  try {
    Sphere.prototype.intersect = function () {
      calls++;
      return null;
    };
    const sphere = new Sphere("patched", Vec3.zero(), 1);
    assert.equal(createPreparedPrimitiveIntersector(sphere), undefined);
    const buffer = buildSurfaceBuffer(
      [sphere],
      camera("orthographic"),
      options,
    );
    assert.ok(buffer.primitiveIndices.every((index) => index === -1));
    assert.equal(calls, options.width * options.height);
  } finally {
    Sphere.prototype.intersect = original;
  }
});

for (const kind of ["orthographic", "perspective"]) {
  test(`${kind} instance camera overrides control rays independently of projection matrices`, () => {
    const view = camera(kind);
    const center = new Vec3(100, 100, 0);
    const sphere = new Sphere("offscreen", center, 1);
    const back = new Sphere("back", Vec3.add(center, view.forward), 0.7);
    const origin = Vec3.sub(center, Vec3.mulScalar(view.forward, 5));
    let calls = 0;
    view.screenToRay = () => {
      calls++;
      return { origin, dir: view.forward };
    };
    // These matrices cannot describe the overridden rays. The fallback must not
    // consult them for either ray generation or conservative bounds.
    Object.defineProperty(view, "viewProj", {
      get() {
        throw new Error("custom camera projection must not be read");
      },
    });
    Object.defineProperty(view, "viewProjInv", {
      get() {
        throw new Error("custom camera inverse must not be read");
      },
    });
    const actual = buildSurfaceBuffer([back, sphere], view, options);
    assert.equal(calls, options.width * options.height);
    assert.ok(actual.primitiveIndices.every((index) => index === 1));
    equivalent(actual, bruteSurfaceBuffer([back, sphere], view, options));
    assert.equal(calls, options.width * options.height * 2);
  });
}

test("camera prototype ray overrides are honored and restored", () => {
  const original = Camera.prototype.screenToRay;
  const view = camera("orthographic"),
    center = new Vec3(100, 100, 0);
  const sphere = new Sphere("shifted", center, 1);
  const origin = Vec3.sub(center, Vec3.mulScalar(view.forward, 5));
  let calls = 0;
  try {
    Camera.prototype.screenToRay = function () {
      calls++;
      return { origin, dir: this.forward };
    };
    const actual = buildSurfaceBuffer([sphere], view, options);
    assert.equal(calls, options.width * options.height);
    assert.ok(actual.primitiveIndices.every((index) => index === 0));
    equivalent(actual, bruteSurfaceBuffer([sphere], view, options));
  } finally {
    Camera.prototype.screenToRay = original;
  }
});

test("mutated non-unit axes and non-orthonormal plane frames use unbounded generic raycasts", () => {
  const primitives = objects().filter(
    (p) => !(p instanceof Sphere) && !(p instanceof BoxAabb),
  );
  for (const primitive of primitives) {
    const vector =
      primitive instanceof Cylinder || primitive instanceof Cone
        ? primitive.axis
        : primitive.normal;
    vector.x *= 1.8;
    vector.y *= 1.8;
    vector.z *= 1.8;
  }
  const skewedRect = new PlaneRect(
    "skewed-u",
    Vec3.zero(),
    new Vec3(0, 0, 1),
    new Vec3(1, 0, 0),
    1,
    0.7,
  );
  // Both vectors remain unit length, but they are no longer perpendicular.
  skewedRect.u.x = 0.5;
  skewedRect.u.y = Math.sqrt(0.75);
  const tiltedRect = new PlaneRect(
    "skewed-v",
    Vec3.zero(),
    new Vec3(0, 0, 1),
    new Vec3(1, 0, 0),
    1,
    0.7,
  );
  tiltedRect.v.y = Math.sqrt(0.75);
  tiltedRect.v.z = 0.5;
  primitives.push(skewedRect, tiltedRect);
  for (const primitive of primitives)
    assert.equal(
      createPreparedPrimitiveIntersector(primitive),
      undefined,
      primitive.id,
    );
  for (const kind of ["orthographic", "perspective"]) {
    const view = camera(kind);
    for (const scene of [primitives, ...primitives.map((p) => [p])])
      equivalent(
        buildSurfaceBuffer(scene, view, options),
        bruteSurfaceBuffer(scene, view, options),
      );
  }
});

for (const kind of ["orthographic", "perspective"]) {
  test(`${kind} mutable camera pose and inconsistent matrices preserve public screen rays`, () => {
    const mutations = [
      (view) => {
        view.position.x += 1.4;
      },
      (view) => {
        view.forward.x += 0.4;
        view.forward.z *= 0.75;
      },
      (view) => {
        view.viewProj.m[0] *= 0.02;
      },
      (view) => {
        view.viewProjInv.m[0] *= 0.2;
      },
    ];
    for (const mutate of mutations) {
      const view = camera(kind),
        primitives = objects();
      mutate(view);
      const optimized = buildSurfaceBuffer(primitives, view, options);
      const reference = bruteSurfaceBuffer(primitives, view, options);
      equivalent(optimized, reference);
      assert.deepEqual(
        buildSurfaceClipPaths(optimized),
        buildSurfaceClipPaths(reference),
      );
    }
  });
}

test("selection-free and tinted lighting preserve every oracle RGBA byte", () => {
  const buffer = buildSurfaceBuffer(objects(), camera("orthographic"), options);
  for (const lightDirection of [
    Vec3.zero(),
    new Vec3(0, 0, 1),
    new Vec3(-0.35, 0.9, -0.2),
  ]) {
    for (const ambient of [undefined, 0, 0.3, 1]) {
      for (const selectedId of [undefined, null, "sphere", "absent"]) {
        const lighting = { lightDirection, ambient, selectedId };
        assert.deepEqual(
          shadeSurfaceBuffer(buffer, lighting),
          bruteShadeSurfaceBuffer(buffer, lighting),
        );
      }
    }
  }
});

test("densely overlapping perspective bounds preserve winner ties and order at every pixel", () => {
  const view = camera("perspective");
  const first = new Sphere("first", new Vec3(-0.15, 0.1, 0.2), 1.15);
  const coincident = new Sphere("coincident", first.center, first.radius);
  const front = new Sphere("front", new Vec3(0.3, -0.1, 0.5), 0.9);
  for (const scene of [
    [first, coincident, front],
    [front, coincident, first],
  ]) {
    const actual = buildSurfaceBuffer(scene, view, options);
    const expected = bruteSurfaceBuffer(scene, view, options);
    equivalent(actual, expected);
    assert.ok(actual.primitiveIndices.some((index) => index === 0));
    assert.ok(
      actual.primitiveIndices.some((index) => index === 2 || index === 1),
    );
    assert.deepEqual(
      buildSurfaceClipPaths(actual),
      buildSurfaceClipPaths(expected),
    );
  }
});

test("a custom primitive preserves whole-scene pixel order and original ray identity", () => {
  const view = camera("perspective");
  let previousRay;
  const calls = [];
  const first = {
    id: "state",
    intersect(ray) {
      assert.equal(ray.origin, view.position);
      previousRay = ray;
      calls.push("first");
      return null;
    },
  };
  const second = {
    id: "hit",
    intersect(ray, tMin, tMax) {
      assert.equal(ray, previousRay);
      assert.equal(ray.origin, view.position);
      calls.push("second");
      if (1 < tMin || 1 > tMax) return null;
      return {
        t: 1,
        point: Vec3.add(ray.origin, ray.dir),
        normal: Vec3.mulScalar(ray.dir, -1),
        primitiveId: "hit",
      };
    },
  };
  const scene = [new Sphere("native", Vec3.zero(), 1), first, second];
  const actual = buildSurfaceBuffer(scene, view, options);
  assert.equal(calls.length, options.width * options.height * 2);
  for (let i = 0; i < calls.length; i += 2)
    assert.deepEqual(calls.slice(i, i + 2), ["first", "second"]);
  equivalent(actual, bruteSurfaceBuffer(scene, view, options));
});

test("native triangle meshes retain scalar-camera fallback and brute surface results", () => {
  const mesh = new TriangleMesh(
    "mesh",
    [new Vec3(-1, -1, 0.2), new Vec3(1, -1, 0.2), new Vec3(0, 1, 0.2)],
    [[0, 1, 2]],
  );
  const scene = [mesh, new Sphere("sphere", new Vec3(0.4, 0.1, 0), 0.75)];
  for (const kind of ["orthographic", "perspective"]) {
    const view = camera(kind);
    equivalent(
      buildSurfaceBuffer(scene, view, options),
      bruteSurfaceBuffer(scene, view, options),
    );
  }
});
