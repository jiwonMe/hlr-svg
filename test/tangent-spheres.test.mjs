import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../dist/camera/camera.js";
import { Vec3 } from "../dist/math/vec3.js";
import { evalCubic3 } from "../dist/curves/cubicBezier3.js";
import { Scene as RaycastScene } from "../dist/scene/scene.js";
import {
  tangentSpheresGeometry,
  tangentSpheresSectionCurves,
  buildTangentSpheresDemo,
  renderTangentSpheresSvg,
} from "../dist/demo/tangentSpheres.js";
import {
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
  shadeSurfaceBuffer,
} from "../dist/core/surfaceRenderer.js";
import { bruteSurfaceBuffer } from "./helpers/surface-oracle.mjs";

const near = (actual, expected, eps = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);
const distance = (a, b) => Vec3.len(Vec3.sub(a, b));

function oppositeCamera(camera) {
  const offset = Vec3.sub(camera.position, camera.target);
  return Camera.from({
    kind: "orthographic",
    position: Vec3.add(camera.target, new Vec3(-offset.x, offset.y, -offset.z)),
    target: camera.target,
    up: camera.up,
    halfHeight: camera.halfHeight,
    aspect: camera.aspect,
    near: camera.near,
    far: camera.far,
  });
}

// Independent point-visibility oracle: use public screen rays and intersections.
function visibleByPublicRays(point, primitives, camera) {
  const screen = camera.projectToSvg(point, 700, 520);
  const ray = camera.screenToRay(screen.x, screen.y, 700, 520);
  const pointT =
    Vec3.dot(Vec3.sub(point, ray.origin), ray.dir) / Vec3.lenSq(ray.dir);
  let nearestT = Infinity;
  for (const primitive of primitives) {
    const hit = primitive.intersect(ray, 0, nearestT);
    if (hit) nearestT = hit.t;
  }
  return nearestT >= pointT - 2e-4;
}

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
      ["S", "S1", "S2", "S3", "beta"],
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
  const sectionGroups = [
    ...svg.matchAll(
      /<g data-section="beta" data-sphere="([^"]+)">([\s\S]*?)<\/g>/g,
    ),
  ];
  assert.deepEqual(
    sectionGroups.map((match) => match[1]),
    ["S1", "S2"],
  );
  assert.ok(sectionGroups[0][2].includes('stroke-dasharray="3 3"'));
  const s2Paths = [...sectionGroups[1][2].matchAll(/<path\b[^>]*>/g)];
  assert.ok(s2Paths.some(([path]) => path.includes("stroke-dasharray")));
  assert.ok(s2Paths.some(([path]) => !path.includes("stroke-dasharray")));
});

test("beta sections are great circles of S1 and S2 and miss the other spheres", () => {
  const { S, S1, S2, S3, beta } = tangentSpheresGeometry();
  const sections = tangentSpheresSectionCurves();
  assert.ok(sections.length > 0);
  const owners = new Set();
  for (const { bez, ignorePrimitiveIds } of sections) {
    const sphere = [S1, S2].find((s) => ignorePrimitiveIds.includes(s.id));
    assert.ok(sphere, "only S1 and S2 have beta sections");
    assert.deepEqual(
      [...ignorePrimitiveIds].sort(),
      [sphere.id, "beta"].sort(),
    );
    owners.add(sphere.id);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const point = evalCubic3(bez, t);
      const offset = Vec3.sub(point, beta.center);
      near(Vec3.dot(offset, beta.normal), 0, 1e-10);
      near(distance(point, sphere.center), sphere.radius, 3e-5);
      assert.ok(Math.abs(Vec3.dot(offset, beta.u)) <= beta.halfWidth + 1e-10);
      assert.ok(Math.abs(Vec3.dot(offset, beta.v)) <= beta.halfHeight + 1e-10);
    }
  }
  assert.deepEqual([...owners].sort(), ["S1", "S2"]);
  for (const sphere of [S1, S2]) {
    near(Vec3.dot(Vec3.sub(sphere.center, beta.center), beta.normal), 0);
  }
  for (const sphere of [S, S3]) {
    assert.ok(
      Math.abs(Vec3.dot(Vec3.sub(sphere.center, beta.center), beta.normal)) >
        sphere.radius,
    );
  }
});

test("beta hides a rear surface while retaining front surfaces and owned section visibility", () => {
  const { camera, primitives } = buildTangentSpheresDemo(700, 520);
  const sphere = primitives.find((p) => p.id === "S2");
  const beta = primitives.find((p) => p.id === "beta");
  const spheres = primitives.filter((p) => p.id !== "beta");
  const scene = new RaycastScene(primitives, camera);
  const viewer = Vec3.mulScalar(camera.forward, -1);
  const side = Math.sign(Vec3.dot(viewer, beta.normal));
  const inPlaneTowardViewer = Vec3.normalize(
    Vec3.sub(
      viewer,
      Vec3.mulScalar(beta.normal, Vec3.dot(viewer, beta.normal)),
    ),
  );
  const rearNormal = Vec3.add(
    Vec3.mulScalar(inPlaneTowardViewer, Math.sqrt(1 - 0.25 ** 2)),
    Vec3.mulScalar(beta.normal, -side * 0.25),
  );
  const rear = Vec3.add(sphere.center, rearNormal);
  near(distance(rear, sphere.center), sphere.radius);
  assert.equal(visibleByPublicRays(rear, spheres, camera), true);
  assert.equal(visibleByPublicRays(rear, primitives, camera), false);
  assert.equal(scene.visibleAtPoint(rear), false);

  const front = Vec3.add(sphere.center, viewer);
  assert.equal(visibleByPublicRays(front, spheres, camera), true);
  assert.equal(visibleByPublicRays(front, primitives, camera), true);
  assert.equal(scene.visibleAtPoint(front), true);
  for (const [point, visible] of [
    [Vec3.add(sphere.center, new Vec3(0, 1, 0)), true],
    [Vec3.add(sphere.center, new Vec3(0, -1, 0)), false],
  ]) {
    assert.equal(visibleByPublicRays(point, primitives, camera), visible);
    assert.equal(
      scene.visibleAtPoint(point, { ignorePrimitiveIds: ["beta", "S2"] }),
      visible,
    );
  }
});

