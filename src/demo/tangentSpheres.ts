import { Camera } from "../camera/camera.js";
import { Scene } from "../core/scene.js";
import { SvgRenderer, DEFAULT_HLR_PARAMS } from "../core/svgRenderer.js";
import { lineToCubic3, sphereSilhouetteToCubics3 } from "../curves/builders.js";
import {
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
} from "../hlr/splitByVisibility.js";
import { Vec3 } from "../math/vec3.js";
import { Scene as RaycastScene } from "../scene/scene.js";
import { planeSurfaceCurvesToOwnedCubics } from "../scene/intersections/planeSurfaceCurves.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import { Sphere } from "../scene/primitives/sphere.js";
import { piecesToSvg, type SvgStyle } from "../svg/svgWriter.js";
import type { DemoCase } from "./types.js";

const right = new Vec3(1 / Math.sqrt(2), 0, -1 / Math.sqrt(2));
const back = new Vec3(-1 / Math.sqrt(2), 0, -1 / Math.sqrt(2));
const onFloor = (x: number, depth: number) =>
  Vec3.add(Vec3.mulScalar(right, x), Vec3.mulScalar(back, depth));
const alphaCorners = [
  onFloor(-13.6, -4.3),
  onFloor(4.2, -4.3),
  onFloor(10.1, 6.58),
  onFloor(-7.7, 6.58),
];

/** Four externally tangent spheres, all resting on α: y=0. */
export function tangentSpheresGeometry() {
  const horizontalRadius = Math.sqrt(12);
  const angleStep = 2 * Math.asin(1 / horizontalRadius);
  const middleAngle = (5 * Math.PI) / 6;
  const center = (angle: number) =>
    new Vec3(
      horizontalRadius * Math.cos(angle),
      1,
      horizontalRadius * Math.sin(angle),
    );
  const S = new Sphere("S", new Vec3(0, 3, 0), 3);
  const S1 = new Sphere("S1", center(middleAngle + angleStep), 1);
  const S2 = new Sphere("S2", center(middleAngle), 1);
  const S3 = new Sphere("S3", center(middleAngle - angleStep), 1);
  const O1 = S1.center,
    O2 = S2.center,
    O3 = S3.center;
  const betaDirection = Vec3.normalize(Vec3.sub(O2, O1));
  const normalBeta = Vec3.normalize(
    new Vec3(betaDirection.z, 0, -betaDirection.x),
  );
  const normalSection = Vec3.normalize(
    Vec3.cross(Vec3.sub(O3, O2), new Vec3(0, 1, 0)),
  );
  const alpha = new PlaneRect(
    "alpha",
    Vec3.zero(),
    new Vec3(0, 1, 0),
    new Vec3(1, 0, 0),
    20,
    20,
  );
  const betaFloorAnchor = new Vec3(O2.x, 0, O2.z);
  const betaUpStep = -(betaDirection.x + betaDirection.z) / Math.sqrt(6);
  const betaAnchorUp = -(betaFloorAnchor.x + betaFloorAnchor.z) / Math.sqrt(6);
  const betaAtFloorUp = (up: number) =>
    Vec3.add(
      betaFloorAnchor,
      Vec3.mulScalar(betaDirection, (up - betaAnchorUp) / betaUpStep),
    );
  const betaFront = betaAtFloorUp(-4.3 / Math.sqrt(3));
  const betaRear = betaAtFloorUp(6.58 / Math.sqrt(3));
  const betaHeight = 10.4;
  const beta = new PlaneRect(
    "beta",
    Vec3.add(
      Vec3.lerp(betaFront, betaRear, 0.5),
      new Vec3(0, betaHeight / 2, 0),
    ),
    normalBeta,
    betaDirection,
    Vec3.distance(betaFront, betaRear) / 2,
    betaHeight / 2,
  );
  const sectionPlane = new PlaneRect(
    "section-plane",
    O3,
    normalSection,
    new Vec3(0, 1, 0),
    2,
    2,
  );
  return {
    S,
    S1,
    S2,
    S3,
    O1,
    O2,
    O3,
    alpha,
    beta,
    sectionPlane,
    betaDirection,
    betaFront,
    betaRear,
    betaHeight,
    angleStep,
  };
}

const geometry = tangentSpheresGeometry();
const spheres = [geometry.S, geometry.S1, geometry.S2, geometry.S3];
const primitives = [...spheres, geometry.beta];
const { betaRear, betaHeight } = geometry;

/** Actual β–sphere sections, carrying both surface IDs for self-hit handling. */
export function tangentSpheresSectionCurves() {
  const { S, S1, S2, S3, beta } = tangentSpheresGeometry();
  return planeSurfaceCurvesToOwnedCubics([beta], [S, S1, S2, S3]);
}
const sections = tangentSpheresSectionCurves();

export const TANGENT_SPHERES_STYLE: Partial<SvgStyle> = {
  strokeVisible: "#555",
  strokeHidden: "#888",
  strokeWidthVisible: 1.5,
  strokeWidthHidden: 1,
  dashArrayHidden: "3 3",
  opacityHidden: 0.45,
};

