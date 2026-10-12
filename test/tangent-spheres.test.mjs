import test from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "../dist/math/vec3.js";
import {
  tangentSpheresGeometry,
  buildTangentSpheresDemo,
  renderTangentSpheresSvg,
} from "../dist/demo/tangentSpheres.js";
import {
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
} from "../dist/core/surfaceRenderer.js";
import { bruteSurfaceBuffer } from "./helpers/surface-oracle.mjs";

const near = (actual, expected, eps = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);
const distance = (a, b) => Vec3.len(Vec3.sub(a, b));

test("the four spheres rest on alpha and have the stated external contacts", () => {
  const { S, S1, S2, S3, alpha } = tangentSpheresGeometry();
  near(S.radius, 3);
  near(alpha.center.y, 0);
  near(alpha.normal.y, 1);
  for (const sphere of [S, S1, S2, S3]) {
    near(sphere.center.y, sphere.radius);
    near(
      Vec3.dot(Vec3.sub(sphere.center, alpha.center), alpha.normal),
      sphere.radius,
    );
  }
  for (const sphere of [S1, S2, S3]) {
    near(sphere.radius, 1);
    near(distance(S.center, sphere.center), 4);
  }
  near(distance(S1.center, S2.center), 2);
  near(distance(S2.center, S3.center), 2);
  assert.ok(distance(S1.center, S3.center) > 2, "S1 and S3 stay separate");
});

test("the two vertical guide planes contain their stated sphere centers", () => {
  const { beta, sectionPlane, O1, O2, O3 } = tangentSpheresGeometry();
  for (const [plane, points] of [
    [beta, [O1, O2]],
    [sectionPlane, [O2, O3]],
  ]) {
    near(plane.normal.y, 0);
    near(Vec3.len(plane.normal), 1);
    for (const point of points) {
      const offset = Vec3.sub(point, plane.center);
      near(Vec3.dot(offset, plane.normal), 0);
      assert.ok(Math.abs(Vec3.dot(offset, plane.u)) <= plane.halfWidth + 1e-12);
      assert.ok(
        Math.abs(Vec3.dot(offset, plane.v)) <= plane.halfHeight + 1e-12,
      );
    }
  }
});

test("small and large viewports preserve equal isometric axis foreshortening", () => {
  for (const [width, height] of [
    [360, 280],
    [1400, 900],
  ]) {
    const { camera, primitives, includeIntersections } =
      buildTangentSpheresDemo(width, height);
    assert.equal(camera.kind, "orthographic");
    assert.equal(includeIntersections, false);
    assert.deepEqual(
      primitives.map((p) => p.id),
      ["S", "S1", "S2", "S3"],
    );
    const origin = camera.projectToSvg(Vec3.zero(), width, height);
    const lengths = [
      new Vec3(1, 0, 0),
      new Vec3(0, 1, 0),
      new Vec3(0, 0, 1),
    ].map((axis) => {
      const p = camera.projectToSvg(axis, width, height);
      return Math.hypot(p.x - origin.x, p.y - origin.y);
    });
    assert.ok(lengths[0] > 0);
    near(lengths[1], lengths[0], 1e-10);
    near(lengths[2], lengths[0], 1e-10);
  }
});

test("standalone vector export retains all six labels and finite geometry", () => {
  const width = 700,
    height = 520;
  const { camera } = buildTangentSpheresDemo(width, height);
  const svg = renderTangentSpheresSvg(camera, width, height);
  const labels = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(
    (match) => match[1].replace(/<[^>]*>/g, ""),
  );
  assert.deepEqual(labels, ["S", "S1", "S2", "S3", "α", "β"]);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.endsWith("</svg>"));
  assert.ok(svg.includes('data-diagram="tangent-spheres"'));
  assert.ok(svg.includes("<path"));
  assert.equal(/NaN|Infinity/.test(svg), false);
  assert.equal(/<image\b/.test(svg), false);
});

test("the default shaded view keeps all four owners, including the narrow S1 region", () => {
  const width = 400,
    height = 280;
  const { camera, primitives } = buildTangentSpheresDemo(width, height);
  const buffer = buildSurfaceBuffer(primitives, camera, { width, height });
  const oracle = bruteSurfaceBuffer(primitives, camera, { width, height });
  assert.deepEqual(buffer.primitiveIndices, oracle.primitiveIndices);
  assert.deepEqual(buffer.depth, oracle.depth);
  assert.deepEqual(buffer.normals, oracle.normals);
  const owners = new Set(buffer.primitiveIndices);
  for (let index = 0; index < primitives.length; index++) {
    assert.ok(
      owners.has(index),
      `${primitives[index].id} has a visible surface`,
    );
  }
  const clips = buildSurfaceClipPaths(buffer, { width, height });
  assert.deepEqual(clips.map((clip) => clip.primitiveId).sort(), [
    "S",
    "S1",
    "S2",
    "S3",
  ]);
  for (const clip of clips) {
    assert.ok(clip.path.length > 0, `${clip.primitiveId} has a nonempty clip`);
    assert.equal(/NaN|Infinity/.test(clip.path), false);
  }
});
