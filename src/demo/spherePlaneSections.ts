import { Camera } from "../camera/camera.js";
import { Scene } from "../core/scene.js";
import { SvgRenderer } from "../core/svgRenderer.js";
import {
  circleToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "../curves/builders.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import { Vec3 } from "../math/vec3.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { piecesToSvg, type SvgStyle } from "../svg/svgWriter.js";
import type { DemoCase } from "./types.js";

/** Exact coordinates for the sphere / two-plane examination diagram (Y is up). */
export function spherePlaneSectionsGeometry() {
  const a = Math.sqrt(6) / 2;
  const b = 1 / Math.sqrt(2);
  const O = Vec3.zero();
  const A = new Vec3(a, a, 0);
  const Q = new Vec3(a, a, 1);
  const P = new Vec3(0, 0, 2);
  const R = new Vec3(a - b, a + b, 0);
  const H = new Vec3(a, 0, 0);
  const normalBeta = new Vec3(b, b, 0);
  const sphere = new Sphere("sphere", O, 2);
  const alpha = new PlaneRect(
    "alpha",
    O,
    new Vec3(0, 1, 0),
    new Vec3(1, 0, 0),
    6,
    6,
  );
  const beta = new PlaneRect("beta", A, normalBeta, new Vec3(0, 0, 1), 6, 6);
  return { sphere, alpha, beta, O, A, P, Q, R, H, normalBeta };
}

const geometry = spherePlaneSectionsGeometry();

export const SPHERE_PLANE_SECTIONS_STYLE: Partial<SvgStyle> = {
  strokeVisible: "#555",
  strokeHidden: "#777",
  strokeWidthVisible: 1.5,
  strokeWidthHidden: 1.1,
  dashArrayHidden: "3 3",
  opacityHidden: 0.7,
};

// The analytic sphere-plane section: its center is the sphere center's
// orthogonal projection onto the plane, and r² = R² − distance².
function sectionCircle(sphere: Sphere, plane: PlaneRect): CubicBezier3[] {
  const distance = Vec3.dot(
    Vec3.sub(plane.center, sphere.center),
    plane.normal,
  );
  const center = Vec3.add(
    sphere.center,
    Vec3.mulScalar(plane.normal, distance),
  );
  return circleToCubics3({
    center,
    normal: plane.normal,
    radius: Math.sqrt(sphere.radius ** 2 - distance ** 2),
    maxSegmentAngleRad: Math.PI / 8,
  });
}

export function spherePlaneSectionCurves(): {
  C1: CubicBezier3[];
  C2: CubicBezier3[];
} {
  return {
    C1: sectionCircle(geometry.sphere, geometry.alpha),
    C2: sectionCircle(geometry.sphere, geometry.beta),
  };
}

const sections = spherePlaneSectionCurves();

export function buildSpherePlaneSectionsDemo(
  width: number,
  height: number,
): DemoCase {
  return {
    name: "Sphere and two plane sections",
    width,
    height,
    camera: Camera.from({
      kind: "orthographic",
      // Equal foreshortening of X, Y and Z: azimuth 45°, elevation 35.264°.
      position: new Vec3(6, 7.2, 6),
      target: new Vec3(0, 1.2, 0),
      up: new Vec3(0, 1, 0),
      halfHeight: 3.45 * Math.max(1, (height * 1.1) / width),
      aspect: width / height,
      near: 0.1,
      far: 100,
    }),
    // The planes are transparent diagram guides. Only the sphere determines
    // front/back visibility and optional lighting.
    primitives: [geometry.sphere],
    includeIntersections: false,
    curves: ({ camera }) => [
      ...sphereSilhouetteToCubics3({
        center: geometry.O,
        radius: 2,
        cameraPos: camera.position,
        viewDirection:
          camera.kind === "orthographic" ? camera.forward : undefined,
      }),
      ...sections.C2,
    ],
  };
}

type Point2 = { x: number; y: number };

/**
 * A stacked fraction with a square root on top (√6 over 2), centred on
 * (x, y). The radical gets its bar over the radicand, as typeset in exams.
 */
function rootFraction(
  radicand: string,
  denominator: string,
  x: number,
  y: number,
  size: number,
): string {
  const n = (v: number) => v.toFixed(2);
  const signWidth = 0.6 * size;
  const radicandWidth = 0.55 * size * radicand.length;
  const left = x - (signWidth + radicandWidth) / 2;
  const top = y - 0.24 * size; // numerator baseline
  const bottom = y + 0.92 * size; // denominator baseline
  const half = (signWidth + radicandWidth) / 2 + 0.12 * size;
  const ink = 'fill="#292929"';
  return (
    `<text x="${n(left)}" y="${n(top)}" text-anchor="start" ${ink}>√</text>` +
    `<text x="${n(left + signWidth)}" y="${n(top)}" text-anchor="start" ${ink}>${radicand}</text>` +
    `<path d="M ${n(left + 0.5 * size)} ${n(top - 0.8 * size)} H ${n(left + signWidth + radicandWidth + 0.04 * size)}" fill="none" stroke="#292929" stroke-width="${n(Math.max(0.8, size * 0.055))}"/>` +
    `<path d="M ${n(x - half)} ${n(y)} H ${n(x + half)}" fill="none" stroke="#292929" stroke-width="${n(Math.max(0.8, size * 0.06))}"/>` +
    `<text x="${n(x)}" y="${n(bottom)}" text-anchor="middle" ${ink}>${denominator}</text>`
  );
}

/**
 * A length as exam figures mark it: a dashed arc from end to end that bulges
 * to one side and breaks in the middle, where the value goes. `side` picks
 * the bulge direction: +1 turns a → b by +90° in SVG coordinates (y down).
 */
function lengthArc(
  a: Point2,
  b: Point2,
  side: 1 | -1,
  labelHalfSize: { across: number; along: number },
  fontSize: number,
): { path: string; apex: Point2 } {
  const n = (v: number) => v.toFixed(2);
  const chord = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const d = { x: (b.x - a.x) / chord, y: (b.y - a.y) / chord };
  const normal = { x: d.y * side, y: -d.x * side };
  const bulge = Math.max(
    Math.min(36, Math.max(8, chord * 0.2)),
    labelHalfSize.across + fontSize * 0.4,
  );
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const c = { x: mid.x + normal.x * bulge * 2, y: mid.y + normal.y * bulge * 2 };
  const at = (t: number): Point2 => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
  });
  // Through its middle the curve moves `chord` pixels per unit t.
  const dt = Math.min(0.45, (labelHalfSize.along + fontSize * 0.3) / chord);
  const [t0, t1] = [0.5 - dt, 0.5 + dt];
  const c0 = { x: a.x + (c.x - a.x) * t0, y: a.y + (c.y - a.y) * t0 };
  const c1 = { x: c.x + (b.x - c.x) * t1, y: c.y + (b.y - c.y) * t1 };
  const e0 = at(t0);
  const s1 = at(t1);
  return {
    path:
      `M ${n(a.x)} ${n(a.y)} Q ${n(c0.x)} ${n(c0.y)} ${n(e0.x)} ${n(e0.y)} ` +
      `M ${n(s1.x)} ${n(s1.y)} Q ${n(c1.x)} ${n(c1.y)} ${n(b.x)} ${n(b.y)}`,
    apex: at(0.5),
  };
}

