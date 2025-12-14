import type { Camera } from "../camera/camera.js";
import type { Primitive } from "../scene/primitive.js";
import { Scene as RaycastScene } from "../scene/scene.js";

/**
 * three.js 스타일로 쓰기 위한 사용자용 Scene.
 *
 * - 기존 내부 알고리즘은 `scene/scene.ts`의 `Scene(primitives, camera)`를 사용한다.
 * - 이 래퍼는 primitives만 관리하고, 렌더링 시점에 camera를 받아 내부 Scene을 만든다.
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

  /** 내부 가시성/레이캐스트용 Scene으로 변환 */
  toRaycastScene(camera: Camera): RaycastScene {
    return new RaycastScene(this._primitives, camera);
  }
}