test("five-object ownership and clips match public rays from both sides of beta", () => {
  const width = 400,
    height = 280;
  const { camera, primitives } = buildTangentSpheresDemo(width, height);
  assert.equal(primitives.length, 5);
  const spherePrimitives = primitives.filter((p) => p.id !== "beta");
  const betaIndex = primitives.findIndex((p) => p.id === "beta");
  const s1Index = primitives.findIndex((p) => p.id === "S1");
  const s1Counts = [];
  for (const view of [camera, oppositeCamera(camera)]) {
    const buffer = buildSurfaceBuffer(primitives, view, { width, height });
    const oracle = bruteSurfaceBuffer(primitives, view, { width, height });
    assert.deepEqual(buffer.primitiveIndices, oracle.primitiveIndices);
    assert.deepEqual(buffer.depth, oracle.depth);
    assert.deepEqual(buffer.normals, oracle.normals);
    const sphereOnly = bruteSurfaceBuffer(spherePrimitives, view, {
      width,
      height,
    });
    let betaOccludedSmallSphere = 0;
    let s1Visible = 0;
    const visibleIds = new Set();
    for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
      const owner = buffer.primitiveIndices[pixel];
      if (owner >= 0) visibleIds.add(buffer.primitiveIds[owner]);
      if (owner === s1Index) s1Visible++;
      const sphereOwner = sphereOnly.primitiveIndices[pixel];
      if (
        owner === betaIndex &&
        sphereOwner >= 0 &&
        ["S1", "S2"].includes(sphereOnly.primitiveIds[sphereOwner])
      ) {
        betaOccludedSmallSphere++;
        assert.ok(buffer.depth[pixel] < sphereOnly.depth[pixel]);
      }
    }
    assert.ok(
      betaOccludedSmallSphere > 0,
      "beta covers a rear small-sphere surface",
    );
    s1Counts.push(s1Visible);
    const clips = buildSurfaceClipPaths(buffer, { width, height });
    assert.deepEqual(
      clips
        .filter((clip) => clip.path)
        .map((clip) => clip.primitiveId)
        .sort(),
      [...visibleIds].sort(),
    );
    assert.ok(clips.find((clip) => clip.primitiveId === "beta").path);
    for (const clip of clips) {
      assert.equal(/NaN|Infinity/.test(clip.path), false);
    }
  }
  assert.equal(s1Counts[0], 0, "default beta scene covers S1 entirely");
  assert.ok(
    s1Counts[1] > 0,
    "S1 reappears from the other side; its geometry was retained",
  );
});

test("unlit beta stays opaque white without changing other colors or surface ownership", () => {
  const width = 160,
    height = 120;
  const { camera, primitives } = buildTangentSpheresDemo(width, height);
  const buffer = buildSurfaceBuffer(primitives, camera, { width, height });
  const original = {
    owners: buffer.primitiveIndices.slice(),
    depth: buffer.depth.slice(),
    normals: buffer.normals.slice(),
  };
  const betaIndex = buffer.primitiveIds.indexOf("beta");
  assert.ok(buffer.primitiveIndices.includes(betaIndex));
  for (const lightDirection of [new Vec3(1, 2, 3), new Vec3(-1, -2, -3)]) {
    for (const selectedId of [null, "beta", "S2"]) {
      for (const ambient of [0, 0.35, 1]) {
        const options = { lightDirection, selectedId, ambient };
        const lit = shadeSurfaceBuffer(buffer, options);
        const unlit = shadeSurfaceBuffer(buffer, {
          ...options,
          unlitPrimitiveIds: ["beta"],
        });
        for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
          const offset = pixel * 4;
          if (buffer.primitiveIndices[pixel] === betaIndex) {
            assert.deepEqual(
              unlit.subarray(offset, offset + 4),
              new Uint8ClampedArray([255, 255, 255, 255]),
            );
          } else {
            assert.deepEqual(
              unlit.subarray(offset, offset + 4),
              lit.subarray(offset, offset + 4),
            );
          }
        }
        assert.deepEqual(
          shadeSurfaceBuffer(buffer, { ...options, unlitPrimitiveIds: [] }),
          lit,
        );
        assert.deepEqual(
          shadeSurfaceBuffer(buffer, {
            ...options,
            unlitPrimitiveIds: ["missing"],
          }),
          lit,
        );
      }
    }
  }
  assert.deepEqual(buffer.primitiveIndices, original.owners);
  assert.deepEqual(buffer.depth, original.depth);
  assert.deepEqual(buffer.normals, original.normals);
});
