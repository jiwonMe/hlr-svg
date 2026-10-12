import { Camera } from "@hlr/camera/camera.js";
import {
  cylinderSilhouetteToCubics3,
  lineToCubic3,
} from "@hlr/curves/builders.js";
import type { DemoCase } from "@hlr/demo/types.js";
import {
  buildSpherePlaneSectionsDemo,
  renderSpherePlaneSectionsAnnotations,
} from "@hlr/demo/spherePlaneSections.js";
import {
  buildTangentSpheresDemo,
  renderTangentSpheresAnnotations,
} from "@hlr/demo/tangentSpheres.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";
import { Scene as RaycastScene } from "@hlr/scene/scene.js";

export type FigureId =
  | "sphere-sections"
  | "tangent-spheres"
  | "coordinate-tetrahedron"
  | "cube-section"
  | "cylinder-section";

/** HLR line work plus camera-following labels, rendered at the displayed size. */
export type ExamFigureModel = {
  demo: DemoCase;
  annotate: (camera: Camera, width: number, height: number) => string;
};

type Point2 = { x: number; y: number };

type Label = {
  text: string;
  at: Point2;
  italic?: boolean;
  sub?: string;
};

const UP = new Vec3(0, 1, 0);

/** Orthographic camera that fits the given points, leaving room for labels. */
function frameOrthographic(opts: {
  points: readonly Vec3[];
  direction: Vec3;
  width: number;
  height: number;
  padding: number;
}): Camera {
  const back = Vec3.normalize(opts.direction);
  const forward = Vec3.mulScalar(back, -1);
  const right = Vec3.normalize(Vec3.cross(forward, UP));
  const screenUp = Vec3.cross(right, forward);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    depth = 0;
  for (const p of opts.points) {
    const x = Vec3.dot(p, right);
    const y = Vec3.dot(p, screenUp);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    depth += Vec3.dot(p, forward) / opts.points.length;
  }
  const target = Vec3.add(
    Vec3.add(
      Vec3.mulScalar(right, (minX + maxX) / 2),
      Vec3.mulScalar(screenUp, (minY + maxY) / 2),
    ),
    Vec3.mulScalar(forward, depth),
  );
  const aspect = opts.width / opts.height;
  // Fixed room for labels on small figures, proportional room on large ones.
  const padding = Math.max(
    opts.padding,
    Math.min(opts.width, opts.height) * 0.11,
  );
  const usableY = Math.max(0.5, 1 - (2 * padding) / opts.height);
  const usableX = Math.max(0.5, 1 - (2 * padding) / opts.width);
  return Camera.from({
    kind: "orthographic",
    position: Vec3.add(target, Vec3.mulScalar(back, 30)),
    target,
    up: UP,
    halfHeight: Math.max(
      (maxY - minY) / 2 / usableY,
      (maxX - minX) / 2 / usableX / aspect,
    ),
    aspect,
    near: 0.1,
    far: 100,
  });
}

function segments(pairs: readonly (readonly [Vec3, Vec3])[]) {
  return pairs.map(([a, b]) => lineToCubic3(a, b));
}

function fontSizeFor(width: number): number {
  return Math.round(Math.min(17, Math.max(13, width * 0.034)));
}

function n(value: number): string {
  return value.toFixed(2);
}

function unit(v: Point2): Point2 {
  const length = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / length, y: v.y / length };
}

/** Moves a label away from a reference point on screen. */
function away(p: Point2, from: Point2, distance: number): Point2 {
  const d = unit({ x: p.x - from.x, y: p.y - from.y });
  return { x: p.x + d.x * distance, y: p.y + d.y * distance };
}

/** Places a label beside a line, on the side facing away from `from`. */
function beside(
  p: Point2,
  lineFrom: Point2,
  from: Point2,
  distance: number,
): Point2 {
  const d = unit({ x: p.x - lineFrom.x, y: p.y - lineFrom.y });
  let normal = { x: -d.y, y: d.x };
  if (normal.x * (from.x - p.x) + normal.y * (from.y - p.y) > 0)
    normal = { x: -normal.x, y: -normal.y };
  return { x: p.x + normal.x * distance, y: p.y + normal.y * distance };
}

function labelLayer(labels: readonly Label[], fontSize: number): string {
  const texts = labels
    .map(
      ({ text, at, italic, sub }) =>
        `<text x="${n(at.x)}" y="${n(at.y)}"${italic ? ' class="fig-var"' : ""}>${text}${
          sub
            ? `<tspan baseline-shift="sub" font-size="68%">${sub}</tspan>`
            : ""
        }</text>`,
    )
    .join("");
  return (
    `<g class="fig-labels" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" ` +
    `fill="#141414" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">` +
    texts +
    `</g>`
  );
}

