import {
  bordersForPrimitives,
  BoxAabb,
  Cone,
  coneSilhouetteToCubics3,
  Cylinder,
  cylinderSilhouetteToCubics3,
  intersectionCurvesToOwnedCubics,
  piecesToSvg,
  PlaneRect,
  rimsForPrimitives,
  Scene,
  Sphere,
  sphereSilhouetteToCubics3,
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
  type SvgStyle,
  boxEdgesForPrimitives,
} from "../../dist/index.js";
import type { DemoCase } from "../../dist/demo/types.js";

export function renderHighlightSvg(demo: DemoCase, selectedId: string, baseStyle: SvgStyle): string {
  const scene = new Scene(demo.primitives);
  const rayScene = scene.toRaycastScene(demo.camera);
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
    highlightCubics.push(...boxEdgesForPrimitives([selected]));
  }

  // 5) intersections "attached" to this object (by owned ignorePrimitiveIds)
  const owned = intersectionCurvesToOwnedCubics(scene.primitives, { angularSamples: 160 }) as Array<{
    bez: any;
    ignorePrimitiveIds: readonly string[];
  }>;
  const attached = owned.filter((x) => matchesSelected(selectedId, x.ignorePrimitiveIds));

  const pieces: any[] = [];
  for (const b of highlightCubics) pieces.push(...splitCubicByVisibility(b, rayScene, params));
  for (const x of attached) pieces.push(...splitCubicByVisibilityWithIgnore(x.bez, rayScene, params, x.ignorePrimitiveIds));

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

function emptySvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
}


