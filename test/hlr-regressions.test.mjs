import test from "node:test";
import assert from "node:assert/strict";

import { Camera } from "../dist/camera/camera.js";
import { evalCubic3 } from "../dist/curves/cubicBezier3.js";
import { buildDemoCases } from "../dist/demo/cases.js";
import { findVisibilityCutsOnCubicWithVisibility } from "../dist/hlr/visibilityCuts.js";
import { Vec3 } from "../dist/math/vec3.js";
import { intersectionCurvesToOwnedCubics } from "../dist/scene/intersections/intersectionCurves.js";
import { Scene as RayScene } from "../dist/scene/scene.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";

test("visibleAtPoint keeps thin occluders near the target", () => {
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(0, 0, 5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: Math.PI / 3,
    aspect: 1,
    near: 0.1,
    far: 100,
  });
  const scene = new RayScene(
    [new Sphere("outer", new Vec3(0, 0, 0), 1)],
    camera,
  );

  assert.equal(
    scene.visibleAtPoint(new Vec3(0, 0, 0.999), { eps: 2e-4 }),
    false,
  );
});

test("visibility cuts preserve a narrow sampled hidden span", () => {
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(0, 0, 5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: Math.PI / 3,
    aspect: 1,
    near: 0.1,
    far: 100,
  });
  const scene = new RayScene(
    [new Sphere("occ", new Vec3(0, 0, 0.5), 0.05)],
    camera,
  );
  const cubic = {
    p0: new Vec3(-1, 0, 0),
    p1: new Vec3(-1 / 3, 0, 0),
    p2: new Vec3(1 / 3, 0, 0),
    p3: new Vec3(1, 0, 0),
  };

  const raw = [];
  for (let i = 0; i <= 12; i++) {
    raw.push(
      scene.visibleAtPoint(evalCubic3(cubic, i / 12), { eps: 1e-6 }),
    );
  }
  assert.deepEqual(raw, [
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);

  const cuts = findVisibilityCutsOnCubicWithVisibility(cubic, scene, {
    samples: 12,
    refineIters: 20,
    epsVisible: 1e-6,
    cutEps: 1e-6,
  });

  assert.equal(cuts.cuts.length, 2);
  assert.deepEqual(cuts.segmentVisible, [true, false, true]);
});

test("owned intersection curves stay visible through nearby hits from participating surfaces", () => {
  const demo = buildDemoCases().find(
    (x) => x.name === "Intersection: Cylinder × Cylinder (with HLR)",
  );
  assert.ok(demo);

  const scene = new RayScene(demo.primitives, demo.camera);
  const owned = intersectionCurvesToOwnedCubics(demo.primitives, {
    angularSamples: 160,
    useBezierFit: true,
    fitMode: "stitchThenFit",
  });

  let found = false;
  for (const x of owned) {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = evalCubic3(x.bez, t);
      const origin = demo.camera.position;
      const dir = Vec3.normalize(Vec3.sub(p, origin));
      const targetDist = Vec3.distance(p, origin);
      const hit = scene.raycastClosest(
        { origin, dir },
        { tMin: 0, tMax: Math.max(0, targetDist - 2e-4) },
      );
      if (!hit) continue;
      const gap = Math.max(0, targetDist - hit.t);
      if (
        x.ignorePrimitiveIds.includes(hit.primitiveId) &&
        gap > 5e-4 &&
        gap < 4.8e-3
      ) {
        assert.equal(
          scene.visibleAtPoint(p, {
            eps: 2e-4,
            ignorePrimitiveIds: x.ignorePrimitiveIds,
          }),
          true,
        );

        assert.equal(
          scene.visibleAtPoint(p, {
            eps: 2e-4,
          }),
          false,
        );

        const hitWithIgnore = scene.raycastClosest(
          { origin, dir },
          {
            tMin: 0,
            tMax: Math.max(0, targetDist - 2e-4),
            ignorePrimitiveIds: x.ignorePrimitiveIds,
          },
        );
        assert.ok(
          hitWithIgnore === null ||
            !x.ignorePrimitiveIds.includes(hitWithIgnore.primitiveId),
        );
        found = true;
        break;
      }
    }
    if (found) break;
  }

  assert.equal(found, true);
});

