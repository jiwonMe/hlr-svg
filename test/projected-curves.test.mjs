import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { piecesToSvg } from "../dist/svg/svgWriter.js";
import { evalCubic3 } from "../dist/curves/cubicBezier3.js";
import { silhouettesForPrimitives } from "../dist/core/curves.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";

const params = {
  position: new Vec3(0, 0, 0),
  target: new Vec3(0, 0, -1),
  up: new Vec3(0, 1, 0),
  aspect: 1,
  near: 0.1,
  far: 100,
};

test("perspective SVG subdivision follows the actual projected 3D curve", () => {
  const camera = Camera.from({
    ...params,
    kind: "perspective",
    fovYRad: Math.PI / 3,
  });
  const bez = {
    p0: new Vec3(-1, 0, -2),
    p1: new Vec3(-0.5, 1, -3),
    p2: new Vec3(0.5, -1, -5),
    p3: new Vec3(1, 0, -4),
  };
  const svg = piecesToSvg([{ bez, visible: true }], camera, {
    width: 600,
    height: 600,
  });
  const d = svg.match(/<path d="([^"]+)"/)[1];
  const numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const segments = [];
  let start = numbers.slice(0, 2);
  for (let i = 2; i < numbers.length; i += 6) {
    const controls = [
      start,
      numbers.slice(i, i + 2),
      numbers.slice(i + 2, i + 4),
      numbers.slice(i + 4, i + 6),
    ];
    for (let s = 0; s <= 100; s++) {
      const t = s / 100,
        u = 1 - t,
        w = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
      segments.push(
        [0, 1].map((axis) =>
          controls.reduce((sum, p, j) => sum + p[axis] * w[j], 0),
        ),
      );
    }
    start = controls[3];
  }
  assert.ok(numbers.length > 8, "the rational projection needs subdivision");
  for (let s = 0; s <= 200; s++) {
    const exact = camera.projectToSvg(evalCubic3(bez, s / 200), 600, 600);
    const distance = Math.min(
      ...segments.map((p) => Math.hypot(p[0] - exact.x, p[1] - exact.y)),
    );
    assert.ok(distance < 0.4, `projection error ${distance}px`);
  }
});

test("orthographic sphere silhouette has the full radius independently of camera distance", () => {
  for (const distance of [2, 10]) {
    const camera = Camera.from({
      ...params,
      position: new Vec3(0, 0, distance),
      kind: "orthographic",
      halfHeight: 2,
    });
    const sphere = new Sphere("sphere", new Vec3(0, 0, 0), 1);
    const cubics = silhouettesForPrimitives([sphere], camera);
    for (const cubic of cubics) {
      const p = camera.projectToSvg(cubic.p0, 600, 600);
      assert.ok(Math.abs(Math.hypot(p.x - 300, p.y - 300) - 150) < 1e-8);
    }
  }
});

test("orthographic cylinder and cone silhouette normals are perpendicular to viewing rays", () => {
  const camera = Camera.from({
    ...params,
    position: new Vec3(3, 2, 4),
    target: new Vec3(0, 0, 0),
    kind: "orthographic",
    halfHeight: 2,
  });
  const cylinder = new Cylinder(
    "cylinder",
    new Vec3(0, -1, 0),
    new Vec3(0, 1, 0),
    2,
    1,
    "both",
  );
  const cone = new Cone(
    "cone",
    new Vec3(0, 1, 0),
    new Vec3(0, -1, 0),
    2,
    1,
    "base",
  );
  for (const primitive of [cylinder, cone]) {
    const curves = silhouettesForPrimitives([primitive], camera);
    assert.equal(curves.length, 2);
    for (const curve of curves) {
      const point = evalCubic3(curve, 0.5);
      const axisOrigin =
        primitive instanceof Cone ? primitive.apex : primitive.base;
      const fromOrigin = Vec3.sub(point, axisOrigin);
      const radial = Vec3.sub(
        fromOrigin,
        Vec3.mulScalar(primitive.axis, Vec3.dot(fromOrigin, primitive.axis)),
      );
      const normal =
        primitive instanceof Cone
          ? Vec3.sub(
              Vec3.normalize(radial),
              Vec3.mulScalar(
                primitive.axis,
                primitive.baseRadius / primitive.height,
              ),
            )
          : Vec3.normalize(radial);
      assert.ok(Math.abs(Vec3.dot(normal, camera.forward)) < 1e-8);
    }
  }
});
