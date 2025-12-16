import { Mat4 } from "../math/mat4.js";
import { Vec3 } from "../math/vec3.js";
import type { Ray } from "../scene/ray.js";

export type CameraKind = "perspective" | "orthographic";

export type CameraParams =
  | {
      kind: "perspective";
      position: Vec3;
      target: Vec3;
      up: Vec3;
      fovYRad: number;
      aspect: number;
      near: number;
      far: number;
    }
  | {
      kind: "orthographic";
      position: Vec3;
      target: Vec3;
      up: Vec3;
      halfHeight: number;
      aspect: number;
      near: number;
      far: number;
    };

export class Camera {
  readonly kind: CameraKind;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly up: Vec3;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
  readonly fovYRad?: number; // perspective only
  readonly halfHeight?: number; // orthographic only
  readonly view: Mat4;
  readonly proj: Mat4;
  readonly viewProj: Mat4;
  readonly viewProjInv: Mat4;
  readonly forward: Vec3; // world-space view direction

  private constructor(params: CameraParams) {
    this.kind = params.kind;
    this.position = params.position;
    this.target = params.target;
    this.up = params.up;
    this.aspect = params.aspect;
    this.near = params.near;
    this.far = params.far;
    if (params.kind === "perspective") this.fovYRad = params.fovYRad;
    if (params.kind === "orthographic") this.halfHeight = params.halfHeight;
    this.forward = Vec3.normalize(Vec3.sub(params.target, params.position));

    this.view = Mat4.lookAt(params.position, params.target, params.up);
    this.proj =
      params.kind === "perspective"
        ? Mat4.perspective(params.fovYRad, params.aspect, params.near, params.far)
        : Mat4.ortho(
            -params.halfHeight * params.aspect,
            +params.halfHeight * params.aspect,
            -params.halfHeight,
            +params.halfHeight,
            params.near,
            params.far,
          );
    this.viewProj = Mat4.mul(this.view, this.proj); // NOTE: we use mulVec4 with column-major; order handled in project()
    const inv = Mat4.inverse(this.viewProj);
    this.viewProjInv = inv ?? Mat4.identity();
  }

  static from(params: CameraParams): Camera {
    return new Camera(params);
  }

  projectToNdc(p: Vec3): { x: number; y: number; z: number } {
    const v = Mat4.mulVec4(this.view, [p.x, p.y, p.z, 1]);
    const clip = Mat4.mulVec4(this.proj, v);
    const w = clip[3];
    if (w === 0) return { x: clip[0], y: clip[1], z: clip[2] };
    return { x: clip[0] / w, y: clip[1] / w, z: clip[2] / w };
  }

  projectToSvg(p: Vec3, width: number, height: number): { x: number; y: number; z: number } {
    const ndc = this.projectToNdc(p);
    const x = (ndc.x * 0.5 + 0.5) * width;
    const y = (1 - (ndc.y * 0.5 + 0.5)) * height;
    return { x, y, z: ndc.z };
  }

  /**
   * 스크린 좌표(SVG 픽셀)를 월드 공간 레이로 변환
   */
  screenToRay(screenX: number, screenY: number, width: number, height: number): Ray {
    // SVG 좌표 → NDC (-1 ~ 1)
    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = 1 - (screenY / height) * 2;

    if (this.kind === "perspective") {
      // near plane과 far plane에서의 점을 unproject
      const nearClip = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, -1, 1]);
      const farClip = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, 1, 1]);

      const nearW = nearClip[3] || 1;
      const farW = farClip[3] || 1;

      const nearWorld = new Vec3(nearClip[0] / nearW, nearClip[1] / nearW, nearClip[2] / nearW);
      const farWorld = new Vec3(farClip[0] / farW, farClip[1] / farW, farClip[2] / farW);

      const dir = Vec3.normalize(Vec3.sub(farWorld, nearWorld));
      return { origin: this.position, dir };
    }

    // orthographic: 레이 원점은 near plane 위, 방향은 forward
    const nearClip = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, -1, 1]);
    const w = nearClip[3] || 1;
    const origin = new Vec3(nearClip[0] / w, nearClip[1] / w, nearClip[2] / w);

    return { origin, dir: this.forward };
  }
}


