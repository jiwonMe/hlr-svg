import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as nodeModule from "node:module";

// The editor is TypeScript; Node 22.18+ can import it with types stripped.
const supported =
  typeof nodeModule.registerHooks === "function" &&
  Boolean(process.features?.typescript);
const skip = supported
  ? false
  : "needs a Node that strips TypeScript types (22.18+)";
if (supported) await import("./helpers/editor-loader.mjs");
const load = async (...paths) =>
  supported
    ? Object.assign({}, ...(await Promise.all(paths.map((p) => import(p)))))
    : {};

const {
  buildScene,
  annotationSvg,
  layoutLabels,
  editorReducer,
  copyClosure,
  toolAction,
  TEMPLATES,
  resolvePoints,
  formatLength,
  generateCode,
  parseClipboard,
  clipboardText,
  rotatePatches,
  scalePatches,
  transformTargets,
  pivotOf,
  axisAngleMatrix,
  createObject,
  placePoint,
  canMerge,
  constraintName,
  anchorsOf,
  placementSnap,
  dragSnap,
  dragTargets,
} = await load(
  "../web/src/editor/build.ts",
  "../web/src/editor/anchors.ts",
  "../web/src/editor/snap.ts",
  "../web/src/editor/state.ts",
  "../web/src/editor/tools.ts",
  "../web/src/editor/templates.ts",
  "../web/src/editor/resolve.ts",
  "../web/src/editor/labels.ts",
  "../web/src/editor/codegen.ts",
  "../web/src/editor/exporters.ts",
  "../web/src/editor/transform.ts",
  "../web/src/editor/math.ts",
  "../web/src/editor/model.ts",
);
const { Camera, Csg, OrientedBox, Vec3 } = await import("../dist/index.js");
const { Scene: RaycastScene } = await import("../dist/scene/scene.js");

const template = (id) => TEMPLATES.find((t) => t.id === id).create();
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);
const nearPoint = (p, q, eps = 1e-9) => p.forEach((v, i) => near(v, q[i], eps));
const start = (doc) => ({ doc, selection: [], past: [], future: [] });

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(7, 6, 9),
  target: new Vec3(0, 1, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 5,
  aspect: 1.5,
  near: 0.05,
  far: 1000,
});

test("every template builds and its exported code runs against the library", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "hlr-editor-"));
  const library = pathToFileURL(join(process.cwd(), "dist/index.js")).href;
  for (const { id } of TEMPLATES) {
    const doc = template(id);
    const scene = buildScene(doc);
    for (const [pointId, p] of scene.points)
      assert.ok(p.every(Number.isFinite), `${id}: ${pointId}`);
    const code = generateCode(doc, scene, camera, 480, 320)
      .replace('from "hlr"', `from ${JSON.stringify(library)}`)
      .replace("console.log(svg);", "export default svg;");
    const file = join(dir, `${id}.mjs`);
    writeFileSync(file, code);
    const { default: svg } = await import(pathToFileURL(file).href);
    assert.match(svg, /^<svg/, id);
    if (doc.objects.length)
      assert.ok((svg.match(/<path /g) ?? []).length > 0, `${id} draws lines`);
  }
});

test("a boolean draws as one solid and its operands only as pick targets", { skip }, () => {
  const scene = buildScene(template("drilled-sphere"));
  assert.equal(scene.primitives.length, 1);
  assert.ok(scene.primitives[0] instanceof Csg);
  assert.deepEqual([...scene.consumed].sort(), ["ball", "drill"]);
  assert.deepEqual(
    scene.pickables.map((p) => `${p.objectId}:${p.layer}`).sort(),
    ["ball:2", "drill:2", "drilled:0"],
  );
  // Framing follows the result: A − B keeps A's extent.
  const b = scene.sceneBounds;
  nearPoint(b.min, [-1.6, 0, -1.6]);
  nearPoint(b.max, [1.6, 3.2, 1.6]);
});

test("turned boxes become oriented boxes instead of meshes", { skip }, () => {
  const box = { ...createObject([], "box"), rotation: [0, 30, 0] };
  const scene = buildScene({ objects: [box] });
  assert.ok(scene.primitives[0] instanceof OrientedBox);
  assert.equal(scene.built[0].note, undefined);
});

