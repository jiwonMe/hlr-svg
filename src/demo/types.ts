import type { Camera } from "../camera/camera.js";
import type { Primitive } from "../scene/primitive.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";

export type DemoCase = {
  name: string;
  width: number;
  height: number;
  camera: Camera;
  primitives: readonly Primitive[];
  curves: (ctx: { camera: Camera; primitives: readonly Primitive[] }) => CubicBezier3[];
  includeIntersections: boolean;
};


