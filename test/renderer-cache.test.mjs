import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { Scene } from "../dist/core/scene.js";
import { Scene as RaycastScene } from "../dist/scene/scene.js";
import { SvgRenderer } from "../dist/core/svgRenderer.js";
import { createProfiler } from "../dist/core/profiler.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";

const settings = {
  width: 160,
  height: 120,
  hlr: { samples: 48, refineIters: 12 },
  intersections: { angularSamples: 64 },
};
const makeCamera = (x = 3) =>
  Camera.from({
    kind: "perspective",
    position: new Vec3(x, 2, 4),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    aspect: 4 / 3,
    near: 0.1,
    far: 30,
    fovYRad: 0.8,
  });
const fixture = () => {
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const cylinder = new Cylinder(
    "cylinder",
    new Vec3(-0.3, -1.3, 0),
    new Vec3(0, 1, 0),
    2.6,
    0.7,
    "both",
  );
  const scene = new Scene([sphere, cylinder]);
  const profiler = createProfiler();
  const renderer = new SvgRenderer({ ...settings, profiler });
  return { sphere, cylinder, scene, profiler, renderer, camera: makeCamera() };
};
const fresh = (scene, camera, options) =>
  new SvgRenderer(settings).render(scene, camera, options);

test("style and background reuse visibility while retaining exact SVG output", () => {
  const { scene, camera, renderer, profiler } = fixture();
  const original = renderer.render(scene, camera);
  assert.ok(profiler.report().counts["raycastClosest.calls"] > 0);
  for (const options of [
    {},
    { background: false },
    { background: true },
    {
      style: {
        strokeVisible: "#ef4444",
        strokeWidthVisible: 3,
        opacityHidden: 0,
      },
    },
    {
      style: {
        dashArrayHidden: "2 7",
        strokeHidden: "#246",
        opacityHidden: 0.75,
      },
    },
  ]) {
    const cached = renderer.render(scene, camera, options);
    assert.equal(cached, fresh(scene, camera, options));
    assert.equal(profiler.report().counts["render.visibility.cacheHit"], 1);
    assert.equal(profiler.report().counts["raycastClosest.calls"], undefined);
  }
  assert.equal(renderer.render(scene, camera), original);
});

test("geometry, camera, input curves and every calculation option invalidate cached paths", () => {
  const { sphere, cylinder, scene, renderer, profiler } = fixture();
  let camera = makeCamera(),
    options = {};
  renderer.render(scene, camera);
  const curves = [
    {
      p0: new Vec3(-1, 0, 0),
      p1: new Vec3(-0.5, 0.5, 0),
      p2: new Vec3(0.5, 0.5, 0),
      p3: new Vec3(1, 0, 0),
    },
  ];
  for (const update of [
    () => {
      sphere.center.x += 0.2;
    },
    () => {
      sphere.radius = 0.8;
    },
    () => {
      cylinder.caps = "none";
    },
    () => {
      cylinder.axis.x = 0.2;
    },
    () => {
      sphere.id = "renamed";
    },
    () => {
      scene.add(new Sphere("third", new Vec3(0.4, 1, 0.2), 0.3));
    },
    () => {
      scene.removeById("third");
    },
    () => {
      camera = makeCamera(2.7);
    },
    () => {
      camera.view.m[12] += 0.01;
    },
    () => {
      camera.proj.m[0] *= 1.01;
    },
    () => {
      options = { curves };
    },
    () => {
      curves[0].p1.y += 0.3;
    },
    () => {
      options = { ...options, include: { rims: false } };
    },
    () => {
      options = { ...options, intersections: { angularSamples: 96 } };
    },
    () => {
      options = { ...options, hlr: { samples: 32 } };
    },
    () => {
      options = { ...options, mesh: { creaseAngleDeg: 45 } };
    },
  ]) {
    update();
    assert.equal(
      renderer.render(scene, camera, options),
      fresh(scene, camera, options),
    );
    assert.equal(
      profiler.report().counts["render.visibility.cacheHit"],
      undefined,
    );
    renderer.render(scene, camera, options);
    assert.equal(profiler.report().counts["render.visibility.cacheHit"], 1);
  }
});

test("custom primitive methods cannot reuse stale visibility", () => {
  const { sphere, scene, camera, renderer, profiler } = fixture();
  renderer.render(scene, camera);
  const original = sphere.intersect;
  let calls = 0,
    hide = false;
  sphere.intersect = function (...args) {
    calls++;
    return hide ? null : original.apply(this, args);
  };
  for (const state of [false, true, false]) {
    hide = state;
    const before = calls;
    assert.equal(renderer.render(scene, camera), fresh(scene, camera));
    assert.ok(calls > before);
    assert.equal(
      profiler.report().counts["render.visibility.cacheHit"],
      undefined,
    );
  }
});

test("camera and Scene instance overrides bypass projected-path caching", () => {
  const { scene, camera, renderer, profiler } = fixture();
  renderer.render(scene, camera);
  const original = camera.projectToSvg;
  let shift = 1;
  camera.projectToSvg = function (...args) {
    const p = original.apply(this, args);
    return { ...p, x: p.x + shift };
  };
  for (const value of [1, 4]) {
    shift = value;
    assert.equal(renderer.render(scene, camera), fresh(scene, camera));
    assert.equal(
      profiler.report().counts["render.visibility.cacheHit"],
      undefined,
    );
  }
  delete camera.projectToSvg;
  const originalScene = scene.toRaycastScene;
  let visible = false;
  scene.toRaycastScene = function (...args) {
    const result = originalScene.apply(this, args);
    result.visibleAtPoint = () => visible;
    return result;
  };
  for (const value of [false, true]) {
    visible = value;
    assert.equal(renderer.render(scene, camera), fresh(scene, camera));
    assert.equal(
      profiler.report().counts["render.visibility.cacheHit"],
      undefined,
    );
  }
});

test("global camera prototype overrides bypass cache until restored", () => {
  const { scene, camera, renderer, profiler } = fixture();
  const original = Camera.prototype.projectToSvg;
  renderer.render(scene, camera);
  try {
    Camera.prototype.projectToSvg = function (...args) {
      const p = original.apply(this, args);
      return { ...p, x: p.x + 3 };
    };
    assert.equal(renderer.render(scene, camera), fresh(scene, camera));
    assert.equal(
      profiler.report().counts["render.visibility.cacheHit"],
      undefined,
    );
  } finally {
    Camera.prototype.projectToSvg = original;
  }
});

test("global visibility hooks cannot be bypassed by a prior cached render", () => {
  const { scene, camera, renderer, profiler } = fixture();
  renderer.render(scene, camera);
  const original = RaycastScene.prototype.visibleAtPoint;
  try {
    for (const visible of [false, true]) {
      RaycastScene.prototype.visibleAtPoint = () => visible;
      assert.equal(renderer.render(scene, camera), fresh(scene, camera));
      assert.equal(profiler.report().counts["render.visibility.cacheHit"], undefined);
    }
  } finally { RaycastScene.prototype.visibleAtPoint = original; }
});