test("clear planes draw their outline, sections and where planes meet", { skip }, () => {
  const scene = buildScene(template("sphere-two-planes"));
  assert.deepEqual(
    scene.clear.map((c) => c.objectId),
    ["beta"],
  );
  assert.ok(!scene.primitives.some((p) => p.id === "beta"), "β hides nothing");
  assert.equal(scene.curves.filter(Boolean).length >= 4, true);
  const mid = (bez) => [
    (bez.p0.x + 3 * bez.p1.x + 3 * bez.p2.x + bez.p3.x) / 8,
    (bez.p0.y + 3 * bez.p1.y + 3 * bez.p2.y + bez.p3.y) / 8,
    (bez.p0.z + 3 * bez.p1.z + 3 * bez.p2.z + bez.p3.z) / 8,
  ];
  const great = scene.sections.filter((s) => {
    const [x, y, z] = mid(s.bez);
    return Math.abs(z) < 1e-6 && Math.abs(Math.hypot(x, y - 1) - 2) < 1e-2;
  });
  assert.ok(great.length > 0, "β cuts S in a great circle");
  const meet = scene.sections.find(
    (s) =>
      s.ignorePrimitiveIds.includes("alpha") &&
      s.ignorePrimitiveIds.includes("beta"),
  );
  assert.ok(meet, "α and β meet in a line");
  for (const p of [meet.bez.p0, meet.bez.p3]) {
    near(p.y, 0, 1e-9);
    near(p.z, 0, 1e-9);
    near(Math.abs(p.x), 3, 1e-9);
  }
});

test("constructed points follow the objects they are built on", { skip }, () => {
  const doc = template("tetrahedron");
  let points = resolvePoints(doc.objects);
  nearPoint(points.get("H"), [0, 0, 0]);
  nearPoint(points.get("M"), [0, 0, Math.sqrt(3) / 2]);
  const moved = doc.objects.map((o) =>
    o.id === "D" ? { ...o, position: [0.5, 2, -0.25] } : o,
  );
  points = resolvePoints(moved);
  nearPoint(points.get("H"), [0.5, 0, -0.25]);
  const two = template("sphere-two-planes");
  nearPoint(resolvePoints(two.objects).get("A"), [Math.sqrt(3), 0, 0], 1e-12);
});

test("tools act on the selection and refuse what does not fit", { skip }, () => {
  const doc = template("tetrahedron");
  const ctx = (selection) => ({ objects: doc.objects, selection, dropAt: [0, 0, 0] });
  const mid = toolAction("midpoint", ctx(["B", "C"]));
  assert.equal(mid.type, "add");
  assert.deepEqual(mid.objects[0].constraint, { type: "midpoint", a: "B", b: "C" });
  assert.equal(mid.objects[0].label, "N", "M is taken, so the next letter");
  assert.equal(toolAction("midpoint", ctx(["B"])), null);
  assert.equal(toolAction("union", ctx(["B", "C"])), null, "points are not solids");
  const angle = toolAction("angle", ctx(["DM", "MH"]));
  assert.equal(angle.objects[0].vertex, "M");
  const measure = toolAction("measure", ctx(["D", "H"]));
  assert.equal(measure.objects[0].label, "√6");

  // A segment parallel to a plane never meets it.
  const flat = [
    { ...createObject([], "plane"), id: "p" },
    { ...createObject([], "point", [0, 1, 0]), id: "a" },
    { ...createObject([], "point", [2, 1, 0]), id: "b" },
    { id: "ab", kind: "segment", name: "s", label: "", hidden: false, from: "a", to: "b", arrow: false, line: "auto" },
  ];
  const at = (selection) => ({ objects: flat, selection, dropAt: [0, 0, 0] });
  assert.equal(toolAction("intersection", at(["ab", "p"])), null);
  const foot = toolAction("foot", at(["a", "p"]));
  assert.deepEqual(foot.objects[0].position, [0, 0, 0]);
});

