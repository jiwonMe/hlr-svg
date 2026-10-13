import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import * as dist from "../dist/index.js";
import * as bundle from "../skills/hlr-svg/scripts/hlr.mjs";
import { renderScene } from "../skills/hlr-svg/scripts/render.mjs";

const skillDir = new URL("../skills/hlr-svg/", import.meta.url).pathname;
const cli = join(skillDir, "scripts/render.mjs");

function run(args, input) {
  return spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: "utf8",
  });
}

function pathCounts(svg) {
  const paths = svg.match(/<path [^>]*\/>/g) ?? [];
  const hidden = paths.filter((p) => p.includes("stroke-dasharray")).length;
  return { visible: paths.length - hidden, hidden };
}

function assertSvg(svg, width, height) {
  assert.match(
    svg,
    new RegExp(
      `^<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ),
  );
  assert.match(svg.trimEnd(), /<\/svg>$/);
  for (const n of svg.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? [])
    assert.ok(Number.isFinite(Number(n)), `non-finite number ${n}`);
  assert.ok(!svg.includes("NaN"), "SVG contains NaN");
}

test("skill: SKILL.md has the frontmatter agents need", () => {
  const md = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const front = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(front, "missing frontmatter");
  assert.match(front[1], /^name: hlr-svg$/m);
  const description = front[1].match(/^description: (.+)$/m)?.[1] ?? "";
  assert.ok(description.length > 100 && description.length <= 1024);
  for (const ref of md.match(/`(references|examples|scripts)\/[^`]+`/g) ?? [])
    assert.doesNotThrow(
      () => readFileSync(join(skillDir, ref.slice(1, -1))),
      `${ref} named in SKILL.md does not exist`,
    );
});

