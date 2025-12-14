import { Scene } from "../../dist/scene/scene.js";
import { Sphere } from "../../dist/scene/primitives/sphere.js";
import { Cylinder } from "../../dist/scene/primitives/cylinder.js";
import { Cone } from "../../dist/scene/primitives/cone.js";
import { PlaneRect } from "../../dist/scene/primitives/planeRect.js";
import { BoxAabb } from "../../dist/scene/primitives/boxAabb.js";

import { Vec3 } from "../../dist/math/vec3.js";
import type { DemoCase } from "../../dist/demo/types.js";

import { bordersForPrimitives } from "../../dist/demo/borders.js";
import { rimsForPrimitives } from "../../dist/demo/rims.js";
import { piecesToSvg } from "../../dist/svg/svgWriter.js";
import { splitCubicByVisibility, splitCubicByVisibilityWithIgnore } from "../../dist/hlr/splitByVisibility.js";
import {
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  lineToCubic3,
  sphereSilhouetteToCubics3,
} from "../../dist/curves/builders.js";
import { intersectionCurvesToOwnedCubics } from "../../dist/scene/intersections/intersectionCurves.js";

type SvgStyle = {
  strokeVisible: string;
  strokeHidden: string;
  strokeWidthVisible: number;
  strokeWidthHidden: number;
  dashArrayHidden: string;
  opacityHidden: number;
  lineCap: "butt" | "round" | "square";
};

export function renderHighlightSvg(demo: DemoCase, selectedId: string, baseStyle: SvgStyle): string {
  const scene = new Scene(demo.primitives, demo.camera);
  const params = {
    samples: 192,
    refineIters: 22,
    epsVisible: 2e-4,
    cutEps: 1e-6,
    minSegLenSq: 1e-6,
  } as const;

  const selected = demo.primitives.find((p) => p.id === selectedId);
  if (!selected) return emptySvg(demo.width, demo.height);

  const highlightCubics: any[] = [];

  // 1) silhouette (sphere/cylinder/cone)
  if (selected instanceof Sphere) {
    highlightCubics.push(
      ...sphereSilhouetteToCubics3({ cameraPos: demo.camera.position, center: selected.center, radius: selected.radius }),
    );
  }
  if (selected instanceof Cylinder) {
    highlightCubics.push(
      ...cylinderSilhouetteToCubics3({
        cameraPos: demo.camera.position,
        base: selected.base,
        axis: selected.axis,
        height: selected.height,
        radius: selected.radius,
      }),
    );
  }
  if (selected instanceof Cone) {
    highlightCubics.push(
      ...coneSilhouetteToCubics3({
        cameraPos: demo.camera.position,
        apex: selected.apex,
        axis: selected.axis,
        height: selected.height,
        baseRadius: selected.baseRadius,
      }),
    );
  }

  // 2) border (PlaneRect)
  if (selected instanceof PlaneRect) {
    highlightCubics.push(...bordersForPrimitives([selected]));
  }

  // 3) rim (Cylinder/Cone) - green overlay
  if (selected instanceof Cylinder || selected instanceof Cone) {
    highlightCubics.push(...rimsForPrimitives([selected]));
  }

  // 4) cube edges (BoxAabb) - treat as "border/outline"
  if (selected instanceof BoxAabb) {
    highlightCubics.push(...boxEdgesAsCubics(selected.min, selected.max));
  }

  // 5) intersections "attached" to this object (by owned ignorePrimitiveIds)
  const owned = intersectionCurvesToOwnedCubics(scene.primitives, { angularSamples: 160 }) as Array<{
    bez: any;
    ignorePrimitiveIds: readonly string[];
  }>;
  const attached = owned.filter((x) => matchesSelected(selectedId, x.ignorePrimitiveIds));

  const pieces: any[] = [];
  for (const b of highlightCubics) pieces.push(...splitCubicByVisibility(b, scene, params));
  for (const x of attached) pieces.push(...splitCubicByVisibilityWithIgnore(x.bez, scene, params, x.ignorePrimitiveIds));

  const sorted = [...pieces].sort((a, b) => Number(a.visible) - Number(b.visible));
  return piecesToSvg(sorted, demo.camera, {
    width: demo.width,
    height: demo.height,
    background: false,
    style: {
      ...baseStyle,
      strokeVisible: "#00c853",
      strokeHidden: "#00c853",
    },
  });
}

function matchesSelected(selectedId: string, ignoreIds: readonly string[]): boolean {
  for (const id of ignoreIds) {
    if (id === selectedId) return true;
    // cap disks: `${primitiveId}:cap:*`
    if (id.startsWith(`${selectedId}:cap:`)) return true;
  }
  return false;
}

function boxEdgesAsCubics(min: any, max: any) {
  const x0 = min.x, y0 = min.y, z0 = min.z;
  const x1 = max.x, y1 = max.y, z1 = max.z;

  const v000 = new Vec3(x0, y0, z0);
  const v100 = new Vec3(x1, y0, z0);
  const v010 = new Vec3(x0, y1, z0);
  const v110 = new Vec3(x1, y1, z0);
  const v001 = new Vec3(x0, y0, z1);
  const v101 = new Vec3(x1, y0, z1);
  const v011 = new Vec3(x0, y1, z1);
  const v111 = new Vec3(x1, y1, z1);

  const edges: Array<[any, any]> = [
    [v000, v100], [v010, v110], [v001, v101], [v011, v111],
    [v000, v010], [v100, v110], [v001, v011], [v101, v111],
    [v000, v001], [v100, v101], [v010, v011], [v110, v111],
  ];
  return edges.map(([a, b]) => lineToCubic3(a, b));
}

function emptySvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
}