test("removing a boolean takes its operands; dissolving gives them back", { skip }, () => {
  const doc = template("drilled-sphere");
  const removed = editorReducer(start(doc), { type: "remove", ids: ["drilled"] });
  assert.equal(removed.doc.objects.length, 0);
  const undone = editorReducer(removed, { type: "undo" });
  assert.equal(undone.doc.objects.length, 3);
  const dissolved = editorReducer(start(doc), { type: "dissolve", id: "drilled" });
  assert.deepEqual(dissolved.doc.objects.map((o) => o.id), ["ball", "drill"]);
  assert.deepEqual(dissolved.selection, ["ball", "drill"]);
  // Removing an operand removes the boolean that uses it, not its partner.
  const cut = editorReducer(start(doc), { type: "remove", ids: ["drill"] });
  assert.deepEqual(cut.doc.objects.map((o) => o.id), ["ball"]);
});

test("copies get fresh ids and letters, and rules that stay behind are let go", { skip }, () => {
  const doc = template("tetrahedron");
  const copied = editorReducer(start(doc), { type: "duplicate", ids: ["DM"] });
  const made = copied.doc.objects.slice(doc.objects.length);
  assert.deepEqual(made.map((o) => o.kind).sort(), ["point", "point", "segment"]);
  const segment = made.find((o) => o.kind === "segment");
  const ends = made.filter((o) => o.kind === "point");
  assert.deepEqual([segment.from, segment.to].sort(), ends.map((o) => o.id).sort());
  // M was the midpoint of A and B, which were not copied: the copy is free.
  const mCopy = ends.find((o) => o.position[2] > 1);
  assert.equal(mCopy.constraint, undefined);
  nearPoint(mCopy.position, [0.5, 0, Math.sqrt(3) / 2 + 0.5]);
  assert.ok(!doc.objects.some((o) => o.label === mCopy.label), "a new letter");
  assert.deepEqual(copied.selection, [segment.id]);

  const booleans = editorReducer(start(template("drilled-sphere")), {
    type: "duplicate",
    ids: ["drilled"],
  });
  const copy = booleans.doc.objects.find(
    (o) => o.kind === "boolean" && o.id !== "drilled",
  );
  assert.ok(copy && copy.a !== "ball" && copy.b !== "drill");
  assert.deepEqual(booleans.selection, [copy.id]);
});

test("the clipboard round-trips through JSON and frees outside rules", { skip }, () => {
  const doc = template("tetrahedron");
  const text = clipboardText(copyClosure(doc.objects, ["DM"]), ["DM"]);
  const pasted = parseClipboard(text);
  assert.equal(pasted.objects.length, 3);
  const state = editorReducer(start(doc), { type: "paste", ...pasted });
  const made = state.doc.objects.slice(doc.objects.length);
  assert.ok(
    made.every((o) => o.kind !== "point" || !o.constraint),
    "M's rule stayed behind",
  );
  assert.deepEqual(
    state.selection,
    made.filter((o) => o.kind === "segment").map((o) => o.id),
  );
  assert.equal(parseClipboard("not json"), null);
  assert.equal(parseClipboard(JSON.stringify({ type: "other", objects: [] })), null);
});

test("group transforms turn and scale shapes about a shared pivot", { skip }, () => {
  const a = { ...createObject([], "sphere"), id: "a", position: [1, 0, 0] };
  const b = { ...createObject([a], "cylinder"), id: "b", position: [-1, 0, 0] };
  const objects = [a, b];
  const scene = buildScene({ objects });
  const targets = transformTargets(objects, ["a", "b"]);
  const pivot = pivotOf(objects, ["a", "b"], scene, targets);
  nearPoint(pivot, [0, 0, 0]);
  const turned = rotatePatches(targets, pivot, axisAngleMatrix([0, 1, 0], 90));
  nearPoint(turned[0].patch.position, [0, 0, -1]);
  nearPoint(turned[1].patch.position, [0, 0, 1]);
  near(turned[1].patch.rotation[1], 90);
  const grown = scalePatches(targets, pivot, 2);
  nearPoint(grown[0].patch.position, [2, 0, 0]);
  near(grown[0].patch.radius, 2);
  near(grown[1].patch.height, 4);
});

