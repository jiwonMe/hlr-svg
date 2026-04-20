import type { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import type { Bounds3 } from "../scene/primitives/triangleMesh.js";

export type ImportedModel = {
  meshes: TriangleMesh[];
  bounds: Bounds3;
  warnings: string[];
};