export function buildTangentSpheresDemo(
  width: number,
  height: number,
): DemoCase {
  const target = Vec3.add(Vec3.mulScalar(right, -1.75), new Vec3(0, 6, 0));
  return {
    name: "Three spheres tangent to a sphere",
    width,
    height,
    camera: Camera.from({
      kind: "orthographic",
      position: Vec3.add(target, new Vec3(12, 12, 12)),
      target,
      up: new Vec3(0, 1, 0),
      halfHeight: Math.max(8.15, (12.65 * height) / width),
      aspect: width / height,
      near: 0.1,
      far: 100,
    }),
    primitives,
    // β is an opaque occluder. Its owned section curves are rendered in the
    // annotation layer with their own solid/dashed styles, avoiding duplicates.
    includeIntersections: false,
    curves: ({ camera }) =>
      spheres.flatMap((sphere) =>
        sphereSilhouetteToCubics3({
          center: sphere.center,
          radius: sphere.radius,
          cameraPos: camera.position,
          viewDirection:
            camera.kind === "orthographic" ? camera.forward : undefined,
        }),
      ),
  };
}

function svgChildren(svg: string): string {
  return svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
}

/** Floor guides and owned β sections share the shaded layer's occlusion scene. */
export function renderTangentSpheresAnnotations(
  camera: Camera,
  width: number,
  height: number,
): string {
  const scene = new RaycastScene(primitives, camera, undefined, true);
  const edges = [alphaCorners].flatMap((corners) =>
    corners.map((p, i) => lineToCubic3(p, corners[(i + 1) % corners.length]!)),
  );
  const visibleEdges = edges
    .flatMap((curve) =>
      splitCubicByVisibility(curve, scene, {
        ...DEFAULT_HLR_PARAMS,
        coarseSamples: 64,
      }),
    )
    .filter((piece) => piece.visible);
  const planes = svgChildren(
    piecesToSvg(visibleEdges, camera, {
      width,
      height,
      background: false,
      style: { strokeVisible: "#777", strokeWidthVisible: 1.35 },
    }),
  );
  const sectionSvg = [geometry.S1, geometry.S2]
    .map((sphere) => {
      const pieces = sections
        .filter((section) => section.ignorePrimitiveIds.includes(sphere.id))
        .flatMap((section) =>
          splitCubicByVisibilityWithIgnore(
            section.bez,
            scene,
            { ...DEFAULT_HLR_PARAMS, coarseSamples: 64 },
            section.ignorePrimitiveIds,
          ),
        );
      const paths = svgChildren(
        piecesToSvg(
          [
            ...pieces.filter((p) => !p.visible),
            ...pieces.filter((p) => p.visible),
          ],
          camera,
          {
            width,
            height,
            background: false,
            style: {
              ...TANGENT_SPHERES_STYLE,
              strokeWidthVisible: 1.3,
              strokeWidthHidden: 1,
              opacityHidden: 0.7,
            },
          },
        ),
      );
      return `<g data-section="beta" data-sphere="${sphere.id}">${paths}</g>`;
    })
    .join("");
  const fontSize = Math.min(
    24,
    Math.max(13, Math.min(height * 0.04, width * 0.045)),
  );
  const text = (
    label: string,
    anchor: Vec3,
    dx: number,
    dy: number,
    sub?: string,
  ) => {
    const p = camera.projectToSvg(anchor, width, height);
    return `<text x="${(p.x + dx).toFixed(3)}" y="${(p.y + dy).toFixed(3)}">${label}${sub ? `<tspan baseline-shift="sub" font-size="65%">${sub}</tspan>` : ""}</text>`;
  };
  const leftOf = (sphere: Sphere) =>
    Vec3.sub(sphere.center, Vec3.mulScalar(right, 1.1));
  const s1Label = Vec3.add(leftOf(geometry.S1), new Vec3(0, 1.1, 0));
  const sLabel = Vec3.add(
    geometry.S.center,
    Vec3.add(Vec3.mulScalar(right, 2.1), new Vec3(0, 2.7, 0)),
  );
  const alphaLabel = Vec3.add(
    alphaCorners[0]!,
    Vec3.add(Vec3.mulScalar(right, 1.3), Vec3.mulScalar(back, 0.3)),
  );
  const betaLabel = Vec3.add(
    betaRear,
    Vec3.add(
      Vec3.mulScalar(geometry.betaDirection, 0.75),
      new Vec3(0, betaHeight - 0.8, 0),
    ),
  );
  return (
    `<g data-diagram="tangent-spheres">` +
    planes +
    sectionSvg +
    `<g fill="#333" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" paint-order="stroke" stroke="white" stroke-width="3" stroke-linejoin="round">` +
    text("S", sLabel, 6, 0) +
    text("S", s1Label, -fontSize, -3, "1") +
    text("S", leftOf(geometry.S2), -fontSize, -4, "2") +
    text("S", leftOf(geometry.S3), -fontSize, 5, "3") +
    text("α", alphaLabel, 0, -5) +
    text("β", betaLabel, -8, 0) +
    `</g></g>`
  );
}

/** Standalone vector line drawing; the web viewer adds clipped live lighting. */
export function renderTangentSpheresSvg(
  camera: Camera,
  width: number,
  height: number,
): string {
  const demo = buildTangentSpheresDemo(width, height);
  const renderer = new SvgRenderer({
    width,
    height,
    background: false,
    include: { silhouettes: false, intersections: false },
    hlr: { samples: 192, coarseSamples: 64, refineIters: 22 },
    style: TANGENT_SPHERES_STYLE,
  });
  return renderer
    .render(new Scene(demo.primitives), camera, {
      curves: demo.curves({ camera, primitives: demo.primitives }),
    })
    .replace(
      "</svg>",
      renderTangentSpheresAnnotations(camera, width, height) + "</svg>",
    );
}