test("skill: the bundled library matches the built library", () => {
  assert.deepEqual(Object.keys(bundle).sort(), Object.keys(dist).sort());
  assert.doesNotMatch(
    readFileSync(join(skillDir, "scripts/hlr.mjs"), "utf8"),
    /^import |\brequire\(/m,
    "the bundle must not import anything",
  );

  const draw = (lib) => {
    const scene = new lib.Scene([
      new lib.Sphere("s", new lib.Vec3(0, 0, 0), 1),
      new lib.Cylinder(
        "c",
        new lib.Vec3(0.4, -1.2, 0),
        new lib.Vec3(0, 1, 0),
        2.4,
        0.4,
      ),
    ]);
    const camera = lib.Camera.from({
      kind: "orthographic",
      position: new lib.Vec3(4, 3, 5),
      target: new lib.Vec3(0, 0, 0),
      up: new lib.Vec3(0, 1, 0),
      halfHeight: 1.6,
      aspect: 4 / 3,
      near: 0.1,
      far: 100,
    });
    return new lib.SvgRenderer({ width: 400, height: 300 }).render(
      scene,
      camera,
    );
  };
  assert.equal(draw(bundle), draw(dist));
});

test("skill: every example renders to an SVG file from the CLI", () => {
  const out = mkdtempSync(join(tmpdir(), "hlr-skill-"));
  try {
    const examples = readdirSync(join(skillDir, "examples")).filter((f) =>
      f.endsWith(".json"),
    );
    assert.ok(examples.length >= 5);
    for (const name of examples) {
      const file = join(out, name.replace(/\.json$/, ".svg"));
      const result = run([join(skillDir, "examples", name), "-o", file]);
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      assert.match(result.stderr, /^wrote .*\d+ visible \/ \d+ hidden paths/);
      const spec = JSON.parse(
        readFileSync(join(skillDir, "examples", name), "utf8"),
      );
      const svg = readFileSync(file, "utf8");
      assertSvg(svg, spec.width, spec.height);
      const counts = pathCounts(svg);
      assert.ok(counts.visible > 0, `${name}: no visible lines`);
      assert.ok(counts.hidden > 0, `${name}: no hidden lines`);
      if (spec.title) assert.ok(svg.includes(`<title>`), `${name}: no title`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("skill: every JSON scene in the skill's docs renders", () => {
  const docs = [
    "SKILL.md",
    "README.md",
    ...readdirSync(join(skillDir, "references")).map((f) => `references/${f}`),
  ];
  let count = 0;
  for (const doc of docs) {
    const md = readFileSync(join(skillDir, doc), "utf8");
    for (const [, block] of md.matchAll(/```json\n([\s\S]*?)```/g)) {
      count++;
      const { svg, stats } = renderScene(JSON.parse(block));
      assertSvg(svg, stats.width, stats.height);
      assert.ok(stats.visiblePaths > 0, `${doc}: a scene drew nothing`);
    }
  }
  assert.ok(count >= 7, `expected the docs to hold scenes, found ${count}`);
});

test("skill: the CLI reads stdin and writes stdout", () => {
  const result = run(
    ["-", "--width", "300", "--height", "200", "-q"],
    JSON.stringify({ objects: [{ type: "box", size: [1, 1, 1] }] }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assertSvg(result.stdout, 300, 200);
  // An isometric cube shows 9 edges and hides 3, which meet at one corner.
  const counts = pathCounts(result.stdout);
  assert.ok(counts.visible >= 1 && counts.hidden >= 1);
});

test("skill: invalid scenes fail with the path of the bad field", () => {
  const cases = [
    [{ objects: [{ type: "sphere", radius: -1 }] }, "objects[0].radius"],
    [{ objects: [{ type: "pyramid" }] }, "objects[0].type"],
    [{ objects: [{ type: "box", min: [0, 0, 0] }] }, "objects[0].max"],
    [{ objects: [{ type: "sphere" }], colour: "red" }, "scene.colour"],
    [
      { objects: [{ type: "sphere" }], camera: { projection: "fisheye" } },
      "camera.projection",
    ],
    [
      { objects: [{ type: "sphere" }], circles: [{ center: [0, 0, 0] }] },
      "circles[0].radius",
    ],
    [
      {
        objects: [{ type: "sphere", id: "s" }],
        points: [{ at: [0, 0, 0], on: ["t"] }],
      },
      "points[0].on",
    ],
    [{ objects: [] }, "objects"],
  ];
  for (const [scene, field] of cases) {
    const result = run(["-"], JSON.stringify(scene));
    assert.equal(result.status, 1, JSON.stringify(scene));
    assert.ok(
      result.stderr.startsWith(`error: ${field}:`),
      `expected an error about ${field}, got ${result.stderr}`,
    );
    assert.equal(result.stdout, "");
  }
  assert.equal(run(["-"], "{ nope").status, 1);
  assert.equal(run(["scene.json", "--nope"]).status, 2);
  assert.equal(run([]).status, 2);
  assert.equal(run(["--help"]).status, 0);
});

test("skill: points are hollow when hidden and filled when visible", () => {
  const { svg } = renderScene({
    camera: { view: "front" },
    objects: [{ type: "sphere", id: "ball", radius: 1 }],
    points: [
      { at: [0, 0, 1], label: "near", on: ["ball"] },
      { at: [0, 0, -1], label: "far", on: ["ball"] },
      { at: [0, 0, 0], label: "<O & 'c'>" },
    ],
  });
  const circles = svg.match(/<circle [^>]*\/>/g);
  assert.equal(circles.length, 3);
  assert.match(circles[0], /fill="black"/);
  assert.match(circles[1], /fill="white"/);
  assert.match(circles[2], /fill="white"/);
  assert.ok(svg.includes("&lt;O &amp; &apos;c&apos;&gt;"));
});

test("skill: hiddenLines, background and style options reach the SVG", () => {
  const scene = {
    objects: [
      {
        type: "csg",
        op: "subtract",
        a: { type: "box", size: [2, 1, 2] },
        b: { type: "cylinder", base: [0, -1, 0], height: 2, radius: 0.4 },
      },
    ],
  };
  const plain = renderScene(scene);
  assert.ok(plain.stats.hiddenPaths > 0);

  const clean = renderScene({
    ...scene,
    hiddenLines: false,
    background: false,
    style: { strokeVisible: "#123456", strokeWidthVisible: 2 },
  });
  assert.equal(clean.stats.hiddenPaths, 0);
  assert.equal(clean.stats.visiblePaths, plain.stats.visiblePaths);
  assert.ok(!clean.svg.includes("<rect"));
  assert.match(clean.svg, /stroke="#123456" stroke-width="2"/);

  const tinted = renderScene({ ...scene, background: "#fafaf7" });
  assert.ok(
    tinted.svg.includes('<rect width="100%" height="100%" fill="#fafaf7" />'),
  );
});

test("skill: automatic framing centres the drawing whatever the coordinates", () => {
  // Bounds of the drawn curves, sampled along each cubic (control points can
  // lie outside the curve).
  const bboxOf = (svg) => {
    const xs = [];
    const ys = [];
    for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) {
      const n = d.match(/-?[\d.]+/g).map(Number);
      for (let i = 2; i + 5 < n.length; i += 6) {
        const [x0, y0, x1, y1, x2, y2, x3, y3] = n.slice(i - 2, i + 6);
        for (let t = 0; t <= 1; t += 1 / 32) {
          const u = 1 - t;
          const [a, b, c, e] = [
            u * u * u,
            3 * u * u * t,
            3 * u * t * t,
            t * t * t,
          ];
          xs.push(a * x0 + b * x1 + c * x2 + e * x3);
          ys.push(a * y0 + b * y1 + c * y2 + e * y3);
        }
      }
    }
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  };
  for (const projection of ["orthographic", "perspective"]) {
    const { svg } = renderScene({
      width: 600,
      height: 400,
      camera: { projection, azimuth: 30, elevation: 20 },
      objects: [{ type: "sphere", center: [50, -20, 7], radius: 3 }],
    });
    const [x0, x1, y0, y1] = bboxOf(svg);
    assert.ok(
      Math.abs((x0 + x1) / 2 - 300) < 3,
      `${projection} x ${x0}..${x1}`,
    );
    assert.ok(
      Math.abs((y0 + y1) / 2 - 200) < 3,
      `${projection} y ${y0}..${y1}`,
    );
    assert.ok(x0 > 0 && x1 < 600 && y0 > 0 && y1 < 400);
    assert.ok(y1 - y0 > 400 * 0.8, `${projection} should fill the height`);
  }
});

test("skill: meshes load from OBJ files relative to the scene", () => {
  const dir = mkdtempSync(join(tmpdir(), "hlr-skill-mesh-"));
  try {
    const obj = [
      "v 0 0 0",
      "v 1 0 0",
      "v 0 1 0",
      "v 0 0 1",
      "f 1 3 2",
      "f 1 2 4",
      "f 1 4 3",
      "f 2 3 4",
    ].join("\n");
    writeFileSync(join(dir, "tet.obj"), obj);
    const scene = join(dir, "scene.json");
    writeFileSync(
      scene,
      JSON.stringify({
        camera: { azimuth: 20, elevation: 25 },
        objects: [{ type: "mesh", file: "tet.obj", scale: 2 }],
      }),
    );
    const result = run([scene, "-q"]);
    assert.equal(result.status, 0, result.stderr);
    const counts = pathCounts(result.stdout);
    assert.ok(counts.visible > 0 && counts.hidden > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