test("owned plane-cone intersections keep front hits visible but hidden spans dashed", () => {
  const width = 700;
  const height = 520;
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
  const plane = new PlaneRect(
    "plane",
    new Vec3(0.0, -0.2, -1.2),
    new Vec3(0, 1, 0.15),
    new Vec3(1, 0, 0),
    2.2,
    1.4,
  );
  const cone = new Cone(
    "cone",
    new Vec3(1.8, -1.0, -0.3),
    new Vec3(0, 1, 0),
    2.2,
    0.9,
    "base",
  );
  const scene = new RayScene([plane, cone], camera);
  const owned = intersectionCurvesToOwnedCubics([plane, cone], {
    angularSamples: 160,
    useBezierFit: true,
    fitMode: "stitchThenFit",
  });

  let foundFront = false;
  let foundBack = false;

  for (const x of owned) {
    for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const p = evalCubic3(x.bez, t);
      const origin = camera.position;
      const dir = Vec3.normalize(Vec3.sub(p, origin));
      const targetDist = Vec3.distance(p, origin);
      const hit = scene.raycastClosest(
        { origin, dir },
        { tMin: 0, tMax: Math.max(0, targetDist - 2e-4) },
      );
      if (!hit || !x.ignorePrimitiveIds.includes(hit.primitiveId)) continue;

      const gap = Math.max(0, targetDist - hit.t);
      if (!foundFront && gap > 5e-4 && gap < 4.8e-3) {
        assert.equal(
          scene.visibleAtPoint(p, {
            eps: 2e-4,
            ignorePrimitiveIds: x.ignorePrimitiveIds,
          }),
          true,
        );
        foundFront = true;
      }
      if (!foundBack && gap > 5e-2) {
        assert.equal(
          scene.visibleAtPoint(p, {
            eps: 2e-4,
            ignorePrimitiveIds: x.ignorePrimitiveIds,
          }),
          false,
        );
        foundBack = true;
      }
      if (foundFront && foundBack) break;
    }
    if (foundFront && foundBack) break;
  }

  assert.equal(foundFront, true);
  assert.equal(foundBack, true);
});

test("plane-surface intersections honor angularSamples", () => {
  const plane = new PlaneRect(
    "plane",
    new Vec3(0.0, -0.2, -1.2),
    new Vec3(0, 1, 0.15),
    new Vec3(1, 0, 0),
    2.2,
    1.4,
  );
  const cone = new Cone(
    "cone",
    new Vec3(1.8, -1.0, -0.3),
    new Vec3(0, 1, 0),
    2.2,
    0.9,
    "base",
  );

  const coarse = intersectionCurvesToOwnedCubics([plane, cone], {
    angularSamples: 32,
    useBezierFit: false,
    fitMode: "stitchThenFit",
  });
  const fine = intersectionCurvesToOwnedCubics([plane, cone], {
    angularSamples: 160,
    useBezierFit: false,
    fitMode: "stitchThenFit",
  });

  assert.ok(fine.length > coarse.length);
});

test("BoxAabb returns the exit hit for inside-origin rays", () => {
  const box = new BoxAabb(
    "box",
    new Vec3(-1, -1, -1),
    new Vec3(1, 1, 1),
  );
  const hit = box.intersect(
    { origin: new Vec3(0, 0, 0), dir: new Vec3(1, 0, 0) },
    0,
    Number.POSITIVE_INFINITY,
  );

  assert.ok(hit);
  assert.equal(hit.t, 1);
  assert.equal(hit.point.x, 1);
  assert.equal(hit.point.y, 0);
  assert.equal(hit.point.z, 0);
  assert.equal(hit.normal.x, 1);
  assert.equal(hit.normal.y, 0);
  assert.equal(hit.normal.z, 0);
});