/** Axis arrowheads fade with the axis end when an occluder hides it. */
function arrowHead(
  tail: Point2,
  tip: Point2,
  size: number,
  visible: boolean,
): string {
  const d = unit({ x: tip.x - tail.x, y: tip.y - tail.y });
  const base = { x: tip.x - d.x * size, y: tip.y - d.y * size };
  const w = size * 0.36;
  return `<path d="M ${n(tip.x)} ${n(tip.y)} L ${n(base.x - d.y * w)} ${n(base.y + d.x * w)} L ${n(base.x + d.y * w)} ${n(base.y - d.x * w)} Z" fill="#141414" stroke="none"${visible ? "" : ' opacity="0.45"'}/>`;
}

function annotatedDemo(
  name: string,
  width: number,
  height: number,
  camera: Camera,
  primitives: readonly Primitive[],
  curves: DemoCase["curves"],
  includeIntersections = false,
): DemoCase {
  return {
    name,
    width,
    height,
    camera,
    primitives,
    includeIntersections,
    curves,
  };
}

// 좌표공간: math (x, y, z) with z up is drawn in the Y-up world as (y, z, x).
const space = (x: number, y: number, z: number) => new Vec3(y, z, x);

function coordinateTetrahedron(width: number, height: number) {
  const O = space(0, 0, 0);
  const A = space(2, 0, 0);
  const B = space(0, 2, 0);
  const C = space(0, 0, 2);
  const H = space(2 / 3, 2 / 3, 2 / 3);
  const axes = {
    x: space(3.15, 0, 0),
    y: space(0, 3.15, 0),
    z: space(0, 0, 3.05),
  };
  const face = new TriangleMesh("plane-abc", [A, B, C], [[0, 1, 2]]);
  const primitives = [face];
  const lines = segments([
    [A, B],
    [B, C],
    [C, A],
    [O, axes.x],
    [O, axes.y],
    [O, axes.z],
    [O, H],
  ]);
  const camera = frameOrthographic({
    points: [O, A, B, C, axes.x, axes.y, axes.z],
    direction: space(1, 0.44, 0.34),
    width,
    height,
    padding: 30,
  });
  return {
    demo: annotatedDemo(
      "Plane ABC and the coordinate axes",
      width,
      height,
      camera,
      primitives,
      () => lines,
    ),
    annotate(camera: Camera, w: number, h: number) {
      const scene = new RaycastScene(primitives, camera, undefined, true);
      const p = (v: Vec3) => camera.projectToSvg(v, w, h);
      const fontSize = fontSizeFor(w);
      const o = p(O);
      const centroid = p(space(2 / 3, 2 / 3, 2 / 3));
      const arrows = (["x", "y", "z"] as const)
        .map((axis) =>
          arrowHead(
            o,
            p(axes[axis]),
            fontSize * 0.62,
            scene.visibleAtPoint(axes[axis]),
          ),
        )
        .join("");
      const gap = fontSize * 0.95;
      return (
        `<g data-figure="coordinate-tetrahedron">` +
        arrows +
        labelLayer(
          [
            { text: "O", at: away(o, centroid, gap) },
            { text: "A", at: beside(p(A), o, centroid, gap) },
            { text: "B", at: beside(p(B), o, centroid, gap) },
            { text: "C", at: beside(p(C), o, centroid, gap) },
            { text: "H", at: away(p(H), o, gap * 0.9) },
            { text: "x", italic: true, at: away(p(axes.x), o, gap) },
            { text: "y", italic: true, at: away(p(axes.y), o, gap) },
            { text: "z", italic: true, at: away(p(axes.z), o, gap) },
          ],
          fontSize,
        ) +
        `</g>`
      );
    },
  };
}

function cubeSection(width: number, height: number) {
  const s = 1;
  const V = {
    A: new Vec3(-s, s, s),
    B: new Vec3(s, s, s),
    C: new Vec3(s, s, -s),
    D: new Vec3(-s, s, -s),
    E: new Vec3(-s, -s, s),
    F: new Vec3(s, -s, s),
    G: new Vec3(s, -s, -s),
    H: new Vec3(-s, -s, -s),
  };
  type Vertex = keyof typeof V;
  const cube = new BoxAabb("cube", new Vec3(-s, -s, -s), new Vec3(s, s, s));
  const primitives = [cube];
  const edges = [
    "AB",
    "BC",
    "CD",
    "DA",
    "EF",
    "FG",
    "GH",
    "HE",
    "AE",
    "BF",
    "CG",
    "DH",
    // 단면 BDE
    "BD",
    "DE",
    "EB",
  ].map((key) => [V[key[0] as Vertex], V[key[1] as Vertex]] as const);
  const lines = segments(edges);
  const camera = frameOrthographic({
    points: Object.values(V),
    direction: new Vec3(0.66, 0.54, 1),
    width,
    height,
    padding: 30,
  });
  return {
    demo: annotatedDemo(
      "Cube ABCD-EFGH and section BDE",
      width,
      height,
      camera,
      primitives,
      () => lines,
    ),
    annotate(camera: Camera, w: number, h: number) {
      const p = (v: Vec3) => camera.projectToSvg(v, w, h);
      const fontSize = fontSizeFor(w);
      const center = p(Vec3.zero());
      return (
        `<g data-figure="cube-section">` +
        labelLayer(
          (Object.keys(V) as Vertex[]).map((key) => ({
            text: key,
            at: away(p(V[key]), center, fontSize * 0.95),
          })),
          fontSize,
        ) +
        `</g>`
      );
    },
  };
}

