import test from "node:test";
import assert from "node:assert/strict";

import { Camera } from "../dist/camera/camera.js";
import {
  renderSceneToSnapshot,
  snapshotToSvg,
} from "../dist/core/renderSnapshot.js";
import { lineToCubic3 } from "../dist/curves/builders.js";
import { Scene as CoreScene } from "../dist/core/scene.js";
import { SvgRenderer } from "../dist/core/svgRenderer.js";
import { splitCubicByVisibility } from "../dist/hlr/splitByVisibility.js";
import { parseObj } from "../dist/io/obj.js";
import { parseStl } from "../dist/io/stl.js";
import { Vec3 } from "../dist/math/vec3.js";
import { Scene as RayScene } from "../dist/scene/scene.js";
import { BoxAabb } from "../dist/scene/primitives/boxAabb.js";
import { Cone } from "../dist/scene/primitives/cone.js";
import { PlaneRect } from "../dist/scene/primitives/planeRect.js";
import { Sphere } from "../dist/scene/primitives/sphere.js";
import { TriangleMesh } from "../dist/scene/primitives/triangleMesh.js";

const VIS_PARAMS = {
  samples: 96,
  coarseSamples: 0,
  refineIters: 18,
  epsVisible: 1e-6,
  cutEps: 1e-6,
  minSegLenSq: 1e-6,
};

test("parseObj triangulates polygons and splits meshes by o/g blocks", () => {
  const obj = `
mtllib ignored.mtl
o base
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4
g cap
v 0 0 1
v 1 0 1
v 2 0.5 1
v 2 1 1
v 0 1 1
f -5 -4 -3 -2 -1
`.trim();

  const imported = parseObj(obj);

  assert.equal(imported.meshes.length, 2);
  assert.equal(imported.meshes[0].id, "base");
  assert.equal(imported.meshes[0].triangleCount, 2);
  assert.equal(imported.meshes[1].id, "cap");
  assert.equal(imported.meshes[1].triangleCount, 3);
  assert.ok(imported.warnings.some((warning) => warning.includes("mtllib")));
  assert.equal(imported.bounds.max.z, 1);
});

test("parseStl welds duplicate vertices for ascii and binary STL", () => {
  const ascii = `
solid square
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
endsolid square
`.trim();

  const asciiImported = parseStl(ascii);
  assert.equal(asciiImported.meshes.length, 1);
  assert.equal(asciiImported.meshes[0].triangleCount, 2);
  assert.equal(asciiImported.meshes[0].vertexCount, 4);

  const binaryImported = parseStl(buildBinarySquareStl());
  assert.equal(binaryImported.meshes.length, 1);
  assert.equal(binaryImported.meshes[0].triangleCount, 2);
  assert.equal(binaryImported.meshes[0].vertexCount, 4);
});

test("TriangleMesh exposes camera-dependent silhouette edges", () => {
  const mesh = createCubeMesh();
  const frontCamera = createCamera(new Vec3(0, 0, 5));
  const sideCamera = createCamera(new Vec3(5, 0, 0));

  const frontSilhouettes = mesh
    .featureEdges(frontCamera, { creaseAngleDeg: 120 })
    .filter((edge) => edge.kind === "silhouette")
    .map(edgeKey)
    .sort();
  const sideSilhouettes = mesh
    .featureEdges(sideCamera, { creaseAngleDeg: 120 })
    .filter((edge) => edge.kind === "silhouette")
    .map(edgeKey)
    .sort();

  assert.equal(frontSilhouettes.length, 4);
  assert.equal(sideSilhouettes.length, 4);
  assert.notDeepEqual(frontSilhouettes, sideSilhouettes);
});

test("TriangleMesh BVH hits match brute-force triangle tests", () => {
  const mesh = createCubeMesh();
  const rays = [
    {
      origin: new Vec3(0, 0, 5),
      dir: Vec3.normalize(new Vec3(0, 0, -1)),
    },
    {
      origin: new Vec3(3, 0.5, 4),
      dir: Vec3.normalize(new Vec3(-2, -0.2, -3)),
    },
    {
      origin: new Vec3(-2.5, 1.5, 3),
      dir: Vec3.normalize(new Vec3(1.2, -0.6, -2.4)),
    },
    {
      origin: new Vec3(0, 4, 0),
      dir: Vec3.normalize(new Vec3(0, -1, 0)),
    },
  ];

  for (const ray of rays) {
    const bvhHit = mesh.intersect(ray, 0, Number.POSITIVE_INFINITY);
    const bruteHit = bruteForceHit(mesh, ray);
    assert.equal(Boolean(bvhHit), Boolean(bruteHit));
    if (!bvhHit || !bruteHit) continue;
    assert.ok(Math.abs(bvhHit.t - bruteHit.t) < 1e-8);
    assert.ok(Vec3.distanceSq(bvhHit.point, bruteHit.point) < 1e-12);
  }
});

