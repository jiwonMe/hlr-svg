import test from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "../dist/math/vec3.js";
import { evalCubic3 } from "../dist/curves/cubicBezier3.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import {
  intersectSphereCylinder,
  intersectSphereSphere,
  intersectSphereCone,
  intersectCylinderCylinder,
  intersectConeCone,
} from "../dist/scene/intersections/pairs.js";

function endpointGraph(curves, eps = 1e-7) {
  const vertices = [];
  const vertexAt = (point) => {
    let index = vertices.findIndex(
      (vertex) => Vec3.distance(vertex.point, point) <= eps,
    );
    if (index < 0) {
      index = vertices.length;
      vertices.push({ point, neighbors: [] });
    }
    return index;
  };
  for (const curve of curves) {
    const a = vertexAt(curve.p0);
    const b = vertexAt(curve.p3);
    vertices[a].neighbors.push(b);
    vertices[b].neighbors.push(a);
  }
  const components = [];
  const visited = new Set();
  for (let i = 0; i < vertices.length; i++) {
    if (visited.has(i)) continue;
    const pending = [i];
    const component = [];
    while (pending.length) {
      const vertex = pending.pop();
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      component.push(vertices[vertex]);
      pending.push(...vertices[vertex].neighbors);
    }
    components.push(component);
  }
  return components;
}

function surfaceDistance(point, primitive) {
  if (primitive instanceof Sphere)
    return Math.abs(Vec3.distance(point, primitive.center) - primitive.radius);
  const origin = primitive instanceof Cone ? primitive.apex : primitive.base;
  const relative = Vec3.sub(point, origin);
  const height = Vec3.dot(relative, primitive.axis);
  const radius = Vec3.len(
    Vec3.sub(relative, Vec3.mulScalar(primitive.axis, height)),
  );
  if (primitive instanceof Cylinder) return Math.abs(radius - primitive.radius);
  const slope = primitive.baseRadius / primitive.height;
  return Math.abs(radius - slope * height) / Math.sqrt(1 + slope * slope);
}

function assertOnSurfaces(curves, primitives, tolerance) {
  assert.ok(curves.length > 0, "the intersection must not disappear");
  for (const curve of curves) {
    for (const control of [curve.p0, curve.p1, curve.p2, curve.p3]) {
      assert.ok([control.x, control.y, control.z].every(Number.isFinite));
    }
    for (let i = 0; i <= 40; i++) {
      const point = evalCubic3(curve, i / 40);
      for (const primitive of primitives) {
        assert.ok(
          surfaceDistance(point, primitive) <= tolerance,
          `curve left ${primitive.id}'s surface at ${i / 40}: ${surfaceDistance(point, primitive)}`,
        );
        if (!(primitive instanceof Sphere)) {
          const origin =
            primitive instanceof Cone ? primitive.apex : primitive.base;
          const height = Vec3.dot(Vec3.sub(point, origin), primitive.axis);
          assert.ok(height >= -1e-7 && height <= primitive.height + 1e-7);
        }
      }
    }
  }
}

function assertOpenEndpoints(curves, expected, componentCount) {
  const components = endpointGraph(curves);
  assert.equal(components.length, componentCount);
  const endpoints = components.flatMap((component) =>
    component.filter((vertex) => vertex.neighbors.length === 1),
  );
  assert.equal(endpoints.length, expected.length);
  for (const point of expected) {
    assert.ok(
      endpoints.some((vertex) => Vec3.distance(point, vertex.point) < 1e-7),
      `missing exact finite-surface endpoint (${point.x}, ${point.y}, ${point.z})`,
    );
  }
}

