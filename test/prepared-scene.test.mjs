import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { Scene } from "../dist/scene/scene.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { Disk } from "../dist/scene/primitives/disk.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { TriangleMesh } from "../dist/scene/primitives/triangleMesh.js";

// Independent public-API oracle following Scene behavior before scalar kernels
// (42da7e5): call original primitive methods and use vector visibility math.
function originalRaycast(primitives, ray, opts = {}) {
  const tMin = opts.tMin ?? 0;
  let bestT = opts.tMax ?? Infinity;
  let closest = null;
  for (const primitive of primitives) {
    if (opts.ignorePrimitiveId && primitive.id === opts.ignorePrimitiveId)
      continue;
    if (opts.ignorePrimitiveIds?.includes(primitive.id)) continue;
    const hit = primitive.intersect(ray, tMin, bestT);
    if (hit && hit.t < bestT) {
      closest = hit;
      bestT = hit.t;
    }
  }
  return closest;
}

function originalVisible(primitives, camera, point, opts = {}) {
  const eps = opts.eps ?? 2e-4;
  const dir =
    camera.kind === "perspective"
      ? Vec3.normalize(Vec3.sub(point, camera.position))
      : Vec3.normalize(camera.forward);
  const distance =
    camera.kind === "perspective"
      ? Vec3.distance(point, camera.position)
      : Math.max(camera.far, eps * 2);
  const origin =
    camera.kind === "perspective"
      ? camera.position
      : Vec3.sub(point, Vec3.mulScalar(dir, distance));
  const coordinateScale = (...points) =>
    Math.max(
      1,
      ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)]),
    );
  const rayGap = Math.max(
    eps,
    coordinateScale(origin, point) * Number.EPSILON * 64,
  );
  const hit = originalRaycast(
    primitives,
    { origin, dir },
    { tMin: 0, tMax: Math.max(0, distance - rayGap) },
  );
  if (!hit) return true;
  const owners = opts.ignorePrimitiveIds;
  if (owners && !owners.includes(hit.primitiveId)) return false;
  const snap = owners
    ? Math.max(
        eps * 24,
        coordinateScale(origin, point, hit.point) * Number.EPSILON * 512,
      )
    : rayGap;
  return (
    Vec3.distanceSq(hit.point, point) <= snap * snap ||
    Math.max(0, distance - hit.t) <= snap
  );
}

function camera(kind, position = new Vec3(3.2, 2.2, 4.5), far = 100) {
  return Camera.from({
    kind,
    position,
    target: Vec3.zero(),
    up: new Vec3(0.1, 1, 0.05),
    aspect: 1.3,
    near: 0.1,
    far,
    ...(kind === "perspective"
      ? { fovYRad: Math.PI / 2.2 }
      : { halfHeight: 2 }),
  });
}

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

for (const kind of ["orthographic", "perspective"]) {
  test(`${kind} prepared and generic visibility match the original API across grids and owned hits`, () => {
    for (const [position, far] of [
      [new Vec3(3.2, 2.2, 4.5), 100],
      [new Vec3(-3, 1, -4), 8],
      [new Vec3(0.25, 0.2, 0.65), 1],
    ]) {
      const view = camera(kind, position, far);
      const primitives = objects();
      const owners = primitives.map((p) => p.id);
      const prepared = new Scene(primitives, view, undefined, true);
      const generic = new Scene(primitives, view);
      for (let z = -3; z <= 3; z++)
        for (let y = -3; y <= 3; y++)
          for (let x = -3; x <= 3; x++) {
            const point = new Vec3(x * 0.4, y * 0.4, z * 0.4);
            for (const opts of [
              undefined,
              { eps: 1e-6 },
              { ignorePrimitiveIds: owners },
              { ignorePrimitiveIds: ["sphere", "cone"] },
              { ignorePrimitiveIds: [] },
            ]) {
              const expected = originalVisible(primitives, view, point, opts);
              assert.equal(
                generic.visibleAtPoint(point, opts),
                expected,
                `generic ${JSON.stringify(point)}`,
              );
              assert.equal(
                prepared.visibleAtPoint(point, opts),
                expected,
                `prepared ${JSON.stringify(point)}`,
              );
            }
          }
      // These offsets straddle the nearby participant snap independently of
      // the world-space grid; both self-occlusion and third-party hits matter.
      for (const primitive of primitives)
        for (let y = 0; y < 7; y++)
          for (let x = 0; x < 9; x++) {
            const ray = view.screenToRay(
              (x + 0.5) * 10,
              (y + 0.5) * 10,
              90,
              70,
            );
            const hit = primitive.intersect(ray, 0, Infinity);
            if (!hit) continue;
            for (const offset of [0, 0.0001, 0.001, 0.006, 0.05]) {
              const point = Vec3.add(
                hit.point,
                Vec3.mulScalar(ray.dir, offset),
              );
              const opts = { ignorePrimitiveIds: [primitive.id] };
              const expected = originalVisible(primitives, view, point, opts);
              assert.equal(generic.visibleAtPoint(point, opts), expected);
              assert.equal(prepared.visibleAtPoint(point, opts), expected);
            }
          }
    }
  });
}

