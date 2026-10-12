import test from "node:test";
import assert from "node:assert/strict";
import {
  Vec3,
  Cylinder,
  Cone,
  PlaneRect,
  Disk,
  Sphere,
  evalCubic3,
} from "../dist/index.js";
import { planeSurfaceCurvesToOwnedCubics } from "../dist/scene/intersections/planeSurfaceCurves.js";

const up = new Vec3(0, 1, 0),
  normal = new Vec3(0, 0, 1);
const cylinder = new Cylinder("cylinder", new Vec3(0, -2, 0), up, 4, 1);

test("a finite plane keeps a narrow sphere arc between angular samples", () => {
  const angle = Math.PI / 64;
  const center = new Vec3(Math.cos(angle), Math.sin(angle), 0);
  const tangent = new Vec3(-Math.sin(angle), Math.cos(angle), 0);
  const plane = new PlaneRect("plane", center, normal, tangent, 0.003, 0.01);
  const sphere = new Sphere("sphere", Vec3.zero(), 1);
  const curves = planeSurfaceCurvesToOwnedCubics([plane], [sphere], {
    angularSamples: 32,
  });
  assert.ok(curves.length > 0);
  for (const { bez } of curves)
    for (let i = 0; i <= 10; i++) {
      const point = evalCubic3(bez, i / 10);
      assert.ok(Math.abs(Vec3.len(point) - 1) < 2e-5);
      assert.ok(
        Math.abs(Vec3.dot(Vec3.sub(point, center), tangent)) <= 0.003 + 1e-10,
      );
    }
  const start = curves[0].bez.p0,
    end = curves.at(-1).bez.p3;
  assert.ok(
    Vec3.distance(start, end) > 0.0059,
    "the open arc must reach both plane boundaries",
  );
});

test("finite disk containment stays relative to the geometry scale", () => {
  for (const scale of [1, 1e-6, 1e3]) {
    const sphere = new Sphere("sphere", Vec3.zero(), scale);
    const disk = new Disk("disk", Vec3.zero(), up, 0.2 * scale);
    assert.equal(planeSurfaceCurvesToOwnedCubics([disk], [sphere]).length, 0);
  }
});

test("finite rectangles clip parallel cylinder generators even when both ends are outside", () => {
  const rect = new PlaneRect(
    "rect",
    Vec3.zero(),
    normal,
    new Vec3(1, 0, 0),
    2,
    0.4,
  );
  const curves = planeSurfaceCurvesToOwnedCubics([rect], [cylinder]);
  assert.equal(curves.length, 2);
  for (const { bez } of curves) {
    assert.ok(Math.abs(Math.abs(bez.p0.x) - 1) < 1e-10);
    assert.ok(Math.abs(bez.p0.y + 0.4) < 1e-10);
    assert.ok(Math.abs(bez.p3.y - 0.4) < 1e-10);
  }
});

test("finite disks clip parallel generators to their circular boundary", () => {
  const disk = new Disk("disk", Vec3.zero(), normal, 1.5);
  const curves = planeSurfaceCurvesToOwnedCubics([disk], [cylinder]);
  assert.equal(curves.length, 2);
  for (const { bez } of curves) {
    assert.ok(Math.abs(Vec3.len(bez.p0) - 1.5) < 1e-10);
    assert.ok(Math.abs(Vec3.len(bez.p3) - 1.5) < 1e-10);
    assert.ok(Math.abs(bez.p0.y + Math.sqrt(1.25)) < 1e-10);
  }
});

test("a plane through the cone apex returns clipped generators", () => {
  const cone = new Cone("cone", Vec3.zero(), up, 3, 2);
  const rect = new PlaneRect(
    "rect",
    new Vec3(0, 1, 0),
    normal,
    new Vec3(1, 0, 0),
    3,
    0.5,
  );
  const curves = planeSurfaceCurvesToOwnedCubics([rect], [cone]);
  assert.equal(curves.length, 2);
  for (const { bez } of curves) {
    assert.ok(Math.abs(bez.p0.y - 0.5) < 1e-10);
    assert.ok(Math.abs(bez.p3.y - 1.5) < 1e-10);
    for (let i = 0; i <= 10; i++) {
      const p = evalCubic3(bez, i / 10);
      assert.ok(Math.abs(Math.abs(p.x) - (p.y * 2) / 3) < 1e-10);
    }
  }
});
