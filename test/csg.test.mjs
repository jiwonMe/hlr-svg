import test from "node:test";
import assert from "node:assert/strict";
import {
  BoxAabb,
  Camera,
  Csg,
  Cylinder,
  OrientedBox,
  PlaneRect,
  Scene,
  Sphere,
  SvgRenderer,
  Vec3,
  csgBoundaryCurves,
  evalCubic3,
  intersectionCurvesToOwnedCubics,
  splitCubicWhere,
  lineToCubic3,
} from "../dist/index.js";
import { Scene as RaycastScene } from "../dist/scene/scene.js";
import { buildSurfaceBuffer } from "../dist/core/surfaceRenderer.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);
const ray = (origin, dir) => ({ origin, dir: Vec3.normalize(dir) });

const sphere = new Sphere("S", Vec3.zero(), 2);
// A vertical hole of radius 0.8 drilled straight through the sphere.
const drill = new Cylinder("drill", new Vec3(0, -3, 0), new Vec3(0, 1, 0), 6, 0.8);
const drilled = new Csg("drilled", "subtract", sphere, drill);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(6, 5, 7),
  target: Vec3.zero(),
  up: new Vec3(0, 1, 0),
  halfHeight: 3,
  aspect: 4 / 3,
  near: 0.1,
  far: 100,
});

test("subtract: a ray down the hole passes through, a ray beside it hits the sphere", () => {
  assert.equal(drilled.intersect(ray(new Vec3(0, 10, 0), new Vec3(0, -1, 0)), 0, Infinity), null);
  const hit = drilled.intersect(ray(new Vec3(1.2, 10, 0), new Vec3(0, -1, 0)), 0, Infinity);
  assert.ok(hit);
  near(hit.point.y, Math.sqrt(4 - 1.44), 1e-9);
  near(hit.normal.y, Math.sqrt(4 - 1.44) / 2, 1e-9);
  assert.equal(hit.primitiveId, "drilled");
});

test("subtract: a slanted ray meets the hole wall with an outward normal", () => {
  // From inside the hole, travelling in +x, the ray reaches the wall at x = 0.8.
  const r = ray(new Vec3(-10, 0, 0), new Vec3(1, 0, 0));
  const hits = [];
  let tMin = 0;
  for (let i = 0; i < 4; i++) {
    const h = drilled.intersect(r, tMin, Infinity);
    if (!h) break;
    hits.push(h);
    tMin = h.t + 1e-9;
  }
  assert.deepEqual(
    hits.map((h) => +h.point.x.toFixed(9)),
    [-2, -0.8, 0.8, 2],
  );
  // Entering the material at x = 0.8 means the wall faces back into the hole.
  near(hits[2].normal.x, -1, 1e-9);
  near(hits[1].normal.x, 1, 1e-9);
});

test("union and intersect clip rays to the combined solid", () => {
  const a = new Sphere("a", new Vec3(-0.6, 0, 0), 1);
  const b = new Sphere("b", new Vec3(0.6, 0, 0), 1);
  const along = ray(new Vec3(-5, 0, 0), new Vec3(1, 0, 0));
  near(new Csg("u", "union", a, b).intersect(along, 0, Infinity).point.x, -1.6);
  near(new Csg("i", "intersect", a, b).intersect(along, 0, Infinity).point.x, -0.4);
  const exit = new Csg("u", "union", a, b).intersect(along, 3.5, Infinity);
  near(exit.point.x, 1.6);
});

test("point classification separates inside, boundary and outside", () => {
  const tol = 1e-6;
  assert.equal(drilled.classify(new Vec3(1.4, 0, 0), tol), -1);
  assert.equal(drilled.classify(new Vec3(0, 0, 0), tol), 1); // in the hole
  assert.equal(drilled.classify(new Vec3(2, 0, 0), tol), 0);
  assert.equal(drilled.classify(new Vec3(0.8, 0, 0), tol), 0); // hole wall
  assert.equal(drilled.classify(new Vec3(0, 0.8, 0.5), tol), 1); // hole, off-centre
});

test("boundary curves keep only pieces on the drilled sphere", () => {
  const curves = csgBoundaryCurves(drilled, camera);
  assert.ok(curves.length > 0);
  const tol = drilled.size() * 3e-3;
  for (const curve of curves)
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      assert.equal(drilled.classify(evalCubic3(curve, t), tol), 0);
  // The hole rims: points at height ±√(4 − 0.64) on radius 0.8 must be covered.
  const rimY = Math.sqrt(4 - 0.64);
  const onRim = curves.some((curve) => {
    const p = evalCubic3(curve, 0.5);
    return (
      Math.abs(Math.abs(p.y) - rimY) < 1e-2 &&
      Math.abs(Math.hypot(p.x, p.z) - 0.8) < 1e-2
    );
  });
  assert.ok(onRim, "hole rims are part of the outline");
});

test("the renderer draws a boolean solid with hidden lines", () => {
  const svg = new SvgRenderer({ width: 480, height: 360 }).render(
    new Scene([drilled]),
    camera,
  );
  const paths = svg.match(/<path /g) ?? [];
  const dashed = svg.match(/stroke-dasharray/g) ?? [];
  assert.ok(paths.length >= 3, `${paths.length} paths`);
  assert.ok(dashed.length >= 1, "the far rim of the hole is hidden");
});

