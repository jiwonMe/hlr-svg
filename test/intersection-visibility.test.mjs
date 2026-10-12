import test from "node:test";
import assert from "node:assert/strict";
import {
  Camera,
  Vec3,
  Sphere,
  Cylinder,
  Cone,
  evalCubic3,
  intersectionCurvesToOwnedCubics,
} from "../dist/index.js";
import { Scene } from "../dist/scene/scene.js";

const pairs = [
  [
    new Sphere("sphere", new Vec3(0.45, 0.1, 0), 1.35),
    new Cylinder(
      "cylinder",
      new Vec3(-0.3, -1.7, 0),
      new Vec3(0, 1, 0),
      3.4,
      0.82,
    ),
  ],
  [
    new Sphere("sphere", new Vec3(-0.45, -0.25, 0.15), 1.2),
    new Cone("cone", new Vec3(0.25, 1.7, 0), new Vec3(0, -1, 0), 3.4, 1.45),
  ],
];

function normalAt(primitive, point) {
  if (primitive instanceof Sphere)
    return Vec3.normalize(Vec3.sub(point, primitive.center));
  const offset = Vec3.sub(
    point,
    primitive instanceof Cone ? primitive.apex : primitive.base,
  );
  const height = Vec3.dot(offset, primitive.axis);
  const radial = Vec3.sub(offset, Vec3.mulScalar(primitive.axis, height));
  if (primitive instanceof Cylinder) return Vec3.normalize(radial);
  const slope = primitive.baseRadius / primitive.height;
  return Vec3.normalize(
    Vec3.sub(Vec3.normalize(radial), Vec3.mulScalar(primitive.axis, slope)),
  );
}

for (const kind of ["orthographic", "perspective"]) {
  test(`${kind} playground intersections keep the entire front arc solid and rear arcs hidden`, () => {
    let front = 0,
      back = 0;
    for (const primitives of pairs) {
      const curves = intersectionCurvesToOwnedCubics(primitives, {
        angularSamples: 112,
      });
      for (const position of [
        new Vec3(5, 5, 5),
        new Vec3(-5, 3, 5),
        new Vec3(5, -3, -5),
      ]) {
        const camera = Camera.from({
          kind,
          position,
          target: Vec3.zero(),
          up: new Vec3(0, 1, 0),
          halfHeight: 2.65,
          fovYRad: Math.PI / 3,
          aspect: 1.2,
          near: 0.05,
          far: 100,
        });
        const scene = new Scene(primitives, camera);
        for (const curve of curves)
          for (let i = 0; i <= 40; i++) {
            const point = evalCubic3(curve.bez, i / 40);
            const dir =
              kind === "orthographic"
                ? camera.forward
                : Vec3.normalize(Vec3.sub(point, position));
            const facing = primitives.map((primitive) =>
              Vec3.dot(normalAt(primitive, point), dir),
            );
            const visible = scene.visibleAtPoint(point, {
              ignorePrimitiveIds: curve.ignorePrimitiveIds,
            });
            // Leave the grazing transition to the visibility splitter: both
            // normals facing the viewer identifies the interior of a front arc.
            if (facing.every((value) => value < -0.08)) {
              assert.equal(
                visible,
                true,
                `front arc disappeared at ${JSON.stringify(point)}`,
              );
              front++;
            } else if (facing.some((value) => value > 0.08)) {
              assert.equal(
                visible,
                false,
                `rear arc leaked at ${JSON.stringify(point)}`,
              );
              back++;
            }
          }
      }
    }
    assert.ok(
      front > 50 && back > 50,
      "check both front and rear arcs across several views",
    );
  });
}

test("an unrelated object still occludes an owned intersection", () => {
  const primitives = pairs[0];
  const camera = Camera.from({
    kind: "orthographic",
    position: new Vec3(5, 5, 5),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    halfHeight: 2.65,
    aspect: 1,
    near: 0.05,
    far: 100,
  });
  const scene = new Scene(primitives, camera);
  const curves = intersectionCurvesToOwnedCubics(primitives, {
    angularSamples: 112,
  });
  for (const curve of curves)
    for (const t of [0.25, 0.5, 0.75]) {
      const point = evalCubic3(curve.bez, t);
      if (
        !primitives.every(
          (primitive) =>
            Vec3.dot(normalAt(primitive, point), camera.forward) < -0.1,
        )
      )
        continue;
      assert.equal(
        scene.visibleAtPoint(point, {
          ignorePrimitiveIds: curve.ignorePrimitiveIds,
        }),
        true,
      );
      const blocker = new Sphere(
        "blocker",
        Vec3.sub(point, Vec3.mulScalar(camera.forward, 0.15)),
        0.1,
      );
      const occluded = new Scene([...primitives, blocker], camera);
      assert.equal(
        occluded.visibleAtPoint(point, {
          ignorePrimitiveIds: curve.ignorePrimitiveIds,
        }),
        false,
      );
      return;
    }
  assert.fail("expected a front-facing intersection sample");
});