test("Scene raycasts preserve original primitive selection, finite ranges, ties and ignored IDs", () => {
  const primitives = [...objects(), new Sphere("", new Vec3(0, 0, 1), 0.6)];
  primitives.push(
    new Sphere("second", primitives[0].center, primitives[0].radius),
  );
  const view = camera("perspective");
  const scenes = [
    new Scene(primitives, view),
    new Scene(primitives, view, undefined, true),
  ];
  const rays = [
    { origin: Vec3.zero(), dir: new Vec3(1, 0, 0) },
    { origin: new Vec3(1, 0, 5), dir: new Vec3(0, 0, -1) },
    { origin: Vec3.zero(), dir: Vec3.zero() },
  ];
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 19; x++)
      rays.push(view.screenToRay(x * 10, y * 10, 180, 140));
  for (const ray of rays)
    for (const opts of [
      undefined,
      { tMin: 0.4, tMax: 5 },
      { tMax: 4 },
      { ignorePrimitiveId: "sphere" },
      { ignorePrimitiveId: "" },
      { ignorePrimitiveIds: ["sphere", "cylinder"] },
    ]) {
      const expected = originalRaycast(primitives, ray, opts);
      for (const scene of scenes)
        assert.deepEqual(scene.raycastClosest(ray, opts), expected);
    }
});

test("default Scene observes live geometry, primitive arrays and custom method changes", () => {
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const primitives = [sphere];
  const view = camera("perspective", new Vec3(0, 0, 5));
  const scene = new Scene(primitives, view);
  const ray = { origin: view.position, dir: new Vec3(0, 0, -1) };
  const point = new Vec3(0, 0, 0.999);
  const check = () => {
    assert.deepEqual(
      scene.raycastClosest(ray),
      originalRaycast(primitives, ray),
    );
    assert.equal(
      scene.visibleAtPoint(point),
      originalVisible(primitives, view, point),
    );
  };
  check();
  sphere.center.x = 10;
  check();
  sphere.center.x = 0;
  sphere.radius = 0.5;
  check();
  sphere.intersect = () => null;
  check();
  primitives.push(new Sphere("second", new Vec3(0, 0, 2), 0.25));
  check();
  primitives.splice(0, 1);
  check();
  primitives[0] = new Sphere("replacement", new Vec3(0, 0, -2), 0.5);
  check();
  primitives.length = 0;
  check();
});

test("custom primitives receive the caller's Ray and return their original Hit object", () => {
  const view = camera("perspective");
  const ray = { origin: new Vec3(0, 0, 5), dir: new Vec3(0, 0, -1) };
  const hit = {
    t: 4,
    point: new Vec3(0, 0, 1),
    normal: new Vec3(0, 0, 1),
    primitiveId: "custom-owner",
    metadata: "keep",
  };
  const primitive = {
    id: "custom",
    intersect(received, tMin, tMax) {
      assert.strictEqual(received, ray);
      assert.strictEqual(received.origin, ray.origin);
      assert.strictEqual(received.dir, ray.dir);
      return hit.t >= tMin && hit.t <= tMax ? hit : null;
    },
  };
  for (const prepared of [false, true]) {
    const scene = new Scene([primitive], view, undefined, prepared);
    assert.strictEqual(scene.raycastClosest(ray), hit);
    assert.equal(
      scene.raycastClosest(ray, { ignorePrimitiveId: "custom" }),
      null,
    );
  }
});

test("custom primitive callbacks can nest raycasts and visibility without corrupting outer hits", () => {
  const view = camera("perspective", new Vec3(0, 0, 5));
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  for (const prepared of [false, true]) {
    let scene,
      nested = false,
      callbacks = 0;
    const callback = {
      id: "callback",
      intersect() {
        if (nested) return null;
        callbacks++;
        nested = true;
        try {
          const ray = { origin: new Vec3(0, 0, -5), dir: new Vec3(0, 0, 1) };
          assert.deepEqual(
            scene.raycastClosest(ray),
            sphere.intersect(ray, 0, Infinity),
          );
          assert.equal(scene.visibleAtPoint(new Vec3(0.8, 0, -1)), false);
        } finally {
          nested = false;
        }
        return null;
      },
    };
    scene = new Scene([sphere, callback], view, undefined, prepared);
    const ray = { origin: view.position, dir: new Vec3(0, 0, -1) };
    assert.deepEqual(
      scene.raycastClosest(ray),
      sphere.intersect(ray, 0, Infinity),
    );
    assert.equal(
      scene.visibleAtPoint(new Vec3(0, 0, 0.999), {
        ignorePrimitiveIds: ["sphere"],
      }),
      true,
    );
    assert.equal(scene.visibleAtPoint(new Vec3(0, 0, 0.999)), false);
    assert.ok(callbacks >= 3);
  }
});

