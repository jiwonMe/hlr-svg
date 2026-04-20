import type { Camera } from "../camera/camera.js";
import type { Primitive } from "../scene/primitive.js";
import { Scene } from "./scene.js";
import {
  DEFAULT_HLR_PARAMS,
  DEFAULT_INTERSECTION_PARAMS,
  DEFAULT_MESH_PARAMS,
  type HlrParams,
  type IntersectionParams,
  type MeshRenderParams,
  type RenderInclude,
  type RenderSnapshotOptions,
  renderSceneToSnapshot,
  snapshotToSvg,
} from "./renderSnapshot.js";

export type RenderOptions = RenderSnapshotOptions;

/**
 * three.js style:
 *
 * ```ts
 * const renderer = new SvgRenderer({ width: 800, height: 600 })
 * const svg = renderer.render(scene, camera)
 * ```
 */
export class SvgRenderer {
  private readonly base: Omit<RenderOptions, "curves">;

  constructor(opts: Omit<RenderOptions, "curves">) {
    this.base = opts;
  }

  render(
    scene: Scene,
    camera: Camera,
    opts: Partial<Omit<RenderOptions, "width" | "height">> = {},
  ): string {
    const snapshot = renderSceneToSnapshot(scene, camera, {
      ...this.base,
      ...opts,
      width: this.base.width,
      height: this.base.height,
      style: {
        ...(this.base.style ?? {}),
        ...(opts.style ?? {}),
      },
      include: {
        ...(this.base.include ?? {}),
        ...(opts.include ?? {}),
      },
      hlr: {
        ...(this.base.hlr ?? {}),
        ...(opts.hlr ?? {}),
      },
      intersections: {
        ...(this.base.intersections ?? {}),
        ...(opts.intersections ?? {}),
      },
      mesh: {
        ...(this.base.mesh ?? {}),
        ...(opts.mesh ?? {}),
      },
    });

    return snapshotToSvg(snapshot);
  }
}

export function renderToSvg(
  scene: Scene,
  camera: Camera,
  opts: RenderOptions,
): string {
  const renderer = new SvgRenderer(opts);
  return renderer.render(scene, camera, { curves: opts.curves });
}

export function renderPrimitivesToSvg(
  primitives: readonly Primitive[],
  camera: Camera,
  opts: RenderOptions,
): string {
  return renderToSvg(new Scene(primitives), camera, opts);
}

export {
  DEFAULT_HLR_PARAMS,
  DEFAULT_INTERSECTION_PARAMS,
  DEFAULT_MESH_PARAMS,
  type HlrParams,
  type IntersectionParams,
  type MeshRenderParams,
  type RenderInclude,
};
