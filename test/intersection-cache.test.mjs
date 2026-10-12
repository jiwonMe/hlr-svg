import test from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "../dist/math/vec3.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { Cylinder } from "../dist/scene/primitives/cylinder.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { Disk } from "../dist/scene/primitives/disk.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { TriangleMesh } from "../dist/scene/primitives/triangleMesh.js";
import {
  cachedIntersectionCurvesToOwnedCubics,
  intersectionCurvesToOwnedCubics,
  intersectionGeometrySignature,
} from "../dist/scene/intersections/intersectionCurves.js";

const options = { angularSamples: 112 };

test("intersection cache reuses geometry across equivalent option objects", () => {
  const primitives = [
    new Sphere("sphere", new Vec3(0.45, 0.1, 0), 1.35),
    new Cylinder(
      "cylinder",
      new Vec3(-0.3, -1.7, 0),
      new Vec3(0, 1, 0),
      3.4,
      0.82,
    ),
  ];
  const cold = cachedIntersectionCurvesToOwnedCubics(primitives, options);
  assert.ok(cold.length > 0);
  assert.deepEqual(cold, intersectionCurvesToOwnedCubics(primitives, options));
  assert.strictEqual(
    cold,
    cachedIntersectionCurvesToOwnedCubics(primitives, {
      angularSamples: 112,
      useBezierFit: true,
      fitMode: "stitchThenFit",
    }),
  );
  const dense = cachedIntersectionCurvesToOwnedCubics(primitives, {
    angularSamples: 160,
  });
  assert.notStrictEqual(dense, cold);
  const linear = cachedIntersectionCurvesToOwnedCubics(primitives, {
    ...options,
    useBezierFit: false,
  });
  assert.notStrictEqual(linear, cold);
  const perRun = cachedIntersectionCurvesToOwnedCubics(primitives, {
    ...options,
    fitMode: "perRun",
  });
  assert.notStrictEqual(perRun, cold);
  assert.strictEqual(
    cold,
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
  );
});

const fixtures = [
  [() => new Sphere("shape", new Vec3(0.5, 0, 0), 1), ["center.x", "radius"]],
  [
    () => new Cylinder("shape", new Vec3(0, -2, 0), new Vec3(0, 1, 0), 4, 0.8),
    ["base.x", "axis.x", "height", "radius", "caps"],
  ],
  [
    () => new Cone("shape", new Vec3(0, -2, 0), new Vec3(0, 1, 0), 4, 2),
    ["apex.x", "axis.x", "height", "baseRadius", "k", "cap"],
  ],
  [
    () =>
      new PlaneRect(
        "shape",
        Vec3.zero(),
        new Vec3(0, 1, 0),
        new Vec3(1, 0, 0),
        2,
        2,
      ),
    ["center.x", "normal.x", "u.z", "v.x", "halfWidth", "halfHeight"],
  ],
  [
    () => new Disk("shape", Vec3.zero(), new Vec3(0, 1, 0), 2),
    ["center.x", "normal.x", "radius"],
  ],
  [
    () =>
      new BoxAabb("shape", new Vec3(-0.8, -0.8, -0.8), new Vec3(0.8, 0.8, 0.8)),
    ["min.x", "max.x"],
  ],
];

for (const [createShape, paths] of fixtures) {
  const name = createShape().constructor.name;
  test(`${name} value mutations invalidate cached intersection geometry`, () => {
    const shape = createShape();
    const primitives = [new Sphere("sphere", Vec3.zero(), 1), shape];
    let previous = cachedIntersectionCurvesToOwnedCubics(primitives, options);
    for (const path of [...paths, "id"]) {
      const keys = path.split(".");
      const property = keys.pop();
      const target = keys.reduce((value, key) => value[key], shape);
      target[property] =
        typeof target[property] === "number"
          ? target[property] + 0.01
          : `${target[property]}-changed`;
      const updated = cachedIntersectionCurvesToOwnedCubics(
        primitives,
        options,
      );
      assert.notStrictEqual(updated, previous, `${path} must invalidate`);
      assert.deepEqual(
        updated,
        intersectionCurvesToOwnedCubics(primitives, options),
        `${path} must match a fresh calculation`,
      );
      assert.strictEqual(
        updated,
        cachedIntersectionCurvesToOwnedCubics(primitives, options),
      );
      previous = updated;
    }
  });
}

test("intersection cache tracks array membership, ordering and replacement by value", () => {
  const s0 = new Sphere("a", Vec3.zero(), 1);
  const s1 = new Sphere("b", new Vec3(0.5, 0, 0), 1);
  const primitives = [s0, s1];
  const initial = cachedIntersectionCurvesToOwnedCubics(primitives, options);
  primitives[1] = new Sphere("b", new Vec3(0.5, 0, 0), 1);
  assert.strictEqual(
    initial,
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
  );
  primitives.reverse();
  const reversed = cachedIntersectionCurvesToOwnedCubics(primitives, options);
  assert.notStrictEqual(initial, reversed);
  assert.deepEqual(
    reversed,
    intersectionCurvesToOwnedCubics(primitives, options),
  );
  primitives.pop();
  const removed = cachedIntersectionCurvesToOwnedCubics(primitives, options);
  assert.equal(removed.length, 0);
  assert.notStrictEqual(reversed, removed);
  primitives.push(s0);
  assert.strictEqual(
    reversed,
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
  );
});