for (const useBezierFit of [false, true]) {
  test(`sphere-cylinder preserves a narrow closed loop between angular samples (fit=${useBezierFit})`, () => {
    const phi = Math.PI / 160;
    const distance = 1.9999;
    const sphere = new Sphere(
      "sphere",
      new Vec3(distance * Math.cos(phi), 0, distance * Math.sin(phi)),
      1,
    );
    const cylinder = new Cylinder(
      "cylinder",
      new Vec3(0, -2, 0),
      new Vec3(0, 1, 0),
      4,
      1,
      "none",
    );
    const curves = intersectSphereCylinder(sphere, cylinder, 160, useBezierFit);
    assertOnSurfaces(curves, [sphere, cylinder], 2.1e-5);
    const components = endpointGraph(curves);
    assert.equal(components.length, 1);
    assert.ok(
      components[0].every((vertex) => vertex.neighbors.length === 2),
      "one closed loop, without gaps or synthetic closures",
    );
    const actualHeight = Math.max(
      ...curves.flatMap((curve) => [
        Math.abs(curve.p0.y),
        Math.abs(curve.p3.y),
      ]),
    );
    assert.ok(
      Math.abs(actualHeight - Math.sqrt(2 * distance - distance * distance)) <
        2e-5,
    );
  });

  test(`sphere-cone preserves a narrow closed loop between angular samples (fit=${useBezierFit})`, () => {
    const phi = Math.PI / 160;
    const offset = 0.4999 / Math.SQRT2;
    const sphere = new Sphere(
      "sphere",
      new Vec3(
        (1 + offset) * Math.cos(phi),
        1 - offset,
        (1 + offset) * Math.sin(phi),
      ),
      0.5,
    );
    const cone = new Cone("cone", Vec3.zero(), new Vec3(0, 1, 0), 4, 4, "none");
    const curves = intersectSphereCone(sphere, cone, 160, useBezierFit);
    assertOnSurfaces(curves, [sphere, cone], 8.4e-5);
    const components = endpointGraph(curves);
    assert.equal(components.length, 1);
    assert.ok(components[0].every((vertex) => vertex.neighbors.length === 2));
  });

  test(`sphere-cylinder clips two tiny open arcs at exact axial boundaries (fit=${useBezierFit})`, () => {
    const sphere = new Sphere("sphere", new Vec3(1, 0, 0), 1);
    const cylinder = new Cylinder(
      "cylinder",
      Vec3.zero(),
      new Vec3(0, 1, 0),
      0.05,
      1,
      "none",
    );
    const curves = intersectSphereCylinder(sphere, cylinder, 160, useBezierFit);
    assertOnSurfaces(curves, [sphere, cylinder], 2.1e-5);
    const xTop = 0.50125;
    assertOpenEndpoints(
      curves,
      [
        new Vec3(0.5, 0, Math.sqrt(0.75)),
        new Vec3(0.5, 0, -Math.sqrt(0.75)),
        new Vec3(xTop, 0.05, Math.sqrt(1 - xTop * xTop)),
        new Vec3(xTop, 0.05, -Math.sqrt(1 - xTop * xTop)),
      ],
      2,
    );
  });

  test(`sphere-cone ends at its finite base rather than the last valid angular sample (fit=${useBezierFit})`, () => {
    const sphere = new Sphere("sphere", new Vec3(1, 1, 0), 0.25);
    const cone = new Cone("cone", Vec3.zero(), new Vec3(0, 1, 0), 1, 1, "none");
    const curves = intersectSphereCone(sphere, cone, 160, useBezierFit);
    assertOnSurfaces(curves, [sphere, cone], 2.1e-5);
    const x = 0.96875;
    assertOpenEndpoints(
      curves,
      [
        new Vec3(x, 1, Math.sqrt(1 - x * x)),
        new Vec3(x, 1, -Math.sqrt(1 - x * x)),
      ],
      1,
    );
  });
}

test("critical-angle rounding does not erase a sphere-cylinder root born at parameter zero", () => {
  const sphere = new Sphere("sphere", new Vec3(0.5, 0, 0), Math.sqrt(1.45));
  const cylinder = new Cylinder(
    "cylinder",
    Vec3.zero(),
    new Vec3(0, 1, 0),
    2,
    1,
    "none",
  );
  const curves = intersectSphereCylinder(sphere, cylinder, 160, true);
  assertOnSurfaces(curves, [sphere, cylinder], 2.6e-5);
  const x = -0.2;
  assertOpenEndpoints(
    curves,
    [
      new Vec3(x, 0, Math.sqrt(1 - x * x)),
      new Vec3(x, 0, -Math.sqrt(1 - x * x)),
    ],
    1,
  );
});

test("parallel and opposed cylinder axes preserve two clipped generators", () => {
  const c0 = new Cylinder(
    "c0",
    new Vec3(0, -2, 0),
    new Vec3(0, 1, 0),
    4,
    1,
    "none",
  );
  const c1 = new Cylinder(
    "c1",
    new Vec3(0.5, 2, 0),
    new Vec3(0, -1, 0),
    2,
    1,
    "none",
  );
  const curves = intersectCylinderCylinder(c0, c1, 160);
  assertOnSurfaces(curves, [c0, c1], 1e-12);
  const z = Math.sqrt(1 - 0.25 * 0.25);
  assertOpenEndpoints(
    curves,
    [
      new Vec3(0.25, 0, z),
      new Vec3(0.25, 0, -z),
      new Vec3(0.25, 2, z),
      new Vec3(0.25, 2, -z),
    ],
    2,
  );
});

test("fitted cone-cone curves remain on both surfaces between their input samples", () => {
  const c0 = new Cone(
    "c0",
    new Vec3(1.8, -1, -0.3),
    new Vec3(0, 1, 0),
    2.2,
    0.9,
    "none",
  );
  const c1 = new Cone(
    "c1",
    new Vec3(1.4, -0.8, 0.2),
    new Vec3(0.2, 1, -0.1),
    2,
    0.85,
    "none",
  );
  assertOnSurfaces(intersectConeCone(c0, c1, 160, true), [c0, c1], 1.9e-5);
});