test("raycast scenes and surface buffers accept boolean solids", () => {
  // Looking straight down the hole, its centre is in plain view.
  const top = Camera.from({
    kind: "orthographic",
    position: new Vec3(0, 10, 0),
    target: Vec3.zero(),
    up: new Vec3(0, 0, -1),
    halfHeight: 3,
    aspect: 1,
    near: 0.1,
    far: 100,
  });
  const scene = new RaycastScene([drilled], top);
  assert.equal(scene.visibleAtPoint(new Vec3(0, 0, 0)), true);
  assert.equal(scene.visibleAtPoint(new Vec3(-1.5, -1, 0)), false);
  // From the oblique view, the same centre sits behind material.
  assert.equal(new RaycastScene([drilled], camera).visibleAtPoint(Vec3.zero()), false);
  const buffer = buildSurfaceBuffer([drilled], camera, { width: 40, height: 30 });
  assert.ok(buffer.primitiveIndices.some((index) => index === 0));
});

test("splitCubicWhere returns the parts where the predicate holds", () => {
  const line = lineToCubic3(new Vec3(0, 0, 0), new Vec3(1, 0, 0));
  const pieces = splitCubicWhere(line, (p) => p.x < 0.25 || p.x > 0.75);
  assert.equal(pieces.length, 2);
  near(pieces[0].p3.x, 0.25, 1e-4);
  near(pieces[1].p0.x, 0.75, 1e-4);
});

test("oriented boxes raycast, outline and intersect like axis-aligned ones", () => {
  const turned = new OrientedBox(
    "obb",
    new Vec3(0, 0, 0),
    new Vec3(1, 1, 1),
    new Vec3(Math.SQRT1_2, 0, -Math.SQRT1_2),
    new Vec3(0, 1, 0),
  );
  const hit = turned.intersect(ray(new Vec3(-5, 0, 0), new Vec3(1, 0, 0)), 0, Infinity);
  near(hit.point.x, -Math.SQRT2);
  assert.equal(turned.edges().length, 12);
  const axisAligned = new OrientedBox(
    "aa",
    new Vec3(0, 0, 0),
    new Vec3(1, 1, 1),
    new Vec3(1, 0, 0),
    new Vec3(0, 1, 0),
  );
  const reference = new BoxAabb("ref", new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
  for (const dir of [new Vec3(1, 0.2, 0.1), new Vec3(-0.3, 1, 0.4), new Vec3(0.2, -0.5, -1)]) {
    const r = ray(Vec3.mulScalar(Vec3.normalize(dir), -6), dir);
    near(axisAligned.intersect(r, 0, Infinity).t, reference.intersect(r, 0, Infinity).t, 1e-9);
  }
  // A sphere through a corner meets three faces of the turned box.
  const ball = new Sphere("ball", new Vec3(1.4, 1, 0), 0.8);
  const seams = intersectionCurvesToOwnedCubics([turned, ball], { angularSamples: 96 });
  assert.ok(seams.length > 0);
  for (const { bez, ignorePrimitiveIds } of seams) {
    assert.deepEqual([...ignorePrimitiveIds].sort(), ["ball", "obb"]);
    near(Vec3.distance(evalCubic3(bez, 0.5), ball.center), 0.8, 5e-3);
  }
});

test("a plane cutting a boolean solid keeps only the cut through material", () => {
  const plane = new PlaneRect("cut", Vec3.zero(), new Vec3(0, 1, 0), new Vec3(1, 0, 0), 3, 3);
  const curves = intersectionCurvesToOwnedCubics([drilled, plane], { angularSamples: 128 });
  assert.ok(curves.length > 0);
  for (const { bez, ignorePrimitiveIds } of curves) {
    assert.ok(ignorePrimitiveIds.includes("drilled") && ignorePrimitiveIds.includes("cut"));
    const r = Math.hypot(evalCubic3(bez, 0.5).x, evalCubic3(bez, 0.5).z);
    // Either the outer circle (r = 2) or the hole (r = 0.8), never inside the hole.
    assert.ok(Math.abs(r - 2) < 1e-2 || Math.abs(r - 0.8) < 1e-2, `r = ${r}`);
  }
});

test("owned curves render with their surfaces ignored and invalidate the cache", () => {
  const ball = new Sphere("ball", Vec3.zero(), 2);
  const cut = new PlaneRect("cut", new Vec3(0, 0.5, 0), new Vec3(0, 1, 0), new Vec3(1, 0, 0), 3, 3);
  const renderer = new SvgRenderer({ width: 320, height: 240 });
  const scene = new Scene([ball]);
  const plain = renderer.render(scene, camera);
  const sections = intersectionCurvesToOwnedCubics([cut, ball], { angularSamples: 128 });
  assert.ok(sections.length > 0);
  const withSections = renderer.render(scene, camera, { ownedCurves: sections });
  const count = (svg) => (svg.match(/<path /g) ?? []).length;
  assert.ok(count(withSections) > count(plain), "the section adds paths");
  // The circle at y = 0.5 has a near (visible) and a far (hidden) half.
  assert.ok((withSections.match(/stroke-dasharray/g) ?? []).length > (plain.match(/stroke-dasharray/g) ?? []).length);
  // A cached render without the option must not reuse the sectioned output.
  assert.equal(renderer.render(scene, camera), plain);
});