test("cached results cannot be mutated and never freeze aliased primitive endpoints", () => {
  const cones = [
    new Cone("a", Vec3.zero(), new Vec3(0, 1, 0), 2, 1, "none"),
    new Cone("b", Vec3.zero(), new Vec3(0.5, 1, 0), 2, 1, "none"),
  ];
  const curves = cachedIntersectionCurvesToOwnedCubics(cones, options);
  const generator = curves.find((curve) => Vec3.lenSq(curve.bez.p0) === 0);
  assert.ok(generator);
  assert.ok(Object.isFrozen(curves));
  assert.ok(Object.isFrozen(generator));
  assert.ok(Object.isFrozen(generator.bez));
  assert.ok(Object.isFrozen(generator.bez.p0));
  assert.ok(Object.isFrozen(generator.ignorePrimitiveIds));
  assert.throws(() => {
    generator.bez.p0.x = 100;
  }, TypeError);
  assert.throws(() => {
    generator.ignorePrimitiveIds.push("other");
  }, TypeError);
  assert.ok(!Object.isFrozen(cones[0].apex));
  cones[0].apex.x = 0.1;
  assert.equal(generator.bez.p0.x, 0);
  assert.deepEqual(
    cachedIntersectionCurvesToOwnedCubics(cones, options),
    intersectionCurvesToOwnedCubics(cones, options),
  );
});

test("intersection cache bounds sampling variants for each live primitive array", () => {
  const primitives = [
    new Sphere("a", Vec3.zero(), 1),
    new Sphere("b", new Vec3(0.5, 0, 0), 1),
  ];
  const initial = cachedIntersectionCurvesToOwnedCubics(primitives, {
    angularSamples: 32,
  });
  for (const angularSamples of [33, 34, 35, 36])
    cachedIntersectionCurvesToOwnedCubics(primitives, { angularSamples });
  const recomputed = cachedIntersectionCurvesToOwnedCubics(primitives, {
    angularSamples: 32,
  });
  assert.notStrictEqual(initial, recomputed);
  assert.deepEqual(initial, recomputed);
});

test("geometry signatures include mutable mesh vertices, indices and bounds", () => {
  const mesh = new TriangleMesh(
    "mesh",
    [Vec3.zero(), new Vec3(1, 0, 0), new Vec3(0, 1, 0)],
    [[0, 1, 2]],
  );
  const primitives = [mesh];
  let previous = intersectionGeometrySignature(primitives);
  assert.equal(typeof previous, "string");
  for (const mutate of [
    () => {
      mesh.vertices[1].x += 0.01;
    },
    () => {
      mesh.triangles[0][1] = 2;
    },
    () => {
      mesh.bounds.max.z += 0.01;
    },
    () => {
      mesh.weldEps *= 2;
    },
  ]) {
    mutate();
    const updated = intersectionGeometrySignature(primitives);
    assert.notEqual(updated, previous);
    previous = updated;
  }
});

test("geometry signatures disable caching for custom and nonfinite primitive state", () => {
  const custom = { id: "custom", intersect: () => null };
  assert.equal(intersectionGeometrySignature([custom]), undefined);
  class CustomSphere extends Sphere {}
  assert.equal(
    intersectionGeometrySignature([new CustomSphere("custom", Vec3.zero(), 1)]),
    undefined,
  );
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  sphere.intersect = () => null;
  assert.equal(intersectionGeometrySignature([sphere]), undefined);
  sphere.intersect = Sphere.prototype.intersect;
  sphere.center.x = Infinity;
  assert.equal(intersectionGeometrySignature([sphere]), undefined);
  const primitives = [custom];
  assert.notStrictEqual(
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
  );
});

test("global prototype intersection overrides disable caches until the original method returns", () => {
  const primitives = [
    new Sphere("a", Vec3.zero(), 1),
    new Sphere("b", new Vec3(0.5, 0, 0), 1),
  ];
  const cached = cachedIntersectionCurvesToOwnedCubics(primitives, options);
  const original = Sphere.prototype.intersect;
  try {
    Sphere.prototype.intersect = () => null;
    assert.equal(intersectionGeometrySignature(primitives), undefined);
    const overridden = cachedIntersectionCurvesToOwnedCubics(
      primitives,
      options,
    );
    assert.notStrictEqual(overridden, cached);
    assert.notStrictEqual(
      overridden,
      cachedIntersectionCurvesToOwnedCubics(primitives, options),
    );
  } finally {
    Sphere.prototype.intersect = original;
  }
  assert.strictEqual(
    cached,
    cachedIntersectionCurvesToOwnedCubics(primitives, options),
  );
});
