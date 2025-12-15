import { Mat4 } from "../math/mat4.js";
import { Vec3 } from "../math/vec3.js";
export class Camera {
    kind;
    position;
    target;
    up;
    aspect;
    near;
    far;
    fovYRad; // perspective only
    halfHeight; // orthographic only
    view;
    proj;
    viewProj;
    forward; // world-space view direction
    constructor(params) {
        this.kind = params.kind;
        this.position = params.position;
        this.target = params.target;
        this.up = params.up;
        this.aspect = params.aspect;
        this.near = params.near;
        this.far = params.far;
        if (params.kind === "perspective")
            this.fovYRad = params.fovYRad;
        if (params.kind === "orthographic")
            this.halfHeight = params.halfHeight;
        this.forward = Vec3.normalize(Vec3.sub(params.target, params.position));
        this.view = Mat4.lookAt(params.position, params.target, params.up);
        this.proj =
            params.kind === "perspective"
                ? Mat4.perspective(params.fovYRad, params.aspect, params.near, params.far)
                : Mat4.ortho(-params.halfHeight * params.aspect, +params.halfHeight * params.aspect, -params.halfHeight, +params.halfHeight, params.near, params.far);
        this.viewProj = Mat4.mul(this.view, this.proj); // NOTE: we use mulVec4 with column-major; order handled in project()
    }
    static from(params) {
        return new Camera(params);
    }
    projectToNdc(p) {
        const v = Mat4.mulVec4(this.view, [p.x, p.y, p.z, 1]);
        const clip = Mat4.mulVec4(this.proj, v);
        const w = clip[3];
        if (w === 0)
            return { x: clip[0], y: clip[1], z: clip[2] };
        return { x: clip[0] / w, y: clip[1] / w, z: clip[2] / w };
    }
    projectToSvg(p, width, height) {
        const ndc = this.projectToNdc(p);
        const x = (ndc.x * 0.5 + 0.5) * width;
        const y = (1 - (ndc.y * 0.5 + 0.5)) * height;
        return { x, y, z: ndc.z };
    }
}