test("lengths read like exam answers", { skip }, () => {
  assert.equal(formatLength(Math.sqrt(6) / 2), "√6/2");
  assert.equal(formatLength(3 * Math.SQRT2), "3√2");
  assert.equal(formatLength(1.5), "3/2");
  assert.equal(formatLength(2), "2");
  assert.equal(formatLength(Math.sqrt(3)), "√3");
  assert.equal(formatLength(Math.PI), "3.14");
});

test("annotations draw angle marks, radicals and dimmed hidden points", { skip }, () => {
  const doc = template("sphere-two-planes");
  const scene = buildScene(doc);
  const occluders = new RaycastScene(scene.primitives, camera, undefined, true);
  const svg = annotationSvg(doc.objects, doc.settings, scene, camera, 600, 400, occluders);
  assert.match(svg, />√</, "the √3 label");
  // Each length gets a dashed arc from end to end, broken in the middle for its label.
  const arcs =
    svg.match(/<path d="M [^"M]+ Q [^"M]+ M [^"M]+ Q [^"M]+" fill="none"[^>]*stroke-dasharray="2.2 2.2"/g) ?? [];
  assert.equal(arcs.length, 2, "broken dashed arcs for OH and HA");
  assert.match(svg, /30°/, "the measured angle");
  const labels = layoutLabels(doc.objects, doc.settings, scene, camera, 600, 400);
  const ids = labels.map((l) => l.id);
  for (const id of ["S", "alpha", "beta", "O", "H", "A", "OAH", "mOH", "mHA"])
    assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes("OHA"), "a right angle has a mark, not a number");
  // O, the centre, sits inside the sphere: its dot is dimmed.
  assert.match(svg, /opacity="0\.45"/);
});

test("points pinned to corners and base centres follow their shape", { skip }, () => {
  const doc = template("cube-section");
  nearPoint(resolvePoints(doc.objects).get("A"), [-1, 2, 1]);
  const wider = doc.objects.map((o) => (o.id === "cube" ? { ...o, size: [4, 2, 2] } : o));
  const points = resolvePoints(wider);
  nearPoint(points.get("A"), [-2, 2, 1]);
  nearPoint(points.get("G"), [2, 0, -1]);

  const cone = { ...createObject([], "cone"), id: "cone", position: [0, 1, 0], height: 2 };
  const turned = {
    ...createObject([], "cylinder"),
    id: "can",
    position: [0, 1, 0],
    rotation: [0, 0, 90],
    height: 2,
  };
  const at = (object, key) => anchorsOf(object).find((a) => a.key === key).position;
  nearPoint(at(cone, "apex"), [0, 2, 0]);
  nearPoint(at(cone, "base"), [0, 0, 0]);
  nearPoint(at(turned, "top"), [-1, 1, 0], 1e-12);
  nearPoint(at(turned, "bottom"), [1, 1, 0], 1e-12);
  const byId = new Map([cone, turned].map((o) => [o.id, o]));
  assert.equal(constraintName({ type: "anchor", of: "cone", key: "base" }, byId), "밑면의 중심");
  assert.equal(constraintName({ type: "anchor", of: "can", key: "top" }, byId), "윗면의 중심");
});

/** A box, a ball, a floor plate and a segment PQ beside a lone point R. */
function snapScene() {
  const box = { ...createObject([], "box"), id: "box", name: "상자", position: [0, 1, 0] };
  const ball = { ...createObject([], "sphere"), id: "ball", name: "구", position: [0, 1, -4] };
  const plate = { ...createObject([], "plane"), id: "plate", name: "판", position: [0, 0, 6] };
  const P = { ...placePoint([], [3, 0, 3]), id: "P", label: "P" };
  const Q = { ...placePoint([], [5, 0, 1]), id: "Q", label: "Q" };
  const R = { ...placePoint([], [7, 0, -1]), id: "R", label: "R" };
  const PQ = { id: "PQ", kind: "segment", name: "선분", label: "", hidden: false, from: "P", to: "Q", arrow: false, line: "auto" };
  const objects = [box, ball, plate, P, Q, R, PQ];
  const view = (snapping = true) => ({
    objects,
    scene: buildScene({ objects }),
    camera,
    width: 600,
    height: 400,
    grid: 0.5,
    snapping,
  });
  const screen = (p) => camera.projectToSvg(new Vec3(...p), 600, 400);
  return { objects, view, screen };
}