test("mesh HLR hides back edges and renderer emits hidden-line dash styling", () => {
  const mesh = createCubeMesh();
  const camera = createCamera(new Vec3(0, 0, 5));
  const rayScene = new RayScene([mesh], camera);

  const frontEdge = splitCubicByVisibility(
    lineToCubic3(new Vec3(-1, 1, 1), new Vec3(1, 1, 1)),
    rayScene,
    VIS_PARAMS,
  );
  const backEdge = splitCubicByVisibility(
    lineToCubic3(new Vec3(-1, 1, -1), new Vec3(1, 1, -1)),
    rayScene,
    VIS_PARAMS,
  );

  assert.ok(frontEdge.length > 0);
  assert.ok(frontEdge.every((piece) => piece.visible));
  assert.ok(backEdge.length > 0);
  assert.ok(backEdge.every((piece) => !piece.visible));

  const svg = new SvgRenderer({
    width: 240,
    height: 240,
    include: { intersections: false, meshEdges: true },
    mesh: { creaseAngleDeg: 30 },
  }).render(new CoreScene([mesh]), camera);

  assert.match(svg, /stroke-dasharray=/);
  assert.match(svg, /<path /);
});

test("mesh occlusion participates in visibility checks with meshes and analytic primitives", () => {
  const frontCube = createCubeMesh("front");
  const backCube = createCubeMesh("back", new Vec3(0, 0, -3));
  const sphere = new Sphere("sphere", new Vec3(0, 0, -3.5), 1);
  const camera = createCamera(new Vec3(0, 0, 5));

  const meshScene = new RayScene([frontCube, backCube], camera);
  assert.equal(meshScene.visibleAtPoint(new Vec3(0, 0, -2), { eps: 1e-6 }), false);

  const mixedScene = new RayScene([frontCube, sphere], camera);
  assert.equal(mixedScene.visibleAtPoint(new Vec3(0, 0, -2.5), { eps: 1e-6 }), false);
});

test("snapshotToSvg matches SvgRenderer for analytic primitives", () => {
  const scene = new CoreScene([
    new Sphere("sphere", new Vec3(-0.8, 0.1, 0), 1),
    new BoxAabb("box", new Vec3(0.2, -0.8, 0.7), new Vec3(1.4, 0.4, 1.9)),
  ]);
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(3.5, 2.1, 4.8),
    target: new Vec3(0.1, -0.1, 0.4),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: 240 / 180,
    near: 0.1,
    far: 100,
  });
  const opts = {
    width: 240,
    height: 180,
    style: {
      strokeWidthVisible: 1.7,
      strokeWidthHidden: 1.7,
      dashArrayHidden: "5 4",
      opacityHidden: 0.45,
    },
  };

  const snapshotSvg = snapshotToSvg(renderSceneToSnapshot(scene, camera, opts));
  const rendererSvg = new SvgRenderer(opts).render(scene, camera);

  assert.equal(snapshotSvg, rendererSvg);
});

test("snapshotToSvg matches SvgRenderer for intersection rendering", () => {
  const scene = new CoreScene([
    new Cone("cone", new Vec3(0, -1.2, 0), new Vec3(0.1, 1, -0.15), 2.6, 1, "base"),
    new PlaneRect(
      "plane",
      new Vec3(0.15, 0.1, -0.1),
      new Vec3(0, 1, 0.25),
      new Vec3(1, 0, 0),
      2.6,
      1.9,
    ),
  ]);
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(3.8, 2.4, 5.2),
    target: new Vec3(0, 0.1, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: 700 / 520,
    near: 0.1,
    far: 100,
  });
  const opts = {
    width: 700,
    height: 520,
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "4 4",
    },
  };

  const snapshotSvg = snapshotToSvg(renderSceneToSnapshot(scene, camera, opts));
  const rendererSvg = new SvgRenderer(opts).render(scene, camera);

  assert.equal(snapshotSvg, rendererSvg);
});