test("mixed analytic and mesh scenes preserve generic visibility callbacks", () => {
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const mesh = new TriangleMesh(
    "mesh",
    [new Vec3(-2, -2, 2), new Vec3(2, -2, 2), new Vec3(0, 2, 2)],
    [[0, 1, 2]],
  );
  for (const kind of ["perspective", "orthographic"]) {
    const view = camera(kind, new Vec3(0, 0, 5));
    const scene = new Scene([sphere, mesh], view, undefined, true);
    for (const point of [
      new Vec3(0, 0, 1),
      new Vec3(0, 0, 0),
      new Vec3(2, 0, 0),
      new Vec3(0, 0, 2),
    ])
      assert.equal(
        scene.visibleAtPoint(point),
        originalVisible([sphere, mesh], view, point),
      );
  }
});

test("Scene raycast overrides remain authoritative for visibility and owned nearby snaps", () => {
  const view = camera("perspective", new Vec3(0, 0, 5));
  let calls = 0;
  const override = function (ray, opts) {
    calls++;
    assert.strictEqual(ray.origin, view.position);
    assert.equal(opts.ignorePrimitiveIds, undefined);
    const t = (1 - ray.origin.z) / ray.dir.z;
    return t >= opts.tMin && t <= opts.tMax
      ? {
          t,
          point: new Vec3(0, 0, 1),
          normal: new Vec3(0, 0, 1),
          primitiveId: "override",
        }
      : null;
  };
  class CustomScene extends Scene {
    raycastClosest(ray, opts) {
      return override(ray, opts);
    }
  }
  for (const prepared of [false, true]) {
    const scene = new CustomScene([], view, undefined, prepared);
    assert.equal(scene.visibleAtPoint(new Vec3(0, 0, 0.999)), false);
    assert.equal(
      scene.visibleAtPoint(new Vec3(0, 0, 0.999), {
        ignorePrimitiveIds: ["override"],
      }),
      true,
    );
    assert.equal(
      scene.visibleAtPoint(new Vec3(0, 0, 0.9), {
        ignorePrimitiveIds: ["override"],
      }),
      false,
    );
    assert.equal(
      scene.visibleAtPoint(new Vec3(0, 0, 0.999), {
        ignorePrimitiveIds: ["other"],
      }),
      false,
    );
    const instance = new Scene([], view, undefined, prepared);
    instance.raycastClosest = override;
    assert.equal(instance.visibleAtPoint(new Vec3(0, 0, 0.999)), false);
  }
  const original = Scene.prototype.raycastClosest;
  try {
    Scene.prototype.raycastClosest = override;
    assert.equal(
      new Scene([], view, undefined, true).visibleAtPoint(
        new Vec3(0, 0, 0.999),
      ),
      false,
    );
  } finally {
    Scene.prototype.raycastClosest = original;
  }
  assert.equal(calls, 11);
});

test("nonfinite hits are rejected rather than becoming closest hits", () => {
  const view = camera("perspective");
  const ray = { origin: Vec3.zero(), dir: Vec3.zero() };
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const invalid = {
    id: "invalid",
    intersect: () => ({
      t: NaN,
      point: Vec3.zero(),
      normal: Vec3.zero(),
      primitiveId: "invalid",
    }),
  };
  for (const prepared of [false, true]) {
    assert.equal(
      new Scene([sphere], view, undefined, prepared).raycastClosest(ray),
      null,
    );
    assert.equal(
      new Scene([invalid], view, undefined, prepared).raycastClosest(ray),
      null,
    );
  }
});

test("prepared visibility uses current camera values and rejects degenerate-direction hits", () => {
  const primitives = objects();
  for (const kind of ["orthographic", "perspective"]) {
    const view = camera(kind);
    const scenes = [
      new Scene(primitives, view),
      new Scene(primitives, view, undefined, true),
    ];
    for (const mutate of [
      () => {
        view.position.x += 0.5;
      },
      () => {
        view.forward.x = 0.2;
        view.forward.y = -0.3;
        view.forward.z = -0.4;
      },
      () => {
        view.far = 0.5;
      },
      () => {
        view.forward.x = 0;
        view.forward.y = 0;
        view.forward.z = 0;
      },
    ]) {
      mutate();
      for (const point of [
        Vec3.zero(),
        new Vec3(0.1, -0.3, 1),
        new Vec3(-1, 1, -1),
        view.position,
      ])
        for (const scene of scenes)
          assert.equal(
            scene.visibleAtPoint(point),
            originalVisible(primitives, view, point),
          );
    }
  }
});

test("zero-length visibility rays still invoke custom Scene raycast hooks", () => {
  const view = camera("perspective");
  for (const prepared of [false, true]) {
    const scene = new Scene([], view, undefined, prepared);
    let calls = 0;
    scene.raycastClosest = (ray, opts) => {
      calls++;
      assert.strictEqual(ray.origin, view.position);
      assert.deepEqual(ray.dir, Vec3.zero());
      assert.equal(opts.tMax, 0);
      return null;
    };
    assert.equal(scene.visibleAtPoint(view.position), true);
    assert.equal(calls, 1);
  }
});