test("a placed point lands on what is under the cursor, with its rule", { skip }, () => {
  const { view, screen } = snapScene();
  const corner = placementSnap(view(), screen([1, 2, 1]));
  assert.equal(corner.kind, "anchor");
  assert.deepEqual(corner.constraint, { type: "anchor", of: "box", key: "corner7" });
  assert.equal(corner.label, "꼭짓점 · 상자");

  // Up the visible side of the ball, clear of its centre on screen.
  const side = [0.3, 0.8, 0.5].map((v) => v / Math.hypot(0.3, 0.8, 0.5));
  const front = placementSnap(view(), screen([side[0], 1 + side[1], -4 + side[2]]));
  assert.equal(front.constraint.type, "onSphere");
  assert.equal(front.constraint.sphere, "ball");
  near(front.constraint.azimuth % 5, 0);
  near(Math.hypot(front.position[0], front.position[1] - 1, front.position[2] + 4), 1, 1e-9);

  const floor = placementSnap(view(), screen([6.1, 0, -2.1]));
  assert.equal(floor.kind, "floor");
  nearPoint(floor.position, [6, 0, -2]);

  const third = placementSnap(view(), screen([3 + 2 * 0.34, 0, 3 - 2 * 0.34]));
  assert.equal(third.kind, "segment");
  near(third.constraint.t, 1 / 3);
  assert.match(third.label, /1 : 2$/);

  const middle = placementSnap(view(), screen([4, 0, 2]));
  assert.deepEqual(middle.constraint, { type: "midpoint", a: "P", b: "Q" });
  assert.equal(placementSnap(view(), screen([7, 0, -1])).pointId, "R", "picks R, no new point");

  // ⌥: no rule and no rounding, but still on the surface under the cursor.
  const loose = placementSnap(view(false), screen([1, 2, 1]));
  assert.equal(loose.kind, "free");
  assert.equal(loose.constraint, undefined);
});

test("a dragged point merges into points and sticks to what it touches", { skip }, () => {
  const { objects, view } = snapScene();
  assert.equal(canMerge(objects, "P", "Q"), false, "PQ would collapse");
  assert.equal(canMerge(objects, "P", "R"), true);
  const targets = dragTargets(objects, "P");
  assert.deepEqual([...targets.mergeable].sort(), ["R"]);
  assert.ok(targets.exclude.has("PQ"), "P cannot land on its own segment");

  const onto = dragSnap(view(), targets, [7, 0, -1], [true, false, true]);
  assert.equal(onto.pointId, "R");
  assert.equal(onto.label, "점 R에 합치기");

  const touching = dragSnap(view(), targets, [1.2, 0.03, 6.8], [true, false, true]);
  assert.equal(touching.constraint.type, "onPlane");
  nearPoint(touching.position, [1.25, 0, 6.75]);

  // Above the plate it only moves on the grid of its drag plane.
  const above = dragSnap(view(), targets, [1.2, 1.3, 6.8], [true, false, true]);
  assert.equal(above.kind, "free");
  nearPoint(above.position, [1, 1.3, 7]);

  const merged = editorReducer(
    { ...start({ ...template("sphere-plane"), objects }), selection: ["P"] },
    { type: "merge", from: "P", into: "R" },
  );
  assert.ok(!merged.doc.objects.some((o) => o.id === "P"));
  assert.equal(merged.doc.objects.find((o) => o.id === "PQ").from, "R");
  assert.deepEqual(merged.selection, ["R"]);
  const refused = editorReducer(start({ ...template("sphere-plane"), objects }), {
    type: "merge",
    from: "P",
    into: "Q",
  });
  assert.equal(refused.doc.objects.length, objects.length);
});
