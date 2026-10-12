import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { evalCubic3 } from "../dist/curves/cubicBezier3.js";
import {
  spherePlaneSectionsGeometry,
  spherePlaneSectionCurves,
  buildSpherePlaneSectionsDemo,
  renderSpherePlaneSectionsSvg,
} from "../dist/demo/spherePlaneSections.js";

const near = (actual, expected, eps = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);

test("examination diagram satisfies sphere, section, angle, height and parallel conditions", () => {
  const { sphere, alpha, beta, O, A, P, Q, R, H } =
    spherePlaneSectionsGeometry();
  near(sphere.radius, 2);
  for (const p of [P, Q, R]) near(Vec3.len(Vec3.sub(p, O)), 2);
  near(Vec3.dot(Vec3.sub(P, alpha.center), alpha.normal), 0);
  for (const p of [A, Q, R])
    near(Vec3.dot(Vec3.sub(p, beta.center), beta.normal), 0);
  const aq = Vec3.sub(Q, A),
    ar = Vec3.sub(R, A);
  near(Vec3.len(aq), 1);
  near(Vec3.len(ar), 1);
  near(Vec3.dot(aq, ar), 0);
  near(Vec3.len(Vec3.cross(Vec3.sub(P, O), aq)), 0);
  near(Math.acos(Vec3.dot(alpha.normal, beta.normal)), Math.PI / 4);
  near(Vec3.len(Vec3.sub(A, H)), Math.sqrt(6) / 2);
  near(Vec3.dot(Vec3.sub(H, alpha.center), alpha.normal), 0);
  near(Vec3.len(Vec3.sub(A, O)), Math.sqrt(3));
});

test("both authored section curves stay on their true sphere-plane sections", () => {
  const { alpha, beta } = spherePlaneSectionsGeometry();
  const { C1, C2 } = spherePlaneSectionCurves();
  for (const [curves, plane] of [
    [C1, alpha],
    [C2, beta],
  ]) {
    assert.equal(curves.length, 16);
    for (const curve of curves) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = evalCubic3(curve, t);
        near(Vec3.dot(Vec3.sub(p, plane.center), plane.normal), 0);
        near(Vec3.len(p), 2, 2e-7);
      }
    }
  }
});

test("vector export retains mathematical labels, hidden arcs and camera-dependent guides", () => {
  const demo = buildSpherePlaneSectionsDemo(900, 560);
  const initial = renderSpherePlaneSectionsSvg(demo.camera, 900, 560);
  for (const label of ["O", "P", "Q", "R", "A", "α", "β", "45°"]) {
    assert.ok(initial.includes(`>${label}<`), label);
  }
  // AH = √6/2: a radical with its bar over 6, on a dashed arc broken for it.
  const height = initial.match(/<g data-label="height"[^>]*>(.*?)<\/g>/)?.[1] ?? "";
  for (const part of [">√<", ">6<", ">2<"]) assert.ok(height.includes(part), part);
  const arc = initial.match(/data-label="height-arc" d="([^"]+)"/)?.[1] ?? "";
  assert.equal((arc.match(/Q/g) ?? []).length, 2, "the arc is broken in the middle");
  assert.ok(initial.includes('baseline-shift="sub"'));
  assert.ok(initial.includes('stroke-dasharray="3 3"'));
  assert.ok(initial.includes('data-diagram="sphere-plane-sections"'));
  assert.equal(initial.includes("NaN"), false);
  assert.equal(initial.includes("<image"), false);
  const camera = Camera.from({
    kind: "orthographic",
    position: new Vec3(-7, 4, 9),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    aspect: 900 / 560,
    halfHeight: 4,
    near: 0.1,
    far: 100,
  });
  const rotated = renderSpherePlaneSectionsSvg(camera, 900, 560);
  assert.notEqual(rotated, initial);
  assert.equal(rotated.includes("NaN"), false);
  assert.ok(rotated.includes('data-label="height"'));
});
