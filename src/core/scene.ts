import type { Camera } from "../camera/camera.js";
import type { Primitive } from "../scene/primitive.js";
import { Scene as RaycastScene } from "../scene/scene.js";

/**
 * User-facing Scene for three.js style usage.
 *
 * - The existing internal algorithm uses `Scene(primitives, camera)` from `scene/scene.ts`.
 * - This wrapper only manages primitives and creates an internal Scene at render time with the camera.
 */
export class Scene {
  private _primitives: Primitive[];

  constructor(primitives: readonly Primitive[] = []) {
    this._primitives = [...primitives];
  }

  get primitives(): readonly Primitive[] {
    return this._primitives;
  }

  add(...primitives: Primitive[]): this {
    this._primitives.push(...primitives);
    return this;
  }

  removeById(id: string): this {
    this._primitives = this._primitives.filter((p) => p.id !== id);
    return this;
  }

  clear(): this {
    this._primitives = [];
    return this;
  }

  /** Convert to internal Scene for visibility/raycasting */
  toRaycastScene(camera: Camera): RaycastScene {
    return new RaycastScene(this._primitives, camera);
  }
}