test("sphere-cylinder preserves two separate coaxial closed components", () => {
  const sphere = new Sphere("sphere", Vec3.zero(), 1.5);
  const cylinder = new Cylinder(
    "cylinder",
    new Vec3(0, -2, 0),
    new Vec3(0, 1, 0),
    4,
    1,
    "none",
  );
  const curves = intersectSphereCylinder(sphere, cylinder, 112, true);
  assertOnSurfaces(curves, [sphere, cylinder], 3.2e-5);
  const components = endpointGraph(curves);
  assert.equal(components.length, 2);
  assert.ok(
    components.every((component) =>
      component.every((vertex) => vertex.neighbors.length === 2),
    ),
  );
});

test("a sphere-cone intersection through the apex does not emit degenerate curves", () => {
  const sphere = new Sphere("sphere", new Vec3(1, 0, 0), 1);
  const cone = new Cone(
    "cone",
    Vec3.zero(),
    new Vec3(0, 1, 0),
    0.05,
    0.05,
    "none",
  );
  const curves = intersectSphereCone(sphere, cone, 160, true);
  assertOnSurfaces(curves, [sphere, cone], 2.1e-5);
  assert.ok(curves.every((curve) => Vec3.distance(curve.p0, curve.p3) > 1e-10));
  const x = 0.0025;
  const z = 0.05 * Math.sqrt(1 - 0.05 * 0.05);
  assertOpenEndpoints(curves, [new Vec3(x, 0.05, z), new Vec3(x, 0.05, -z)], 1);
});

test("cones sharing an apex retain their common generators when the quadratic is identically zero", () => {
  const c0 = new Cone("c0", Vec3.zero(), new Vec3(0, 1, 0), 2, 1, "none");
  const c1 = new Cone("c1", Vec3.zero(), new Vec3(0.5, 1, 0), 2, 1, "none");
  const curves = intersectConeCone(c0, c1, 160, true);
  assert.equal(curves.length, 2);
  assertOnSurfaces(curves, [c0, c1], 1e-12);
  assert.ok(
    curves.every(
      (curve) =>
        Vec3.distance(curve.p0, Vec3.zero()) === 0 &&
        Vec3.distance(curve.p3, Vec3.zero()) > 1,
    ),
  );
});

test("narrow sphere-cylinder topology and error tolerance survive changes in world scale", () => {
  const phi = Math.PI / 160;
  for (const scale of [0.001, 1000]) {
    const sphere = new Sphere(
      "sphere",
      new Vec3(
        1.9999 * scale * Math.cos(phi),
        0,
        1.9999 * scale * Math.sin(phi),
      ),
      scale,
    );
    const cylinder = new Cylinder(
      "cylinder",
      new Vec3(0, -2 * scale, 0),
      new Vec3(0, 1, 0),
      4 * scale,
      scale,
      "none",
    );
    const curves = intersectSphereCylinder(sphere, cylinder, 160, true);
    assertOnSurfaces(curves, [sphere, cylinder], 2.1e-5 * scale);
    const components = endpointGraph(curves, scale * 1e-7);
    assert.equal(components.length, 1);
    assert.ok(components[0].every((vertex) => vertex.neighbors.length === 2));
  }
});

test("sphere-sphere circle cubics keep their radial error below the sampled-pair tolerance", () => {
  const s0 = new Sphere("s0", new Vec3(-0.7, 0, 0), 1.35);
  const s1 = new Sphere("s1", new Vec3(0.7, 0.15, 0), 1.35);
  const curves = intersectSphereSphere(s0, s1);
  assertOnSurfaces(curves, [s0, s1], 1e-5);
  const components = endpointGraph(curves);
  assert.equal(components.length, 1);
  assert.ok(components[0].every((vertex) => vertex.neighbors.length === 2));
});

test("translated tangent cones retain an entire shared generator", () => {
  const c0 = new Cone("c0", Vec3.zero(), new Vec3(0, 1, 0), 3, 1.5, "none");
  const c1 = new Cone(
    "c1",
    new Vec3(0.5, 1, 0),
    new Vec3(0, 1, 0),
    2,
    1,
    "none",
  );
  const curves = intersectConeCone(c0, c1, 64, true);
  assertOnSurfaces(curves, [c0, c1], 1e-12);
  assertOpenEndpoints(curves, [new Vec3(0.5, 1, 0), new Vec3(1.5, 3, 0)], 1);
});

test("long cylinders do not collapse two distinct sphere roots at the angular seam", () => {
  const sphere = new Sphere("sphere", new Vec3(0, 500000, 0), Math.SQRT2);
  const cylinder = new Cylinder(
    "cylinder",
    Vec3.zero(),
    new Vec3(0, 1, 0),
    1000000,
    1,
    "none",
  );
  const curves = intersectSphereCylinder(sphere, cylinder, 32, true);
  assertOnSurfaces(curves, [sphere, cylinder], 3e-5);
  assert.ok(
    curves.every((curve) => Math.abs(Math.abs(curve.p0.y - 500000) - 1) < 3e-5),
  );
  assert.equal(endpointGraph(curves).length, 2);
});