test("snapshotToSvg matches SvgRenderer for mesh feature edges", () => {
  const mesh = createCubeMesh();
  const scene = new CoreScene([mesh]);
  const camera = createCamera(new Vec3(0, 0, 5));
  const opts = {
    width: 240,
    height: 240,
    include: {
      intersections: false,
      meshEdges: true,
    },
    mesh: {
      creaseAngleDeg: 30,
    },
    style: {
      strokeWidthVisible: 1.8,
      strokeWidthHidden: 1.8,
      dashArrayHidden: "6 6",
      opacityHidden: 0.35,
    },
  };

  const snapshotSvg = snapshotToSvg(renderSceneToSnapshot(scene, camera, opts));
  const rendererSvg = new SvgRenderer(opts).render(scene, camera);

  assert.equal(snapshotSvg, rendererSvg);
});

function createCamera(position) {
  return Camera.from({
    kind: "perspective",
    position,
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: Math.PI / 3,
    aspect: 1,
    near: 0.1,
    far: 100,
  });
}

function createCubeMesh(id = "cube", offset = Vec3.zero()) {
  const points = [
    new Vec3(-1, -1, -1),
    new Vec3(1, -1, -1),
    new Vec3(1, 1, -1),
    new Vec3(-1, 1, -1),
    new Vec3(-1, -1, 1),
    new Vec3(1, -1, 1),
    new Vec3(1, 1, 1),
    new Vec3(-1, 1, 1),
  ].map((point) => Vec3.add(point, offset));

  const triangles = [
    [0, 1, 2],
    [0, 2, 3],
    [4, 6, 5],
    [4, 7, 6],
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 6],
    [1, 6, 2],
    [2, 6, 7],
    [2, 7, 3],
    [4, 0, 3],
    [4, 3, 7],
  ];

  return new TriangleMesh(id, points, triangles);
}

function buildBinarySquareStl() {
  const buffer = new ArrayBuffer(84 + 2 * 50);
  const view = new DataView(buffer);
  view.setUint32(80, 2, true);
  writeBinaryTriangle(view, 84, [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ]);
  writeBinaryTriangle(view, 134, [
    [0, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ]);
  return buffer;
}

function writeBinaryTriangle(view, offset, vertices) {
  const normal = [0, 0, 1];
  for (let i = 0; i < 3; i++) {
    view.setFloat32(offset + i * 4, normal[i], true);
  }
  let cursor = offset + 12;
  for (const vertex of vertices) {
    view.setFloat32(cursor + 0, vertex[0], true);
    view.setFloat32(cursor + 4, vertex[1], true);
    view.setFloat32(cursor + 8, vertex[2], true);
    cursor += 12;
  }
  view.setUint16(offset + 48, 0, true);
}

function edgeKey(edge) {
  const a = pointKey(edge.start);
  const b = pointKey(edge.end);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pointKey(point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}`;
}

function bruteForceHit(mesh, ray) {
  let best = null;
  let bestT = Number.POSITIVE_INFINITY;

  for (const tri of mesh.triangles) {
    const hit = intersectTriangle(
      ray,
      mesh.vertices[tri[0]],
      mesh.vertices[tri[1]],
      mesh.vertices[tri[2]],
      bestT,
    );
    if (!hit) continue;
    best = hit;
    bestT = hit.t;
  }

  return best;
}

function intersectTriangle(ray, a, b, c, tMax) {
  const edge1 = Vec3.sub(b, a);
  const edge2 = Vec3.sub(c, a);
  const p = Vec3.cross(ray.dir, edge2);
  const det = Vec3.dot(edge1, p);
  if (Math.abs(det) <= 1e-9) return null;

  const invDet = 1 / det;
  const tvec = Vec3.sub(ray.origin, a);
  const u = Vec3.dot(tvec, p) * invDet;
  if (u < 0 || u > 1) return null;

  const q = Vec3.cross(tvec, edge1);
  const v = Vec3.dot(ray.dir, q) * invDet;
  if (v < 0 || u + v > 1) return null;

  const t = Vec3.dot(edge2, q) * invDet;
  if (t <= 1e-9 || t > tMax) return null;

  return {
    t,
    point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
  };
}