function svgChildren(svg: string): string {
  return svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
}

function lineLayer(
  camera: Camera,
  width: number,
  height: number,
  curves: CubicBezier3[],
  color: string,
  strokeWidth: number,
  dashed = false,
): string {
  return svgChildren(
    piecesToSvg(
      curves.map((bez) => ({ bez, visible: !dashed })),
      camera,
      {
        width,
        height,
        background: false,
        style: {
          strokeVisible: color,
          strokeHidden: color,
          strokeWidthVisible: strokeWidth,
          strokeWidthHidden: strokeWidth,
          dashArrayHidden: "3 3",
          opacityHidden: 0.8,
        },
      },
    ),
  );
}

/** SVG children; every guide and label anchor follows the current 3D camera. */
export function renderSpherePlaneSectionsAnnotations(
  camera: Camera,
  width: number,
  height: number,
): string {
  const { O, A, P, Q, R, H } = geometry;
  const d = Math.sqrt(6);
  // Finite guide patches lie on the true planes and share their actual
  // intersection x=√6, y=0; their framing follows the examination illustration.
  const E0 = new Vec3(d, 0, 2.3);
  const E1 = new Vec3(d, 0, -2.3);
  const alpha0 = new Vec3(-2.6, 0, 2.3);
  const alpha1 = new Vec3(-2.6, 0, -2.3);
  const beta0 = new Vec3(-0.8, d + 0.8, 2.3);
  const beta1 = new Vec3(-0.8, d + 0.8, -2.3);
  const planeEdges = [
    lineToCubic3(alpha0, E0),
    lineToCubic3(E0, E1),
    lineToCubic3(E1, beta1),
    lineToCubic3(beta1, beta0),
    lineToCubic3(beta0, E0),
    lineToCubic3(alpha1, alpha0),
  ];
  const planeBackEdge = [lineToCubic3(alpha1, E1)];
  const solid = [
    [P, O],
    [P, Q],
    [P, A],
    [P, R],
    [A, Q],
    [A, R],
    [Q, R],
  ].map(([a, b]) => lineToCubic3(a!, b!));
  const E = new Vec3(d, 0, -1.7);
  const guides = [
    [A, H],
    [O, H],
    [H, E],
    [A, E],
  ].map(([a, b]) => lineToCubic3(a!, b!));
  const markerSize = 0.13;
  const aq = new Vec3(0, 0, markerSize);
  const ar = new Vec3(-markerSize / Math.sqrt(2), markerSize / Math.sqrt(2), 0);
  const markerA = [
    Vec3.add(A, aq),
    Vec3.add(Vec3.add(A, aq), ar),
    Vec3.add(A, ar),
  ];
  const markerH = [
    Vec3.add(H, new Vec3(-markerSize, 0, 0)),
    Vec3.add(H, new Vec3(-markerSize, markerSize, 0)),
    Vec3.add(H, new Vec3(0, markerSize, 0)),
  ];
  const markers = [markerA, markerH].flatMap((points) => [
    lineToCubic3(points[0]!, points[1]!),
    lineToCubic3(points[1]!, points[2]!),
  ]);
  const angleArc = circleToCubics3({
    center: E,
    normal: new Vec3(0, 0, 1),
    radius: 0.35,
    startAngleRad: Math.PI,
    endAngleRad: (3 * Math.PI) / 4,
  });
  const angleRadius = [
    lineToCubic3(E, Vec3.add(E, new Vec3(-0.9, 0, 0))),
    lineToCubic3(
      E,
      Vec3.add(E, new Vec3(-0.9 / Math.sqrt(2), 0.9 / Math.sqrt(2), 0)),
    ),
  ];

  const project = (p: Vec3) => camera.projectToSvg(p, width, height);
  const fontSize = Math.min(
    23,
    Math.max(13, Math.min(height * 0.036, width * 0.04)),
  );
  const text = (
    label: string,
    p: Vec3,
    dx: number,
    dy: number,
    sub?: string,
  ) => {
    const q = project(p);
    return `<text x="${(q.x + dx).toFixed(3)}" y="${(q.y + dy).toFixed(3)}">${label}${sub ? `<tspan baseline-shift="sub" font-size="70%">${sub}</tspan>` : ""}</text>`;
  };
  // AH = √6/2: a dashed arc beside the dashed perpendicular, the value in its gap.
  const fractionSize = fontSize * 0.78;
  const toA = project(A);
  const toH = project(H);
  const heightMark = lengthArc(
    toA,
    toH,
    // Bulge into triangle AHE, clear of the labels Q and O on the other side.
    toH.y >= toA.y ? 1 : -1,
    { across: fractionSize * 0.75, along: fractionSize * 1.15 },
    fontSize,
  );
  const fraction =
    `<path data-label="height-arc" d="${heightMark.path}" fill="none" stroke="#555" stroke-width="0.9" stroke-dasharray="2.2 2.2"/>` +
    `<g data-label="height" font-size="${fractionSize.toFixed(2)}">${rootFraction("6", "2", heightMark.apex.x, heightMark.apex.y, fractionSize)}</g>`;
  const c1Anchor = new Vec3(1.7, 0, 1);
  const c2Anchor = Vec3.add(
    A,
    new Vec3(0.65 / Math.sqrt(2), -0.65 / Math.sqrt(2), -0.75),
  );
  const leaderStart = project(c2Anchor);
  const leaderEnd = {
    x: leaderStart.x + fontSize * 1.9,
    y: leaderStart.y - fontSize * 0.4,
  };
  const leader = `<path d="M ${leaderStart.x.toFixed(3)} ${leaderStart.y.toFixed(3)} Q ${(leaderStart.x + fontSize).toFixed(3)} ${(leaderStart.y - fontSize).toFixed(3)} ${leaderEnd.x.toFixed(3)} ${leaderEnd.y.toFixed(3)}" fill="none" stroke="#777" stroke-width="1"/>`;
  const alphaLabel = Vec3.add(alpha0, new Vec3(0.35, 0, -0.1));
  const betaLabel = Vec3.add(beta0, new Vec3(0.18, -0.18, -0.12));
  return (
    `<g data-diagram="sphere-plane-sections">` +
    lineLayer(camera, width, height, planeEdges, "#777", 1.35) +
    lineLayer(camera, width, height, planeBackEdge, "#888", 1.15, true) +
    // C1 is a dashed construction circle throughout, as in the source diagram.
    lineLayer(camera, width, height, sections.C1, "#888", 1.1, true) +
    lineLayer(camera, width, height, guides, "#777", 1.1, true) +
    lineLayer(camera, width, height, solid, "#292929", 1.65) +
    lineLayer(camera, width, height, markers, "#666", 1) +
    lineLayer(camera, width, height, angleRadius, "#777", 1, true) +
    lineLayer(camera, width, height, angleArc, "#666", 1) +
    leader +
    `<g fill="#292929" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" paint-order="stroke" stroke="white" stroke-width="3" stroke-linejoin="round">` +
    text("O", O, -3, fontSize + 4) +
    text("P", P, -7, fontSize) +
    text("Q", Q, -fontSize, 4) +
    text("R", R, -5, -8) +
    text("A", A, 7, 9) +
    text("α", alphaLabel, 0, -4) +
    text("β", betaLabel, 3, 15) +
    text("C", c1Anchor, 8, fontSize, "1") +
    `<text x="${(leaderEnd.x + 5).toFixed(3)}" y="${(leaderEnd.y - 10).toFixed(3)}">C<tspan baseline-shift="sub" font-size="70%">2</tspan></text>` +
    text("45°", Vec3.add(E, new Vec3(-0.5, 0.12, 0)), -fontSize * 0.7, -5) +
    fraction +
    `</g></g>`
  );
}

/** Standalone, editable vector SVG using the same geometry as the web example. */
export function renderSpherePlaneSectionsSvg(
  camera: Camera,
  width: number,
  height: number,
): string {
  const demo = buildSpherePlaneSectionsDemo(width, height);
  const renderer = new SvgRenderer({
    width,
    height,
    background: false,
    include: { silhouettes: false, intersections: false },
    hlr: { samples: 192, coarseSamples: 64, refineIters: 22 },
    style: SPHERE_PLANE_SECTIONS_STYLE,
  });
  return renderer
    .render(new Scene(demo.primitives), camera, {
      curves: demo.curves({ camera, primitives: demo.primitives }),
    })
    .replace(
      "</svg>",
      renderSpherePlaneSectionsAnnotations(camera, width, height) + "</svg>",
    );
}