function cylinderSection(width: number, height: number) {
  const radius = 2;
  const tall = 6;
  const base = Vec3.zero();
  const cylinder = new Cylinder("cylinder", base, UP, tall, radius, "both");
  const alpha = new PlaneRect(
    "alpha",
    new Vec3(0, tall / 2, 0),
    new Vec3(0, 1, 1),
    new Vec3(1, 0, 0),
    3.15,
    3.25,
  );
  const primitives = [cylinder, alpha];
  const rimPoints = [0, tall].flatMap((y) =>
    Array.from({ length: 16 }, (_, i) => {
      const t = (i / 16) * Math.PI * 2;
      return new Vec3(radius * Math.cos(t), y, radius * Math.sin(t));
    }),
  );
  const corner = (su: number, sv: number) =>
    Vec3.add(
      alpha.center,
      Vec3.add(
        Vec3.mulScalar(alpha.u, su * alpha.halfWidth),
        Vec3.mulScalar(alpha.v, sv * alpha.halfHeight),
      ),
    );
  const camera = frameOrthographic({
    points: [
      ...rimPoints,
      corner(-1, -1),
      corner(1, -1),
      corner(1, 1),
      corner(-1, 1),
    ],
    direction: new Vec3(0.74, 0.62, 1),
    width,
    height,
    padding: 22,
  });
  return {
    demo: annotatedDemo(
      "Cylinder cut by a plane at 45 degrees",
      width,
      height,
      camera,
      primitives,
      ({ camera }) =>
        cylinderSilhouetteToCubics3({
          cameraPos: camera.position,
          viewDirection:
            camera.kind === "orthographic" ? camera.forward : undefined,
          base,
          axis: UP,
          height: tall,
          radius,
        }),
      true,
    ),
    annotate(camera: Camera, w: number, h: number) {
      const p = (v: Vec3) => camera.projectToSvg(v, w, h);
      const fontSize = fontSizeFor(w);
      // Inside the plane's front corner, clear of the cylinder (x > radius).
      const anchor = Vec3.add(
        corner(1, -1),
        Vec3.add(Vec3.mulScalar(alpha.u, -0.5), Vec3.mulScalar(alpha.v, 0.55)),
      );
      return (
        `<g data-figure="cylinder-section">` +
        labelLayer(
          [{ text: "α", italic: true, at: p(anchor) }],
          fontSize * 1.05,
        ) +
        `</g>`
      );
    },
  };
}

/**
 * The shared demo annotations set every label upright. Exam typesetting
 * italicises plane, curve and sphere names (α, β, C₁, S) but not points.
 */
function italicizeNames(
  annotate: ExamFigureModel["annotate"],
): ExamFigureModel["annotate"] {
  return (camera, width, height) =>
    annotate(camera, width, height).replace(
      />(α|β|C|S)(?=<)/g,
      '><tspan class="fig-var">$1</tspan>',
    );
}

/** Points spread around a sphere's outline as seen along `direction`. */
function outlinePoints(center: Vec3, radius: number, direction: Vec3) {
  const back = Vec3.normalize(direction);
  const right = Vec3.normalize(Vec3.cross(back, UP));
  const up = Vec3.cross(right, back);
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return Vec3.add(
      center,
      Vec3.add(
        Vec3.mulScalar(right, radius * Math.cos(t)),
        Vec3.mulScalar(up, radius * Math.sin(t)),
      ),
    );
  });
}

function sphereSections(width: number, height: number): ExamFigureModel {
  const demo = buildSpherePlaneSectionsDemo(width, height);
  const direction = Vec3.sub(demo.camera.position, demo.camera.target);
  // The guide patches drawn by the shared annotation (x = √6 is α ∩ β).
  const d = Math.sqrt(6);
  const patches = [
    new Vec3(d, 0, 2.3),
    new Vec3(d, 0, -2.3),
    new Vec3(-2.6, 0, 2.3),
    new Vec3(-2.6, 0, -2.3),
    new Vec3(-0.8, d + 0.8, 2.3),
    new Vec3(-0.8, d + 0.8, -2.3),
  ];
  return {
    demo: {
      ...demo,
      camera: frameOrthographic({
        points: [...patches, ...outlinePoints(Vec3.zero(), 2, direction)],
        direction,
        width,
        height,
        padding: 16,
      }),
    },
    annotate: italicizeNames(renderSpherePlaneSectionsAnnotations),
  };
}

export function buildExamFigure(
  id: FigureId,
  width: number,
  height: number,
): ExamFigureModel {
  switch (id) {
    case "sphere-sections":
      return sphereSections(width, height);
    case "tangent-spheres":
      return {
        demo: buildTangentSpheresDemo(width, height),
        annotate: italicizeNames(renderTangentSpheresAnnotations),
      };
    case "coordinate-tetrahedron":
      return coordinateTetrahedron(width, height);
    case "cube-section":
      return cubeSection(width, height);
    case "cylinder-section":
      return cylinderSection(width, height);
  }
}
