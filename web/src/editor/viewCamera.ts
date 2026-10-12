import { Camera } from "@hlr/camera/camera.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { orbitPosition, type OrbitState } from "../runtime/orbit";

export type Projection = "orthographic" | "perspective";

/** Orthographic half height per unit of orbit radius. */
export const VIEW_SCALE = 0.38;

const UP = new Vec3(0, 1, 0);

export function cameraFor(
  view: OrbitState,
  projection: Projection,
  width: number,
  height: number,
): Camera {
  const common = {
    position: orbitPosition(view),
    target: view.target,
    up: UP,
    aspect: width / Math.max(1, height),
    near: 0.05,
    far: 1000,
  };
  return projection === "orthographic"
    ? Camera.from({
        ...common,
        kind: "orthographic",
        halfHeight: view.radius * VIEW_SCALE,
      })
    : Camera.from({
        ...common,
        kind: "perspective",
        fovYRad: 2 * Math.atan(VIEW_SCALE),
      });
}
