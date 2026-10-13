// hlr 0.2.0: bundled from src/ by scripts/build-skill.mjs. Do not edit.
// MIT License, https://github.com/jiwonMe/hlr-svg
const EPS = 1e-9;
function clamp01$1(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function almostEqual(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps;
}
function dedupeSorted(nums, eps = 1e-7) {
  if (nums.length === 0) return [];
  const out = [nums[0]];
  for (let i = 1; i < nums.length; i++) {
    const v = nums[i];
    if (Math.abs(v - out[out.length - 1]) > eps) out.push(v);
  }
  return out;
}
class Vec3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  static zero() {
    return new Vec3(0, 0, 0);
  }
  static add(a, b) {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }
  static sub(a, b) {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  static mulScalar(a, s) {
    return new Vec3(a.x * s, a.y * s, a.z * s);
  }
  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  static cross(a, b) {
    return new Vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  static lenSq(a) {
    return Vec3.dot(a, a);
  }
  static len(a) {
    return Math.sqrt(Vec3.lenSq(a));
  }
  static normalize(a) {
    const l = Vec3.len(a);
    if (l <= EPS) return Vec3.zero();
    return Vec3.mulScalar(a, 1 / l);
  }
  static lerp(a, b, t) {
    return new Vec3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }
  static distance(a, b) {
    return Vec3.len(Vec3.sub(a, b));
  }
  static distanceSq(a, b) {
    return Vec3.lenSq(Vec3.sub(a, b));
  }
}
class Mat4 {
  // column-major 4x4
  constructor(m) {
    this.m = m;
    if (m.length !== 16) throw new Error("Mat4 requires 16 numbers");
  }
  static identity() {
    return new Mat4([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
  }
  static mul(a, b) {
    const am = a.m, bm = b.m;
    const r = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) {
      for (let rRow = 0; rRow < 4; rRow++) {
        r[c * 4 + rRow] = am[0 * 4 + rRow] * bm[c * 4 + 0] + am[1 * 4 + rRow] * bm[c * 4 + 1] + am[2 * 4 + rRow] * bm[c * 4 + 2] + am[3 * 4 + rRow] * bm[c * 4 + 3];
      }
    }
    return new Mat4(r);
  }
  static mulVec4(a, v) {
    const m = a.m;
    const x = v[0], y = v[1], z = v[2], w = v[3];
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12] * w,
      m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w,
      m[3] * x + m[7] * y + m[11] * z + m[15] * w
    ];
  }
  static lookAt(eye, target, up) {
    const f = Vec3.normalize(Vec3.sub(target, eye));
    const s = Vec3.normalize(Vec3.cross(f, up));
    const u = Vec3.cross(s, f);
    const tx = -Vec3.dot(s, eye);
    const ty = -Vec3.dot(u, eye);
    const tz = Vec3.dot(f, eye);
    return new Mat4([
      s.x,
      u.x,
      -f.x,
      0,
      s.y,
      u.y,
      -f.y,
      0,
      s.z,
      u.z,
      -f.z,
      0,
      tx,
      ty,
      tz,
      1
    ]);
  }
  static perspective(fovYRad, aspect, near, far) {
    const f = 1 / Math.tan(fovYRad / 2);
    const nf = 1 / (near - far);
    return new Mat4([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) * nf,
      -1,
      0,
      0,
      2 * far * near * nf,
      0
    ]);
  }
  static ortho(left, right, bottom, top, near, far) {
    const rl = right - left;
    const tb = top - bottom;
    const fn = far - near;
    if (Math.abs(rl) <= EPS || Math.abs(tb) <= EPS || Math.abs(fn) <= EPS) {
      throw new Error("Invalid ortho volume");
    }
    return new Mat4([
      2 / rl,
      0,
      0,
      0,
      0,
      2 / tb,
      0,
      0,
      0,
      0,
      -2 / fn,
      0,
      -(right + left) / rl,
      -(top + bottom) / tb,
      -(far + near) / fn,
      1
    ]);
  }
  static inverse(a) {
    const m = a.m;
    const [
      m00,
      m01,
      m02,
      m03,
      m10,
      m11,
      m12,
      m13,
      m20,
      m21,
      m22,
      m23,
      m30,
      m31,
      m32,
      m33
    ] = m;
    const b00 = m00 * m11 - m01 * m10;
    const b01 = m00 * m12 - m02 * m10;
    const b02 = m00 * m13 - m03 * m10;
    const b03 = m01 * m12 - m02 * m11;
    const b04 = m01 * m13 - m03 * m11;
    const b05 = m02 * m13 - m03 * m12;
    const b06 = m20 * m31 - m21 * m30;
    const b07 = m20 * m32 - m22 * m30;
    const b08 = m20 * m33 - m23 * m30;
    const b09 = m21 * m32 - m22 * m31;
    const b10 = m21 * m33 - m23 * m31;
    const b11 = m22 * m33 - m23 * m32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < EPS) return null;
    det = 1 / det;
    return new Mat4([
      (m11 * b11 - m12 * b10 + m13 * b09) * det,
      (m02 * b10 - m01 * b11 - m03 * b09) * det,
      (m31 * b05 - m32 * b04 + m33 * b03) * det,
      (m22 * b04 - m21 * b05 - m23 * b03) * det,
      (m12 * b08 - m10 * b11 - m13 * b07) * det,
      (m00 * b11 - m02 * b08 + m03 * b07) * det,
      (m32 * b02 - m30 * b05 - m33 * b01) * det,
      (m20 * b05 - m22 * b02 + m23 * b01) * det,
      (m10 * b10 - m11 * b08 + m13 * b06) * det,
      (m01 * b08 - m00 * b10 - m03 * b06) * det,
      (m30 * b04 - m31 * b02 + m33 * b00) * det,
      (m21 * b02 - m20 * b04 - m23 * b00) * det,
      (m11 * b07 - m10 * b09 - m12 * b06) * det,
      (m00 * b09 - m01 * b07 + m02 * b06) * det,
      (m31 * b01 - m30 * b03 - m32 * b00) * det,
      (m20 * b03 - m21 * b01 + m22 * b00) * det
    ]);
  }
}
class Camera {
  kind;
  position;
  target;
  up;
  aspect;
  near;
  far;
  fovYRad;
  // perspective only
  halfHeight;
  // orthographic only
  view;
  proj;
  viewProj;
  viewProjInv;
  forward;
  // world-space view direction
  constructor(params) {
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
    this.proj = params.kind === "perspective" ? Mat4.perspective(params.fovYRad, params.aspect, params.near, params.far) : Mat4.ortho(
      -params.halfHeight * params.aspect,
      +params.halfHeight * params.aspect,
      -params.halfHeight,
      +params.halfHeight,
      params.near,
      params.far
    );
    this.viewProj = Mat4.mul(this.proj, this.view);
    const inv = Mat4.inverse(this.viewProj);
    this.viewProjInv = inv ?? Mat4.identity();
  }
  static from(params) {
    return new Camera(params);
  }
  projectToNdc(p) {
    const v = Mat4.mulVec4(this.view, [p.x, p.y, p.z, 1]);
    const clip = Mat4.mulVec4(this.proj, v);
    const w = clip[3];
    if (w === 0) return { x: clip[0], y: clip[1], z: clip[2] };
    return { x: clip[0] / w, y: clip[1] / w, z: clip[2] / w };
  }
  projectToSvg(p, width, height) {
    const ndc = this.projectToNdc(p);
    const x = (ndc.x * 0.5 + 0.5) * width;
    const y = (1 - (ndc.y * 0.5 + 0.5)) * height;
    return { x, y, z: ndc.z };
  }
  /**
   * 스크린 좌표(SVG 픽셀)를 월드 공간 레이로 변환
   */
  screenToRay(screenX, screenY, width, height) {
    const ndcX = screenX / width * 2 - 1;
    const ndcY = 1 - screenY / height * 2;
    if (this.kind === "perspective") {
      const nearClip2 = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, -1, 1]);
      const farClip = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, 1, 1]);
      const nearW = nearClip2[3] || 1;
      const farW = farClip[3] || 1;
      const nearWorld = new Vec3(nearClip2[0] / nearW, nearClip2[1] / nearW, nearClip2[2] / nearW);
      const farWorld = new Vec3(farClip[0] / farW, farClip[1] / farW, farClip[2] / farW);
      const dir = Vec3.normalize(Vec3.sub(farWorld, nearWorld));
      return { origin: this.position, dir };
    }
    const nearClip = Mat4.mulVec4(this.viewProjInv, [ndcX, ndcY, -1, 1]);
    const w = nearClip[3] || 1;
    const origin = new Vec3(nearClip[0] / w, nearClip[1] / w, nearClip[2] / w);
    return { origin, dir: this.forward };
  }
}
class Sphere {
  constructor(id, center, radius) {
    this.id = id;
    this.center = center;
    this.radius = radius;
  }
  intersect(ray, tMin, tMax) {
    const oc = Vec3.sub(ray.origin, this.center);
    const a = Vec3.dot(ray.dir, ray.dir);
    const b = 2 * Vec3.dot(oc, ray.dir);
    const c = Vec3.dot(oc, oc) - this.radius * this.radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const inv2a = 1 / (2 * a);
    const t0 = (-b - s) * inv2a;
    const t1 = (-b + s) * inv2a;
    let t = t0;
    if (t < tMin || t > tMax) t = t1;
    if (t < tMin || t > tMax) return null;
    if (t <= EPS) return null;
    const point = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    const normal2 = Vec3.normalize(Vec3.sub(point, this.center));
    return { t, point, normal: normal2, primitiveId: this.id };
  }
}
class Cylinder {
  // unit
  constructor(id, base, axis, height, radius, caps = "both") {
    this.id = id;
    this.base = base;
    this.height = height;
    this.radius = radius;
    this.caps = caps;
    this.axis = Vec3.normalize(axis);
  }
  axis;
  intersect(ray, tMin, tMax) {
    const oc = Vec3.sub(ray.origin, this.base);
    const dDotA = Vec3.dot(ray.dir, this.axis);
    const ocDotA = Vec3.dot(oc, this.axis);
    const dPerp = Vec3.sub(ray.dir, Vec3.mulScalar(this.axis, dDotA));
    const ocPerp = Vec3.sub(oc, Vec3.mulScalar(this.axis, ocDotA));
    let best = null;
    let bestT = tMax;
    const a = Vec3.dot(dPerp, dPerp);
    const b = 2 * Vec3.dot(ocPerp, dPerp);
    const c = Vec3.dot(ocPerp, ocPerp) - this.radius * this.radius;
    if (a > EPS) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        const inv2a = 1 / (2 * a);
        const t0 = (-b - s) * inv2a;
        const t1 = (-b + s) * inv2a;
        const candidates = [t0, t1];
        for (const t of candidates) {
          if (t <= EPS || t < tMin || t > bestT) continue;
          const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
          const v = Vec3.sub(p, this.base);
          const h = Vec3.dot(v, this.axis);
          if (h < 0 || h > this.height) continue;
          const onAxis = Vec3.add(this.base, Vec3.mulScalar(this.axis, h));
          const normal2 = Vec3.normalize(Vec3.sub(p, onAxis));
          bestT = t;
          best = { t, point: p, normal: normal2, primitiveId: this.id };
        }
      }
    }
    if (this.caps === "both") {
      best = this.hitCap(ray, this.base, this.axis, tMin, bestT, best) ?? best;
      const top = Vec3.add(this.base, Vec3.mulScalar(this.axis, this.height));
      best = this.hitCap(ray, top, this.axis, tMin, bestT, best) ?? best;
    }
    return best;
  }
  hitCap(ray, center, normal2, tMin, tMax, current) {
    const denom = Vec3.dot(ray.dir, normal2);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(center, ray.origin), normal2) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    const r2 = Vec3.distanceSq(p, center);
    if (r2 > this.radius * this.radius + 1e-8) return null;
    if (current && t >= current.t) return null;
    const n = denom < 0 ? normal2 : Vec3.mulScalar(normal2, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}
class Cone {
  // tan(theta) where theta is half-angle
  constructor(id, apex, axis, height, baseRadius, cap = "base") {
    this.id = id;
    this.apex = apex;
    this.height = height;
    this.baseRadius = baseRadius;
    this.cap = cap;
    this.axis = Vec3.normalize(axis);
    this.k = this.baseRadius / this.height;
  }
  axis;
  // unit, from apex to base
  k;
  intersect(ray, tMin, tMax) {
    let best = null;
    let bestT = tMax;
    const co = Vec3.sub(ray.origin, this.apex);
    const dv = Vec3.dot(ray.dir, this.axis);
    const cov = Vec3.dot(co, this.axis);
    const dPerp = Vec3.sub(ray.dir, Vec3.mulScalar(this.axis, dv));
    const coPerp = Vec3.sub(co, Vec3.mulScalar(this.axis, cov));
    const k2 = this.k * this.k;
    const a = Vec3.dot(dPerp, dPerp) - k2 * dv * dv;
    const b = 2 * (Vec3.dot(coPerp, dPerp) - k2 * cov * dv);
    const c = Vec3.dot(coPerp, coPerp) - k2 * cov * cov;
    if (Math.abs(a) > EPS) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        const inv2a = 1 / (2 * a);
        const t0 = (-b - s) * inv2a;
        const t1 = (-b + s) * inv2a;
        const candidates = [t0, t1];
        for (const t of candidates) {
          if (t <= EPS || t < tMin || t > bestT) continue;
          const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
          const x = Vec3.sub(p, this.apex);
          const y = Vec3.dot(x, this.axis);
          if (y < 0 || y > this.height) continue;
          const xPerp = Vec3.sub(x, Vec3.mulScalar(this.axis, y));
          const grad = Vec3.sub(Vec3.mulScalar(xPerp, 2), Vec3.mulScalar(this.axis, 2 * k2 * y));
          const normal2 = Vec3.normalize(grad);
          bestT = t;
          best = { t, point: p, normal: normal2, primitiveId: this.id };
        }
      }
    }
    if (this.cap === "base") {
      const baseCenter = Vec3.add(this.apex, Vec3.mulScalar(this.axis, this.height));
      const capHit = this.hitBaseCap(ray, baseCenter, this.axis, tMin, bestT);
      if (capHit && (!best || capHit.t < best.t)) best = capHit;
    }
    return best;
  }
  hitBaseCap(ray, center, normal2, tMin, tMax) {
    const denom = Vec3.dot(ray.dir, normal2);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(center, ray.origin), normal2) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    if (Vec3.distanceSq(p, center) > this.baseRadius * this.baseRadius + 1e-8) return null;
    const n = denom < 0 ? normal2 : Vec3.mulScalar(normal2, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}
class BoxAabb {
  constructor(id, min, max) {
    this.id = id;
    this.min = min;
    this.max = max;
  }
  intersect(ray, tMin, tMax) {
    let t0 = Number.NEGATIVE_INFINITY;
    let t1 = Number.POSITIVE_INFINITY;
    let enterNormal = new Vec3(0, 0, 0);
    let exitNormal = new Vec3(0, 0, 0);
    const axes = [
      ["x", new Vec3(-1, 0, 0), new Vec3(1, 0, 0)],
      ["y", new Vec3(0, -1, 0), new Vec3(0, 1, 0)],
      ["z", new Vec3(0, 0, -1), new Vec3(0, 0, 1)]
    ];
    for (const [axis, nMin, nMax] of axes) {
      const o = ray.origin[axis];
      const d = ray.dir[axis];
      const minA = this.min[axis];
      const maxA = this.max[axis];
      if (Math.abs(d) <= EPS) {
        if (o < minA || o > maxA) return null;
        continue;
      }
      const invD = 1 / d;
      let tNear = (minA - o) * invD;
      let tFar = (maxA - o) * invD;
      let nNear = nMin;
      let nFar = nMax;
      if (tNear > tFar) {
        const tmp = tNear;
        tNear = tFar;
        tFar = tmp;
        nNear = nMax;
        nFar = nMin;
      }
      if (tNear > t0) {
        t0 = tNear;
        enterNormal = nNear;
      }
      if (tFar < t1) {
        t1 = tFar;
        exitNormal = nFar;
      }
      if (t0 > t1) return null;
    }
    let t = t0;
    let normal2 = enterNormal;
    if (t <= EPS || t < tMin) {
      t = t1;
      normal2 = exitNormal;
    }
    if (!Number.isFinite(t) || t < tMin || t > tMax) return null;
    if (t <= EPS) return null;
    const point = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    return { t, point, normal: normal2, primitiveId: this.id };
  }
}
class PlaneRect {
  // unit, in-plane
  constructor(id, center, normal2, uHint, halfWidth, halfHeight) {
    this.id = id;
    this.center = center;
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
    this.normal = Vec3.normalize(normal2);
    const u0 = Vec3.sub(uHint, Vec3.mulScalar(this.normal, Vec3.dot(uHint, this.normal)));
    this.u = Vec3.normalize(u0);
    this.v = Vec3.normalize(Vec3.cross(this.normal, this.u));
  }
  normal;
  // unit
  u;
  // unit, in-plane
  v;
  intersect(ray, tMin, tMax) {
    const denom = Vec3.dot(ray.dir, this.normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(this.center, ray.origin), this.normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    const d = Vec3.sub(p, this.center);
    const du = Vec3.dot(d, this.u);
    const dv = Vec3.dot(d, this.v);
    if (Math.abs(du) > this.halfWidth + 1e-8) return null;
    if (Math.abs(dv) > this.halfHeight + 1e-8) return null;
    const n = denom < 0 ? this.normal : Vec3.mulScalar(this.normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}
class Disk {
  // unit
  constructor(id, center, normal2, radius) {
    this.id = id;
    this.center = center;
    this.radius = radius;
    this.normal = Vec3.normalize(normal2);
  }
  normal;
  intersect(ray, tMin, tMax) {
    const denom = Vec3.dot(ray.dir, this.normal);
    if (Math.abs(denom) <= EPS) return null;
    const t = Vec3.dot(Vec3.sub(this.center, ray.origin), this.normal) / denom;
    if (t <= EPS || t < tMin || t > tMax) return null;
    const p = Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t));
    if (Vec3.distanceSq(p, this.center) > this.radius * this.radius + 1e-8) return null;
    const n = denom < 0 ? this.normal : Vec3.mulScalar(this.normal, -1);
    return { t, point: p, normal: n, primitiveId: this.id };
  }
}
const DEFAULT_WELD_SCALE = 1e-6;
const MIN_WELD_EPS = 1e-9;
const BVH_LEAF_SIZE = 8;
class TriangleMesh {
  constructor(id, vertices, triangles) {
    this.id = id;
    const sourceBounds = boundsFromPoints(vertices);
    const diagonal = Vec3.distance(sourceBounds.min, sourceBounds.max);
    this.weldEps = Math.max(diagonal * DEFAULT_WELD_SCALE, MIN_WELD_EPS);
    const welded = weldVertices(vertices, this.weldEps);
    const builtFaces = buildFaces(
      welded.vertices,
      triangles,
      welded.remap,
      this.weldEps
    );
    const edgeMap = buildEdgeMap(builtFaces);
    this.vertices = welded.vertices;
    this.faces = builtFaces;
    this.triangles = builtFaces.map((face) => face.indices);
    this.bounds = this.vertices.length > 0 ? boundsFromPoints(this.vertices) : zeroBounds();
    this.topologyEdges = [...edgeMap.values()];
    this.bvh = buildBvh(builtFaces, builtFaces.map((_, index) => index));
  }
  vertices;
  triangles;
  bounds;
  weldEps;
  faces;
  topologyEdges;
  bvh;
  get triangleCount() {
    return this.triangles.length;
  }
  get vertexCount() {
    return this.vertices.length;
  }
  get edgeCount() {
    return this.topologyEdges.length;
  }
  intersect(ray, tMin, tMax) {
    if (!this.bvh) return null;
    const hit = intersectNode(this.bvh, ray, tMin, tMax, this.faces);
    if (!hit) return null;
    return { ...hit, primitiveId: this.id };
  }
  featureEdges(camera, opts = {}) {
    const creaseAngleDeg = opts.creaseAngleDeg ?? 30;
    const creaseCos = Math.cos(creaseAngleDeg * Math.PI / 180);
    const out = [];
    for (const edge of this.topologyEdges) {
      const kind = classifyFeatureEdge(edge, this.faces, camera, creaseCos);
      if (!kind) continue;
      out.push({
        kind,
        start: this.vertices[edge.a],
        end: this.vertices[edge.b]
      });
    }
    return out;
  }
}
function classifyFeatureEdge(edge, faces, camera, creaseCos) {
  if (edge.faces.length === 1) return "boundary";
  if (edge.faces.length !== 2) return "nonManifold";
  const face0 = faces[edge.faces[0]];
  const face1 = faces[edge.faces[1]];
  const s0 = facingSign(face0, camera);
  const s1 = facingSign(face1, camera);
  if (s0 !== 0 && s1 !== 0 && s0 !== s1) return "silhouette";
  const cosTheta = Vec3.dot(face0.normal, face1.normal);
  if (cosTheta < creaseCos) return "crease";
  return null;
}
function facingSign(face, camera) {
  const viewDir = camera.kind === "perspective" ? Vec3.sub(camera.position, face.center) : Vec3.mulScalar(camera.forward, -1);
  const dot = Vec3.dot(face.normal, viewDir);
  const eps = 1e-10;
  if (dot > eps) return 1;
  if (dot < -eps) return -1;
  return 0;
}
function buildFaces(vertices, triangles, remap, weldEps) {
  const out = [];
  const areaEpsSq = Math.max(weldEps * weldEps, MIN_WELD_EPS * MIN_WELD_EPS);
  for (const tri of triangles) {
    const ia = remap[tri[0]];
    const ib = remap[tri[1]];
    const ic = remap[tri[2]];
    if (ia === void 0 || ib === void 0 || ic === void 0) continue;
    if (ia === ib || ib === ic || ic === ia) continue;
    const a = vertices[ia];
    const b = vertices[ib];
    const c = vertices[ic];
    const ab = Vec3.sub(b, a);
    const ac = Vec3.sub(c, a);
    const cross = Vec3.cross(ab, ac);
    if (Vec3.lenSq(cross) <= areaEpsSq) continue;
    const normal2 = Vec3.normalize(cross);
    const center = new Vec3(
      (a.x + b.x + c.x) / 3,
      (a.y + b.y + c.y) / 3,
      (a.z + b.z + c.z) / 3
    );
    out.push({
      indices: [ia, ib, ic],
      a,
      b,
      c,
      normal: normal2,
      center,
      bounds: boundsFromPoints([a, b, c])
    });
  }
  return out;
}
function buildEdgeMap(faces) {
  const edges = /* @__PURE__ */ new Map();
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
    const [a, b, c] = faces[faceIndex].indices;
    addEdge(edges, a, b, faceIndex);
    addEdge(edges, b, c, faceIndex);
    addEdge(edges, c, a, faceIndex);
  }
  return edges;
}
function addEdge(edges, i0, i1, faceIndex) {
  const a = Math.min(i0, i1);
  const b = Math.max(i0, i1);
  const key = `${a}:${b}`;
  const edge = edges.get(key);
  if (edge) {
    edge.faces.push(faceIndex);
    return;
  }
  edges.set(key, { a, b, faces: [faceIndex] });
}
function weldVertices(vertices, weldEps) {
  const buckets = /* @__PURE__ */ new Map();
  const out = [];
  const remap = new Array(vertices.length);
  const invCell = 1 / Math.max(weldEps, MIN_WELD_EPS);
  const maxDistSq = weldEps * weldEps;
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const cellX = Math.floor(v.x * invCell);
    const cellY = Math.floor(v.y * invCell);
    const cellZ = Math.floor(v.z * invCell);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) {
      for (let dy = -1; dy <= 1 && found < 0; dy++) {
        for (let dz = -1; dz <= 1 && found < 0; dz++) {
          const bucket2 = buckets.get(
            bucketKey(cellX + dx, cellY + dy, cellZ + dz)
          );
          if (!bucket2) continue;
          for (const candidate of bucket2) {
            if (Vec3.distanceSq(out[candidate], v) <= maxDistSq) {
              found = candidate;
              break;
            }
          }
        }
      }
    }
    if (found >= 0) {
      remap[i] = found;
      continue;
    }
    const next = out.length;
    out.push(v);
    remap[i] = next;
    const key = bucketKey(cellX, cellY, cellZ);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(next);
    else buckets.set(key, [next]);
  }
  return { vertices: out, remap };
}
function bucketKey(x, y, z) {
  return `${x},${y},${z}`;
}
function buildBvh(faces, faceIndices) {
  if (faceIndices.length === 0) return null;
  const bounds = mergeFaceBounds(faceIndices, faces);
  if (faceIndices.length <= BVH_LEAF_SIZE) {
    return {
      bounds,
      left: null,
      right: null,
      faceIndices: [...faceIndices]
    };
  }
  const axis = longestAxis(bounds);
  const sorted = [...faceIndices].sort((a, b) => {
    const ca = faces[a].center[axis];
    const cb = faces[b].center[axis];
    return ca - cb;
  });
  const mid = Math.floor(sorted.length / 2);
  const left = buildBvh(faces, sorted.slice(0, mid));
  const right = buildBvh(faces, sorted.slice(mid));
  if (!left || !right) {
    return {
      bounds,
      left: null,
      right: null,
      faceIndices: [...faceIndices]
    };
  }
  return { bounds, left, right, faceIndices: null };
}
function intersectNode(node, ray, tMin, tMax, faces) {
  const boundsHit = intersectBounds(ray, node.bounds, tMin, tMax);
  if (!boundsHit) return null;
  let bestT = Math.min(tMax, boundsHit.tFar);
  let best = null;
  if (node.faceIndices) {
    for (const faceIndex of node.faceIndices) {
      const hit = intersectTriangle(ray, faces[faceIndex], bestT);
      if (!hit || hit.t < tMin || hit.t > bestT) continue;
      best = hit;
      bestT = hit.t;
    }
    return best;
  }
  const leftHit = node.left ? intersectBounds(ray, node.left.bounds, tMin, bestT) : null;
  const rightHit = node.right ? intersectBounds(ray, node.right.bounds, tMin, bestT) : null;
  const first = !rightHit || leftHit && leftHit.tNear <= rightHit.tNear ? node.left : node.right;
  const second = first === node.left ? node.right : node.left;
  if (first) {
    const hit = intersectNode(first, ray, tMin, bestT, faces);
    if (hit) {
      best = hit;
      bestT = hit.t;
    }
  }
  if (second) {
    const hit = intersectNode(second, ray, tMin, bestT, faces);
    if (hit) best = hit;
  }
  return best;
}
function intersectTriangle(ray, face, tMax) {
  const { a, b, c } = face;
  const edge1 = Vec3.sub(b, a);
  const edge2 = Vec3.sub(c, a);
  const p = Vec3.cross(ray.dir, edge2);
  const det = Vec3.dot(edge1, p);
  if (Math.abs(det) <= EPS) return null;
  const invDet = 1 / det;
  const tvec = Vec3.sub(ray.origin, a);
  const u = Vec3.dot(tvec, p) * invDet;
  if (u < 0 || u > 1) return null;
  const q = Vec3.cross(tvec, edge1);
  const v = Vec3.dot(ray.dir, q) * invDet;
  if (v < 0 || u + v > 1) return null;
  const t = Vec3.dot(edge2, q) * invDet;
  if (t <= EPS || t > tMax) return null;
  return {
    t,
    point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
    normal: face.normal
  };
}
function intersectBounds(ray, bounds, tMin, tMax) {
  let near = tMin;
  let far = tMax;
  const axes = ["x", "y", "z"];
  for (const axis of axes) {
    const o = ray.origin[axis];
    const d = ray.dir[axis];
    const minA = bounds.min[axis];
    const maxA = bounds.max[axis];
    if (Math.abs(d) <= EPS) {
      if (o < minA || o > maxA) return null;
      continue;
    }
    const invD = 1 / d;
    let t0 = (minA - o) * invD;
    let t1 = (maxA - o) * invD;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    if (t0 > near) near = t0;
    if (t1 < far) far = t1;
    if (near > far) return null;
  }
  return { tNear: near, tFar: far };
}
function mergeFaceBounds(faceIndices, faces) {
  const first = faces[faceIndices[0]].bounds;
  let minX = first.min.x;
  let minY = first.min.y;
  let minZ = first.min.z;
  let maxX = first.max.x;
  let maxY = first.max.y;
  let maxZ = first.max.z;
  for (let i = 1; i < faceIndices.length; i++) {
    const bounds = faces[faceIndices[i]].bounds;
    minX = Math.min(minX, bounds.min.x);
    minY = Math.min(minY, bounds.min.y);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxY = Math.max(maxY, bounds.max.y);
    maxZ = Math.max(maxZ, bounds.max.z);
  }
  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ)
  };
}
function longestAxis(bounds) {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const dz = bounds.max.z - bounds.min.z;
  if (dx >= dy && dx >= dz) return "x";
  if (dy >= dz) return "y";
  return "z";
}
function boundsFromPoints(points) {
  if (points.length === 0) return zeroBounds();
  let minX = points[0].x;
  let minY = points[0].y;
  let minZ = points[0].z;
  let maxX = points[0].x;
  let maxY = points[0].y;
  let maxZ = points[0].z;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }
  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ)
  };
}
function mergeBounds(boundsList) {
  if (boundsList.length === 0) return zeroBounds();
  let minX = boundsList[0].min.x;
  let minY = boundsList[0].min.y;
  let minZ = boundsList[0].min.z;
  let maxX = boundsList[0].max.x;
  let maxY = boundsList[0].max.y;
  let maxZ = boundsList[0].max.z;
  for (let i = 1; i < boundsList.length; i++) {
    const bounds = boundsList[i];
    minX = Math.min(minX, bounds.min.x);
    minY = Math.min(minY, bounds.min.y);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxY = Math.max(maxY, bounds.max.y);
    maxZ = Math.max(maxZ, bounds.max.z);
  }
  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ)
  };
}
function zeroBounds() {
  return {
    min: Vec3.zero(),
    max: Vec3.zero()
  };
}
class OrientedBox {
  constructor(id, center, halfSize, axisX, axisY) {
    this.id = id;
    this.center = center;
    this.halfSize = halfSize;
    const x = Vec3.normalize(axisX);
    const y = Vec3.normalize(
      Vec3.sub(axisY, Vec3.mulScalar(x, Vec3.dot(axisY, x)))
    );
    this.axes = [x, y, Vec3.cross(x, y)];
  }
  /** Unit local axes in world space. */
  axes;
  half(i) {
    return i === 0 ? this.halfSize.x : i === 1 ? this.halfSize.y : this.halfSize.z;
  }
  /** World point → coordinates along the box axes, relative to its center. */
  toLocal(p) {
    const d = Vec3.sub(p, this.center);
    const [x, y, z] = this.axes;
    return new Vec3(Vec3.dot(d, x), Vec3.dot(d, y), Vec3.dot(d, z));
  }
  intersect(ray, tMin, tMax) {
    const o = this.toLocal(ray.origin);
    const local = [o.x, o.y, o.z];
    let t0 = Number.NEGATIVE_INFINITY;
    let t1 = Number.POSITIVE_INFINITY;
    let enter = 0;
    let exit = 0;
    let enterSign = 1;
    let exitSign = 1;
    for (let i = 0; i < 3; i++) {
      const d = Vec3.dot(ray.dir, this.axes[i]);
      const h = this.half(i);
      if (Math.abs(d) <= EPS) {
        if (Math.abs(local[i]) > h) return null;
        continue;
      }
      let near = (-h - local[i]) / d;
      let far = (h - local[i]) / d;
      let nearSign = -1;
      let farSign = 1;
      if (near > far) {
        [near, far] = [far, near];
        [nearSign, farSign] = [farSign, nearSign];
      }
      if (near > t0) {
        t0 = near;
        enter = i;
        enterSign = nearSign;
      }
      if (far < t1) {
        t1 = far;
        exit = i;
        exitSign = farSign;
      }
      if (t0 > t1) return null;
    }
    let t = t0;
    let axis = enter;
    let sign = enterSign;
    if (t <= EPS || t < tMin) {
      t = t1;
      axis = exit;
      sign = exitSign;
    }
    if (!Number.isFinite(t) || t < tMin || t > tMax || t <= EPS) return null;
    return {
      t,
      point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
      normal: Vec3.mulScalar(this.axes[axis], sign),
      primitiveId: this.id
    };
  }
  /** Corner i has local signs (bit 0: x, bit 1: y, bit 2: z). */
  corners() {
    const [x, y, z] = this.axes;
    const { x: hx, y: hy, z: hz } = this.halfSize;
    return Array.from(
      { length: 8 },
      (_, i) => Vec3.add(
        this.center,
        Vec3.add(
          Vec3.mulScalar(x, i & 1 ? hx : -hx),
          Vec3.add(
            Vec3.mulScalar(y, i & 2 ? hy : -hy),
            Vec3.mulScalar(z, i & 4 ? hz : -hz)
          )
        )
      )
    );
  }
  /** The twelve edges as corner pairs. */
  edges() {
    const c = this.corners();
    const pairs = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7]
    ];
    return pairs.map(([a, b]) => [c[a], c[b]]);
  }
  /** The six faces as rectangles, for plane and surface intersections. */
  faces(tag = "") {
    const [x, y, z] = this.axes;
    const { x: hx, y: hy, z: hz } = this.halfSize;
    const at = (axis, h) => Vec3.add(this.center, Vec3.mulScalar(axis, h));
    const neg = (v) => Vec3.mulScalar(v, -1);
    const id = (name) => `${this.id}:${tag}:face:${name}`;
    return [
      new PlaneRect(id("+x"), at(x, hx), x, z, hz, hy),
      new PlaneRect(id("-x"), at(x, -hx), neg(x), z, hz, hy),
      new PlaneRect(id("+y"), at(y, hy), y, x, hx, hz),
      new PlaneRect(id("-y"), at(y, -hy), neg(y), x, hx, hz),
      new PlaneRect(id("+z"), at(z, hz), z, x, hx, hy),
      new PlaneRect(id("-z"), at(z, -hz), neg(z), x, hx, hy)
    ];
  }
}
const CSG_TOLERANCE = 3e-3;
const INF = Number.POSITIVE_INFINITY;
class Csg {
  constructor(id, operation, a, b) {
    this.id = id;
    this.operation = operation;
    this.a = a;
    this.b = b;
  }
  intersect(ray, tMin, tMax) {
    for (const span2 of csgSpans(this, ray)) {
      for (const crossing of [span2.start, span2.end]) {
        const t = crossing.t;
        if (t <= EPS || t < tMin) continue;
        if (t > tMax) return null;
        const entering = crossing === span2.start;
        const along = Vec3.dot(crossing.normal, ray.dir) > 0;
        const normal2 = entering === along ? Vec3.mulScalar(crossing.normal, -1) : crossing.normal;
        return {
          t,
          point: Vec3.add(ray.origin, Vec3.mulScalar(ray.dir, t)),
          normal: normal2,
          primitiveId: this.id
        };
      }
    }
    return null;
  }
  /** Point classification against the combined solid. */
  classify(p, tolerance) {
    return classifySolid(this, p, tolerance);
  }
  /** The primitive operands, depth first. */
  leaves() {
    const out = [];
    const walk = (solid) => {
      if (solid instanceof Csg) {
        walk(solid.a);
        walk(solid.b);
      } else out.push(solid);
    };
    walk(this);
    return out;
  }
  /** Size of the largest operand, for scale-aware tolerances. */
  size() {
    let size = 0;
    for (const leaf of this.leaves()) size = Math.max(size, leafSize(leaf));
    return size;
  }
}
function csgSpans(solid, ray) {
  if (!(solid instanceof Csg)) {
    const span2 = leafSpan(solid, ray);
    return span2 ? [span2] : [];
  }
  const a = csgSpans(solid.a, ray);
  const b = csgSpans(solid.b, ray);
  if (solid.operation === "union") return unionSpans(a, b);
  if (solid.operation === "intersect") return intersectSpans(a, b);
  return subtractSpans(a, b);
}
function span(t0, n0, t1, n1) {
  if (!(t0 < t1) || !Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return { start: { t: t0, normal: n0 }, end: { t: t1, normal: n1 } };
}
class Clip {
  t0 = -INF;
  t1 = INF;
  n0 = new Vec3(0, 0, 0);
  n1 = new Vec3(0, 0, 0);
  empty = false;
  enter(t, n) {
    if (t > this.t0) {
      this.t0 = t;
      this.n0 = n;
    }
  }
  leave(t, n) {
    if (t < this.t1) {
      this.t1 = t;
      this.n1 = n;
    }
  }
  /** Keeps `lo ≤ s(t) ≤ hi` for an affine s(t) = s0 + ds·t. */
  slab(s0, ds, lo, hi, nLo, nHi) {
    if (Math.abs(ds) <= EPS) {
      if (s0 < lo || s0 > hi) this.empty = true;
      return;
    }
    const ta = (lo - s0) / ds;
    const tb = (hi - s0) / ds;
    if (ta < tb) {
      this.enter(ta, nLo);
      this.leave(tb, nHi);
    } else {
      this.enter(tb, nHi);
      this.leave(ta, nLo);
    }
  }
  result() {
    return this.empty ? null : span(this.t0, this.n0, this.t1, this.n1);
  }
  copy() {
    const c = new Clip();
    c.t0 = this.t0;
    c.t1 = this.t1;
    c.n0 = this.n0;
    c.n1 = this.n1;
    c.empty = this.empty;
    return c;
  }
}
function leafSpan(leaf, ray) {
  const { origin: o, dir: d } = ray;
  if (leaf instanceof Sphere) {
    const oc = Vec3.sub(o, leaf.center);
    const a = Vec3.dot(d, d);
    const b = 2 * Vec3.dot(oc, d);
    const c = Vec3.dot(oc, oc) - leaf.radius * leaf.radius;
    const disc2 = b * b - 4 * a * c;
    if (disc2 <= 0) return null;
    const s2 = Math.sqrt(disc2);
    const t0 = (-b - s2) / (2 * a);
    const t1 = (-b + s2) / (2 * a);
    const at = (t) => Vec3.normalize(Vec3.sub(Vec3.add(o, Vec3.mulScalar(d, t)), leaf.center));
    return span(t0, at(t0), t1, at(t1));
  }
  if (leaf instanceof BoxAabb) {
    const clip2 = new Clip();
    const axes = [
      ["x", new Vec3(1, 0, 0)],
      ["y", new Vec3(0, 1, 0)],
      ["z", new Vec3(0, 0, 1)]
    ];
    for (const [k2, n] of axes)
      clip2.slab(o[k2], d[k2], leaf.min[k2], leaf.max[k2], Vec3.mulScalar(n, -1), n);
    return clip2.result();
  }
  if (leaf instanceof OrientedBox) {
    const clip2 = new Clip();
    const local = leaf.toLocal(o);
    const values = [local.x, local.y, local.z];
    const halves = [leaf.halfSize.x, leaf.halfSize.y, leaf.halfSize.z];
    leaf.axes.forEach(
      (axis2, i) => clip2.slab(
        values[i],
        Vec3.dot(d, axis2),
        -halves[i],
        halves[i],
        Vec3.mulScalar(axis2, -1),
        axis2
      )
    );
    return clip2.result();
  }
  if (leaf instanceof Cylinder) {
    const axis2 = leaf.axis;
    const clip2 = new Clip();
    const h0 = Vec3.dot(Vec3.sub(o, leaf.base), axis2);
    clip2.slab(
      h0,
      Vec3.dot(d, axis2),
      0,
      leaf.height,
      Vec3.mulScalar(axis2, -1),
      axis2
    );
    const oc = Vec3.sub(o, leaf.base);
    const dPerp2 = Vec3.sub(d, Vec3.mulScalar(axis2, Vec3.dot(d, axis2)));
    const oPerp2 = Vec3.sub(oc, Vec3.mulScalar(axis2, Vec3.dot(oc, axis2)));
    const a = Vec3.dot(dPerp2, dPerp2);
    const c = Vec3.dot(oPerp2, oPerp2) - leaf.radius * leaf.radius;
    if (a <= EPS) {
      if (c > 0) return null;
    } else {
      const b = 2 * Vec3.dot(oPerp2, dPerp2);
      const disc2 = b * b - 4 * a * c;
      if (disc2 <= 0) return null;
      const s2 = Math.sqrt(disc2);
      const t0 = (-b - s2) / (2 * a);
      const t1 = (-b + s2) / (2 * a);
      const radial = (t) => Vec3.normalize(Vec3.add(oPerp2, Vec3.mulScalar(dPerp2, t)));
      clip2.enter(t0, radial(t0));
      clip2.leave(t1, radial(t1));
    }
    return clip2.result();
  }
  const axis = leaf.axis;
  const k = leaf.baseRadius / leaf.height;
  const clip = new Clip();
  const co = Vec3.sub(o, leaf.apex);
  const y0 = Vec3.dot(co, axis);
  const dy = Vec3.dot(d, axis);
  clip.slab(y0, dy, 0, leaf.height, Vec3.mulScalar(axis, -1), axis);
  const oPerp = Vec3.sub(co, Vec3.mulScalar(axis, y0));
  const dPerp = Vec3.sub(d, Vec3.mulScalar(axis, dy));
  const A = Vec3.dot(dPerp, dPerp) - k * k * dy * dy;
  const B = 2 * (Vec3.dot(oPerp, dPerp) - k * k * y0 * dy);
  const C = Vec3.dot(oPerp, oPerp) - k * k * y0 * y0;
  const lateral = (t) => {
    const y = y0 + dy * t;
    const perp = Vec3.add(oPerp, Vec3.mulScalar(dPerp, t));
    return Vec3.normalize(Vec3.sub(perp, Vec3.mulScalar(axis, k * k * y)));
  };
  if (Math.abs(A) <= EPS) {
    if (Math.abs(B) <= EPS) {
      if (C > 0) return null;
    } else {
      const t = -C / B;
      if (B > 0) clip.leave(t, lateral(t));
      else clip.enter(t, lateral(t));
    }
    return clip.result();
  }
  const disc = B * B - 4 * A * C;
  if (disc <= 0) {
    if (A > 0) return null;
    return clip.result();
  }
  const s = Math.sqrt(disc);
  const r0 = Math.min((-B - s) / (2 * A), (-B + s) / (2 * A));
  const r1 = Math.max((-B - s) / (2 * A), (-B + s) / (2 * A));
  if (A > 0) {
    clip.enter(r0, lateral(r0));
    clip.leave(r1, lateral(r1));
    return clip.result();
  }
  const before = clip.copy();
  before.leave(r0, lateral(r0));
  clip.enter(r1, lateral(r1));
  return before.result() ?? clip.result();
}
function unionSpans(a, b) {
  const all = [...a, ...b].sort((x, y) => x.start.t - y.start.t);
  const out = [];
  for (const s of all) {
    const last = out[out.length - 1];
    if (last && s.start.t <= last.end.t) {
      if (s.end.t > last.end.t)
        out[out.length - 1] = { start: last.start, end: s.end };
    } else out.push(s);
  }
  return out;
}
function intersectSpans(a, b) {
  const out = [];
  for (const x of a)
    for (const y of b) {
      const start = x.start.t > y.start.t ? x.start : y.start;
      const end = x.end.t < y.end.t ? x.end : y.end;
      if (start.t < end.t) out.push({ start, end });
    }
  return out.sort((x, y) => x.start.t - y.start.t);
}
function subtractSpans(a, b) {
  let pieces = a;
  for (const cut of b) {
    const next = [];
    for (const piece of pieces) {
      if (cut.end.t <= piece.start.t || cut.start.t >= piece.end.t) {
        next.push(piece);
        continue;
      }
      if (cut.start.t > piece.start.t)
        next.push({ start: piece.start, end: cut.start });
      if (cut.end.t < piece.end.t)
        next.push({ start: cut.end, end: piece.end });
    }
    pieces = next;
  }
  return pieces;
}
function leafDistance(leaf, p) {
  if (leaf instanceof Sphere)
    return Vec3.distance(p, leaf.center) - leaf.radius;
  if (leaf instanceof BoxAabb) {
    const c = Vec3.mulScalar(Vec3.add(leaf.min, leaf.max), 0.5);
    const h = Vec3.mulScalar(Vec3.sub(leaf.max, leaf.min), 0.5);
    return Math.max(
      Math.abs(p.x - c.x) - h.x,
      Math.abs(p.y - c.y) - h.y,
      Math.abs(p.z - c.z) - h.z
    );
  }
  if (leaf instanceof OrientedBox) {
    const l = leaf.toLocal(p);
    return Math.max(
      Math.abs(l.x) - leaf.halfSize.x,
      Math.abs(l.y) - leaf.halfSize.y,
      Math.abs(l.z) - leaf.halfSize.z
    );
  }
  if (leaf instanceof Cylinder) {
    const v2 = Vec3.sub(p, leaf.base);
    const h = Vec3.dot(v2, leaf.axis);
    const radial2 = Vec3.len(Vec3.sub(v2, Vec3.mulScalar(leaf.axis, h)));
    return Math.max(radial2 - leaf.radius, -h, h - leaf.height);
  }
  const v = Vec3.sub(p, leaf.apex);
  const y = Vec3.dot(v, leaf.axis);
  const radial = Vec3.len(Vec3.sub(v, Vec3.mulScalar(leaf.axis, y)));
  const k = leaf.baseRadius / leaf.height;
  return Math.max((radial - k * y) / Math.sqrt(1 + k * k), -y, y - leaf.height);
}
function classifySolid(solid, p, tolerance) {
  if (!(solid instanceof Csg)) {
    const d = leafDistance(solid, p);
    return d < -tolerance ? -1 : d > tolerance ? 1 : 0;
  }
  const a = classifySolid(solid.a, p, tolerance);
  let b = classifySolid(solid.b, p, tolerance);
  if (solid.operation === "subtract") b = -b;
  if (solid.operation === "union") {
    if (a === -1 || b === -1) return -1;
    return a === 1 && b === 1 ? 1 : 0;
  }
  if (a === 1 || b === 1) return 1;
  return a === -1 && b === -1 ? -1 : 0;
}
function leafSize(leaf) {
  if (leaf instanceof Sphere) return leaf.radius;
  if (leaf instanceof BoxAabb) return Vec3.distance(leaf.min, leaf.max) / 2;
  if (leaf instanceof OrientedBox) return Vec3.len(leaf.halfSize);
  if (leaf instanceof Cylinder) return Math.hypot(leaf.radius, leaf.height / 2);
  return Math.hypot(leaf.baseRadius, leaf.height);
}
function evalCubic3(b, t) {
  const ax = b.p0.x + (b.p1.x - b.p0.x) * t;
  const ay = b.p0.y + (b.p1.y - b.p0.y) * t;
  const az = b.p0.z + (b.p1.z - b.p0.z) * t;
  const bx = b.p1.x + (b.p2.x - b.p1.x) * t;
  const by = b.p1.y + (b.p2.y - b.p1.y) * t;
  const bz = b.p1.z + (b.p2.z - b.p1.z) * t;
  const cx = b.p2.x + (b.p3.x - b.p2.x) * t;
  const cy = b.p2.y + (b.p3.y - b.p2.y) * t;
  const cz = b.p2.z + (b.p3.z - b.p2.z) * t;
  const dx = ax + (bx - ax) * t;
  const dy = ay + (by - ay) * t;
  const dz = az + (bz - az) * t;
  const ex = bx + (cx - bx) * t;
  const ey = by + (cy - by) * t;
  const ez = bz + (cz - bz) * t;
  return new Vec3(dx + (ex - dx) * t, dy + (ey - dy) * t, dz + (ez - dz) * t);
}
function splitCubic3(b, t) {
  const a = Vec3.lerp(b.p0, b.p1, t);
  const c = Vec3.lerp(b.p1, b.p2, t);
  const d = Vec3.lerp(b.p2, b.p3, t);
  const e = Vec3.lerp(a, c, t);
  const f = Vec3.lerp(c, d, t);
  const g = Vec3.lerp(e, f, t);
  return {
    left: { p0: b.p0, p1: a, p2: e, p3: g },
    right: { p0: g, p1: f, p2: d, p3: b.p3 }
  };
}
function subCubic3(b, t0, t1) {
  if (t0 <= 0 && t1 >= 1) return b;
  const left = t1 >= 1 ? b : splitCubic3(b, t1).left;
  if (t0 <= 0) return left;
  return splitCubic3(left, t0 / t1).right;
}
function splitCubicWhere(b, keep, samples = 24, refineSteps = 14) {
  const flags = [];
  for (let i = 0; i <= samples; i++)
    flags.push(keep(evalCubic3(b, i / samples)));
  if (flags.every(Boolean)) return [b];
  if (!flags.some(Boolean)) return [];
  const edge = (lo, hi, loValue) => {
    for (let i = 0; i < refineSteps; i++) {
      const mid = (lo + hi) / 2;
      if (keep(evalCubic3(b, mid)) === loValue) lo = mid;
      else hi = mid;
    }
    return loValue ? lo : hi;
  };
  const pieces = [];
  let start = flags[0] ? 0 : null;
  for (let i = 1; i <= samples; i++) {
    if (flags[i] === flags[i - 1]) continue;
    const t = edge((i - 1) / samples, i / samples, flags[i - 1]);
    if (flags[i - 1]) {
      if (start !== null && t - start > 1e-4)
        pieces.push(subCubic3(b, start, t));
      start = null;
    } else start = t;
  }
  if (start !== null && 1 - start > 1e-4) pieces.push(subCubic3(b, start, 1));
  return pieces;
}
function lineToCubic3(p0, p3) {
  const d = Vec3.sub(p3, p0);
  const p1 = Vec3.add(p0, Vec3.mulScalar(d, 1 / 3));
  const p2 = Vec3.add(p0, Vec3.mulScalar(d, 2 / 3));
  return { p0, p1, p2, p3 };
}
function sphereSilhouetteToCubics3(opts) {
  if (opts.viewDirection) {
    return circleToCubics3({
      center: opts.center,
      normal: opts.viewDirection,
      radius: opts.radius
    });
  }
  const u = Vec3.sub(opts.center, opts.cameraPos);
  const d = Vec3.len(u);
  const r = opts.radius;
  if (d <= r * (1 + 1e-8)) return [];
  const n = Vec3.normalize(u);
  const k = 1 - r * r / (d * d);
  const s = Vec3.add(opts.cameraPos, Vec3.mulScalar(u, k));
  const rs = r * Math.sqrt(Math.max(0, d * d - r * r)) / d;
  return circleToCubics3({ center: s, normal: n, radius: rs });
}
function cylinderSilhouetteToCubics3(opts) {
  const a = Vec3.normalize(opts.axis);
  const w = opts.viewDirection ? Vec3.mulScalar(opts.viewDirection, -1) : Vec3.sub(opts.cameraPos, opts.base);
  const wPerp = Vec3.sub(w, Vec3.mulScalar(a, Vec3.dot(w, a)));
  const wLen = Vec3.len(wPerp);
  if (wLen <= 1e-12 || !opts.viewDirection && wLen <= opts.radius * (1 + 1e-8))
    return [];
  const wUnit = Vec3.mulScalar(wPerp, 1 / wLen);
  const perp = Vec3.normalize(Vec3.cross(a, wUnit));
  const cosPhi = opts.viewDirection ? 0 : opts.radius / wLen;
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const n0 = Vec3.add(
    Vec3.mulScalar(wUnit, cosPhi),
    Vec3.mulScalar(perp, sinPhi)
  );
  const n1 = Vec3.add(
    Vec3.mulScalar(wUnit, cosPhi),
    Vec3.mulScalar(perp, -sinPhi)
  );
  const topCenter = Vec3.add(opts.base, Vec3.mulScalar(a, opts.height));
  const b0 = Vec3.add(opts.base, Vec3.mulScalar(n0, opts.radius));
  const t0 = Vec3.add(topCenter, Vec3.mulScalar(n0, opts.radius));
  const b1 = Vec3.add(opts.base, Vec3.mulScalar(n1, opts.radius));
  const t1 = Vec3.add(topCenter, Vec3.mulScalar(n1, opts.radius));
  return [lineToCubic3(b0, t0), lineToCubic3(b1, t1)];
}
function coneSilhouetteToCubics3(opts) {
  const a = Vec3.normalize(opts.axis);
  const k = opts.baseRadius / opts.height;
  const { u, v } = orthonormalBasisFromNormal(a);
  const q = opts.viewDirection ? Vec3.mulScalar(opts.viewDirection, -1) : Vec3.sub(opts.cameraPos, opts.apex);
  const qu = Vec3.dot(q, u);
  const qv = Vec3.dot(q, v);
  const qa = Vec3.dot(q, a);
  const m = Math.hypot(qu, qv);
  if (m <= 1e-8) return [];
  const rhs = k * qa / m;
  if (Math.abs(rhs) > 1) return [];
  const phi = Math.atan2(qv, qu);
  const delta = Math.acos(rhs);
  const psi0 = phi + delta;
  const psi1 = phi - delta;
  const baseCenter = Vec3.add(opts.apex, Vec3.mulScalar(a, opts.height));
  const w0 = Vec3.add(
    Vec3.mulScalar(u, Math.cos(psi0)),
    Vec3.mulScalar(v, Math.sin(psi0))
  );
  const w1 = Vec3.add(
    Vec3.mulScalar(u, Math.cos(psi1)),
    Vec3.mulScalar(v, Math.sin(psi1))
  );
  const p0 = Vec3.add(baseCenter, Vec3.mulScalar(w0, opts.baseRadius));
  const p1 = Vec3.add(baseCenter, Vec3.mulScalar(w1, opts.baseRadius));
  return [lineToCubic3(opts.apex, p0), lineToCubic3(opts.apex, p1)];
}
function cylinderGeneratorsToCubics3(opts) {
  const a = Vec3.normalize(opts.axis);
  const baseToCam = Vec3.sub(opts.cameraPos, opts.base);
  const s = Vec3.dot(baseToCam, a);
  const closestOnAxis = Vec3.add(opts.base, Vec3.mulScalar(a, s));
  const radial = Vec3.sub(opts.cameraPos, closestOnAxis);
  const radialPerp = Vec3.sub(radial, Vec3.mulScalar(a, Vec3.dot(radial, a)));
  const radialLen = Vec3.len(radialPerp);
  const rDir = radialLen > 1e-8 ? Vec3.mulScalar(radialPerp, 1 / radialLen) : Vec3.normalize(Vec3.cross(a, new Vec3(0, 0, 1)));
  const base0 = Vec3.add(opts.base, Vec3.mulScalar(rDir, opts.radius));
  const base1 = Vec3.sub(opts.base, Vec3.mulScalar(rDir, opts.radius));
  const topCenter = Vec3.add(opts.base, Vec3.mulScalar(a, opts.height));
  const top0 = Vec3.add(topCenter, Vec3.mulScalar(rDir, opts.radius));
  const top1 = Vec3.sub(topCenter, Vec3.mulScalar(rDir, opts.radius));
  return [lineToCubic3(base0, top0), lineToCubic3(base1, top1)];
}
function coneGeneratorsToCubics3(opts) {
  const a = Vec3.normalize(opts.axis);
  const apexToCam = Vec3.sub(opts.cameraPos, opts.apex);
  const s = Vec3.dot(apexToCam, a);
  const closestOnAxis = Vec3.add(opts.apex, Vec3.mulScalar(a, s));
  const radial = Vec3.sub(opts.cameraPos, closestOnAxis);
  const radialPerp = Vec3.sub(radial, Vec3.mulScalar(a, Vec3.dot(radial, a)));
  const radialLen = Vec3.len(radialPerp);
  const rDir = radialLen > 1e-8 ? Vec3.mulScalar(radialPerp, 1 / radialLen) : Vec3.normalize(Vec3.cross(a, new Vec3(0, 0, 1)));
  const baseCenter = Vec3.add(opts.apex, Vec3.mulScalar(a, opts.height));
  const b0 = Vec3.add(baseCenter, Vec3.mulScalar(rDir, opts.baseRadius));
  const b1 = Vec3.sub(baseCenter, Vec3.mulScalar(rDir, opts.baseRadius));
  return [lineToCubic3(opts.apex, b0), lineToCubic3(opts.apex, b1)];
}
function orthonormalBasisFromNormal(n) {
  const a = Math.abs(n.z) < 0.9 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
  const u = Vec3.normalize(Vec3.cross(a, n));
  const v = Vec3.normalize(Vec3.cross(n, u));
  return { u, v };
}
function circleToCubics3(opts) {
  const start = opts.startAngleRad ?? 0;
  const end = opts.endAngleRad ?? Math.PI * 2;
  const sweep = end - start;
  const maxAngle = opts.maxSegmentAngleRad ?? Math.PI / 2;
  if (!Number.isFinite(maxAngle) || maxAngle <= 0)
    throw new Error("Circle segment angle must be positive and finite");
  const segments = Math.max(
    1,
    Math.ceil(Math.abs(sweep) / Math.min(maxAngle, Math.PI / 2))
  );
  const n = Vec3.normalize(opts.normal);
  const { u, v } = orthonormalBasisFromNormal(n);
  const out = [];
  for (let i = 0; i < segments; i++) {
    const a0 = start + sweep * i / segments;
    const a1 = start + sweep * (i + 1) / segments;
    out.push(arc90ToCubic3(opts.center, u, v, opts.radius, a0, a1));
  }
  return out;
}
function arc90ToCubic3(center, u, v, r, a0, a1) {
  const d = a1 - a0;
  const k = 4 / 3 * Math.tan(d / 4);
  const c0 = Math.cos(a0), s0 = Math.sin(a0);
  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  const p0 = pointOnCircle(center, u, v, r, c0, s0);
  const p3 = pointOnCircle(center, u, v, r, c1, s1);
  const t0 = Vec3.add(Vec3.mulScalar(u, -s0), Vec3.mulScalar(v, c0));
  const t1 = Vec3.add(Vec3.mulScalar(u, -s1), Vec3.mulScalar(v, c1));
  const p1 = Vec3.add(p0, Vec3.mulScalar(t0, k * r));
  const p2 = Vec3.sub(p3, Vec3.mulScalar(t1, k * r));
  return { p0, p1, p2, p3 };
}
function pointOnCircle(center, u, v, r, c, s) {
  return Vec3.add(
    center,
    Vec3.add(Vec3.mulScalar(u, r * c), Vec3.mulScalar(v, r * s))
  );
}
function basisFromAxis(axisUnit) {
  const helper = Math.abs(axisUnit.z) < 0.9 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
  const u = Vec3.normalize(Vec3.cross(helper, axisUnit));
  const v = Vec3.normalize(Vec3.cross(axisUnit, u));
  return { u, v };
}
function solveQuadratic(a, b, c) {
  const coefficientScale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  if (coefficientScale === 0) return [];
  a /= coefficientScale;
  b /= coefficientScale;
  c /= coefficientScale;
  if (Math.abs(a) <= 1e-14) {
    if (Math.abs(b) <= 1e-14) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  const discError = 1e-14 * (b * b + Math.abs(4 * a * c));
  if (disc < -discError) return [];
  if (Math.abs(disc) <= discError) return [-b / (2 * a)];
  const s = Math.sqrt(Math.max(0, disc));
  const q = -0.5 * (b + Math.sign(b || 1) * s);
  const r0 = q / a;
  const r1 = c / q;
  const roots = [r0, r1].filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  const out = [];
  for (const x of roots) {
    if (out.length === 0 || Math.abs(x - out[out.length - 1]) > 1e-12 * Math.max(1, Math.abs(x)))
      out.push(x);
  }
  return out;
}
function quadraticTrigRoots(valueAt) {
  const f0 = valueAt(0);
  const f1 = valueAt(Math.PI / 2);
  const f2 = valueAt(Math.PI);
  const f3 = valueAt(3 * Math.PI / 2);
  const c0 = (f0 + f1 + f2 + f3) / 4;
  const c1 = (f0 - f2) / 2;
  const s1 = (f1 - f3) / 2;
  const c2 = (f0 + f2 - f1 - f3) / 4;
  const s2 = valueAt(Math.PI / 4) - c0 - (c1 + s1) / Math.SQRT2;
  const scale = Math.max(
    Math.abs(c0),
    Math.abs(c1),
    Math.abs(s1),
    Math.abs(c2),
    Math.abs(s2)
  );
  if (scale === 0 || !Number.isFinite(scale)) return [];
  const coefficients = [
    c0 + c1 + c2,
    2 * s1 + 4 * s2,
    2 * c0 - 6 * c2,
    2 * s1 - 4 * s2,
    c0 - c1 + c2
  ].map((coefficient) => coefficient / scale);
  const angles = realPolynomialRoots(coefficients).map((root) => {
    const angle = 2 * Math.atan(root);
    return angle < 0 ? angle + 2 * Math.PI : angle;
  });
  if (Math.abs(f2) <= scale * 1e-12) angles.push(Math.PI);
  return angles.sort((a, b) => a - b).filter(
    (angle, index, all) => index === 0 || angle - all[index - 1] > 1e-10
  );
}
function realPolynomialRoots(coefficientsIn) {
  const coefficients = [...coefficientsIn];
  const scale = Math.max(...coefficients.map(Math.abs));
  if (scale === 0) return [];
  while (coefficients.length > 1 && Math.abs(coefficients.at(-1)) <= scale * 1e-14)
    coefficients.pop();
  const degree = coefficients.length - 1;
  if (degree === 0) return [];
  if (degree === 1) return [-coefficients[0] / coefficients[1]];
  const evaluate = (x) => {
    let value = coefficients[degree];
    for (let i = degree - 1; i >= 0; i--) value = value * x + coefficients[i];
    return value;
  };
  const relativeZero = (x) => {
    let magnitude = Math.abs(coefficients[degree]);
    for (let i = degree - 1; i >= 0; i--)
      magnitude = magnitude * Math.abs(x) + Math.abs(coefficients[i]);
    return Math.abs(evaluate(x)) <= magnitude * 1e-13;
  };
  const stationary = realPolynomialRoots(
    coefficients.slice(1).map((coefficient, i) => coefficient * (i + 1))
  );
  const bound = 1 + Math.max(
    ...coefficients.slice(0, -1).map((coefficient) => Math.abs(coefficient / coefficients[degree]))
  );
  const cuts = [
    -bound,
    ...stationary.filter((x) => x > -bound && x < bound),
    bound
  ];
  const roots = stationary.filter(relativeZero);
  for (let i = 1; i < cuts.length; i++) {
    let left = cuts[i - 1];
    let right = cuts[i];
    let leftValue = evaluate(left);
    if (leftValue === 0) roots.push(left);
    const rightValue = evaluate(right);
    if (rightValue === 0) roots.push(right);
    if (leftValue * rightValue >= 0) continue;
    for (let iteration = 0; iteration < 100; iteration++) {
      const middle = (left + right) / 2;
      const middleValue = evaluate(middle);
      if (middleValue === 0) {
        left = middle;
        right = middle;
        break;
      }
      if (Math.sign(middleValue) === Math.sign(leftValue)) {
        left = middle;
        leftValue = middleValue;
      } else right = middle;
      if (right - left <= 1e-14 * Math.max(1, Math.abs(left), Math.abs(right)))
        break;
    }
    roots.push((left + right) / 2);
  }
  return roots.sort((a, b) => a - b).filter(
    (root, i, all) => i === 0 || Math.abs(root - all[i - 1]) > 1e-10 * Math.max(1, Math.abs(root))
  );
}
function splitRunsByJump(points, maxJumpSq) {
  if (points.length === 0) return [];
  const runs = [];
  let cur = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = cur[cur.length - 1];
    if (Vec3.distanceSq(prev, p) > maxJumpSq) {
      if (cur.length >= 2) runs.push(cur);
      cur = [p];
    } else {
      cur.push(p);
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}
function mergeCyclicRuns(runs, closeEpsSq) {
  if (runs.length < 2) return runs;
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (first.length === 0 || last.length === 0) return runs;
  const a = first[0];
  const b = last[last.length - 1];
  if (Vec3.distanceSq(a, b) <= closeEpsSq) {
    const merged = [...last, ...first];
    return [merged, ...runs.slice(1, -1)];
  }
  return runs;
}
function stitchRunsByEndpoints(runsIn, closeEpsSq) {
  return stitchRunsByEndpointsWithDirection(runsIn, closeEpsSq);
}
function stitchRunsByEndpointsWithDirection(runsIn, closeEpsSq, opts) {
  const minTangentCos = opts?.minTangentCos ?? -1;
  let runs = runsIn.filter((r) => r.length >= 2).map((r) => r.slice());
  if (runs.length < 2) return runs;
  const distSq = (a, b) => Vec3.distanceSq(a, b);
  const head = (r) => r[0];
  const tail = (r) => r[r.length - 1];
  const unit = (v) => {
    const l2 = Vec3.lenSq(v);
    return l2 > 1e-18 ? Vec3.mulScalar(v, 1 / Math.sqrt(l2)) : v;
  };
  const headTan = (r) => unit(Vec3.sub(r[1], r[0]));
  const tailTan = (r) => unit(Vec3.sub(r[r.length - 1], r[r.length - 2]));
  const okDir = (ta, tb) => {
    if (minTangentCos <= -0.999) return true;
    return Vec3.dot(ta, tb) >= minTangentCos;
  };
  while (true) {
    let bestI = -1;
    let bestJ = -1;
    let bestMode = "tail-head";
    let bestD = closeEpsSq;
    for (let i = 0; i < runs.length; i++) {
      for (let j = 0; j < runs.length; j++) {
        if (i === j) continue;
        const ri = runs[i];
        const rj = runs[j];
        const dTH = distSq(tail(ri), head(rj));
        if (dTH <= bestD && okDir(tailTan(ri), headTan(rj))) {
          bestD = dTH;
          bestI = i;
          bestJ = j;
          bestMode = "tail-head";
        }
        const dTT = distSq(tail(ri), tail(rj));
        if (dTT <= bestD && okDir(tailTan(ri), Vec3.mulScalar(tailTan(rj), -1))) {
          bestD = dTT;
          bestI = i;
          bestJ = j;
          bestMode = "tail-tail";
        }
        const dHH = distSq(head(ri), head(rj));
        if (dHH <= bestD && okDir(Vec3.mulScalar(headTan(ri), -1), headTan(rj))) {
          bestD = dHH;
          bestI = i;
          bestJ = j;
          bestMode = "head-head";
        }
        const dHT = distSq(head(ri), tail(rj));
        if (dHT <= bestD && okDir(tailTan(rj), headTan(ri))) {
          bestD = dHT;
          bestI = i;
          bestJ = j;
          bestMode = "head-tail";
        }
      }
    }
    if (bestI < 0 || bestJ < 0) break;
    const a = runs[bestI];
    const b = runs[bestJ];
    let merged;
    if (bestMode === "tail-head") merged = [...a, ...b];
    else if (bestMode === "tail-tail") merged = [...a, ...b.slice().reverse()];
    else if (bestMode === "head-head") merged = [...a.slice().reverse(), ...b];
    else merged = [...b, ...a];
    const next = [];
    for (let k = 0; k < runs.length; k++)
      if (k !== bestI && k !== bestJ) next.push(runs[k]);
    next.push(merged);
    runs = next;
    if (runs.length < 2) break;
  }
  return runs;
}
function tryMergeRunsToSinglePolyline(runs, closeEpsSq) {
  const stitched = stitchRunsByEndpointsWithDirection(runs, closeEpsSq, {
    minTangentCos: 0.25
  });
  if (stitched.length !== 1) return null;
  const only = stitched[0];
  return only.length >= 2 ? only : null;
}
function polylineRunsToLineCubics(runs, closeEpsSq) {
  const out = [];
  for (const pts of runs) {
    for (let i = 0; i < pts.length - 1; i++)
      out.push(lineToCubic3(pts[i], pts[i + 1]));
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Vec3.distanceSq(a, b) <= closeEpsSq) out.push(lineToCubic3(b, a));
  }
  return out;
}
const defaultBezierFitParams = {
  maxError: 0.02,
  maxDepth: 18,
  reparamIters: 1,
  minAlpha: 1e-4,
  closeEps: 1e-3,
  maxAlphaFactor: 1,
  parameterization: "centripetal",
  // Corner splitting is a tradeoff:
  // - too aggressive => many tiny 2-point chunks => looks like straight segments
  // - too weak => hooks may appear near vertices
  // 0.5 = ~60 degrees: only split at genuinely sharp corners
  cornerCos: 0.5
};
function fitPolylineToCubics(pointsIn, params = {}) {
  const p = { ...defaultBezierFitParams, ...params };
  const pts = pointsIn.slice();
  if (pts.length < 2) return [];
  if (Vec3.distanceSq(pts[0], pts[pts.length - 1]) <= p.closeEps * p.closeEps) {
    pts[pts.length - 1] = pts[0];
  }
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i];
    if (Vec3.distanceSq(q, clean[clean.length - 1]) > 1e-16) clean.push(q);
  }
  if (clean.length < 2) return [];
  const minSeg = Math.max(1e-9, medianStep(clean) * 0.85);
  const chunks = splitByCorners(clean, p.cornerCos, minSeg);
  return chunks.flatMap((chunk) => {
    if (chunk.length < 2) return [];
    const tanL = endpointTangentLeft(chunk);
    const tanR = endpointTangentRight(chunk);
    return fitCubicRecursive(chunk, tanL, tanR, p.maxError, p, 0);
  });
}
function medianStep(pts) {
  const ds = [];
  for (let i = 1; i < pts.length; i++)
    ds.push(Vec3.distance(pts[i - 1], pts[i]));
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length / 2)] ?? 0;
}
function splitByCorners(pts, cornerCos, minSeg) {
  if (pts.length < 3) return [pts];
  const out = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const ab = Vec3.sub(b, a);
    const bc = Vec3.sub(c, b);
    const lab = Vec3.len(ab);
    const lbc = Vec3.len(bc);
    cur.push(b);
    if (lab < minSeg || lbc < minSeg) continue;
    const cos = Vec3.dot(ab, bc) / (lab * lbc);
    if (cos < cornerCos) {
      out.push(cur);
      cur = [b];
    }
  }
  cur.push(pts[pts.length - 1]);
  out.push(cur);
  return out.filter((x) => x.length >= 2);
}
function fitCubicRecursive(pts, tanL, tanR, maxError, p, depth) {
  const nPts = pts.length;
  if (nPts === 2) {
    const p0 = pts[0];
    const p3 = pts[1];
    const d = Vec3.sub(p3, p0);
    return [
      {
        p0,
        p1: Vec3.add(p0, Vec3.mulScalar(d, 1 / 3)),
        p2: Vec3.add(p0, Vec3.mulScalar(d, 2 / 3)),
        p3
      }
    ];
  }
  let u = polylineParams(pts, p.parameterization);
  let bez = generateBezier(pts, u, tanL, tanR, p);
  let { maxDist, splitIndex } = maxErrorPoint(pts, u, bez);
  if (maxDist <= maxError) return [bez];
  if (depth >= p.maxDepth) return [bez];
  if (p.reparamIters > 0) {
    for (let iter = 0; iter < p.reparamIters; iter++) {
      u = reparameterize(pts, u, bez);
      bez = generateBezier(pts, u, tanL, tanR, p);
      const e = maxErrorPoint(pts, u, bez);
      maxDist = e.maxDist;
      splitIndex = e.splitIndex;
      if (maxDist <= maxError) return [bez];
    }
  }
  const leftPts = pts.slice(0, splitIndex + 1);
  const rightPts = pts.slice(splitIndex);
  const tanM = centerTangent(pts, splitIndex);
  return [
    // Left curve: tanL = forward (inherited), tanR = backward (-tanM)
    ...fitCubicRecursive(
      leftPts,
      tanL,
      Vec3.mulScalar(tanM, -1),
      maxError,
      p,
      depth + 1
    ),
    // Right curve: tanL = forward (tanM), tanR = backward (inherited)
    ...fitCubicRecursive(rightPts, tanM, tanR, maxError, p, depth + 1)
  ];
}
function polylineParams(pts, parameterization) {
  const u = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const distance = Vec3.distance(pts[i], pts[i - 1]);
    total += parameterization === "chordLength" ? distance : Math.sqrt(distance);
    u.push(total);
  }
  if (total <= 1e-12) return u.map(() => 0);
  return u.map((x) => x / total);
}
function centerTangent(pts, i) {
  const p0 = pts[Math.max(0, i - 1)];
  const p2 = pts[Math.min(pts.length - 1, i + 1)];
  return Vec3.normalize(Vec3.sub(p2, p0));
}
function generateBezier(pts, u, tanL, tanR, p) {
  const p0 = pts[0];
  const p3 = pts[pts.length - 1];
  let c00 = 0, c01 = 0, c11 = 0;
  let x0 = 0, x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i];
    const b0 = B0(t);
    const b1 = B1(t);
    const b2 = B2(t);
    const b3 = B3(t);
    const a1 = Vec3.mulScalar(tanL, b1);
    const a2 = Vec3.mulScalar(tanR, b2);
    c00 += Vec3.dot(a1, a1);
    c01 += Vec3.dot(a1, a2);
    c11 += Vec3.dot(a2, a2);
    const tmp = Vec3.sub(
      pts[i],
      Vec3.add(Vec3.mulScalar(p0, b0 + b1), Vec3.mulScalar(p3, b2 + b3))
    );
    x0 += Vec3.dot(a1, tmp);
    x1 += Vec3.dot(a2, tmp);
  }
  let alphaL = 0;
  let alphaR = 0;
  const det = c00 * c11 - c01 * c01;
  if (Math.abs(det) > 1e-12) {
    alphaL = (x0 * c11 - x1 * c01) / det;
    alphaR = (c00 * x1 - c01 * x0) / det;
  }
  const segLen = Vec3.distance(p0, p3);
  const eps = p.minAlpha;
  if (alphaL < eps || alphaR < eps) {
    const a = Math.max(eps, segLen / 3);
    alphaL = a;
    alphaR = a;
  }
  const maxAlpha = Math.max(eps, segLen * p.maxAlphaFactor);
  alphaL = clamp(alphaL, eps, maxAlpha);
  alphaR = clamp(alphaR, eps, maxAlpha);
  let p1 = Vec3.add(p0, Vec3.mulScalar(tanL, alphaL));
  let p2 = Vec3.add(p3, Vec3.mulScalar(tanR, alphaR));
  const chord = Vec3.sub(p3, p0);
  const chordLen = Vec3.len(chord);
  if (chordLen > 1e-12) {
    const d = Vec3.mulScalar(chord, 1 / chordLen);
    const maxSide = chordLen * 0.3;
    const v1 = Vec3.sub(p1, p0);
    let s1 = Vec3.dot(v1, d);
    s1 = clamp(s1, eps, maxAlpha);
    const side1 = Vec3.sub(v1, Vec3.mulScalar(d, s1));
    const side1Len = Math.sqrt(Vec3.lenSq(side1));
    const side1Clamped = side1Len > maxSide ? Vec3.mulScalar(side1, maxSide / Math.max(1e-12, side1Len)) : side1;
    p1 = Vec3.add(p0, Vec3.add(Vec3.mulScalar(d, s1), side1Clamped));
    const v2 = Vec3.sub(p2, p3);
    let s2 = -Vec3.dot(v2, d);
    s2 = clamp(s2, eps, maxAlpha);
    const side2 = Vec3.add(v2, Vec3.mulScalar(d, s2));
    const side2Len = Math.sqrt(Vec3.lenSq(side2));
    const side2Clamped = side2Len > maxSide ? Vec3.mulScalar(side2, maxSide / Math.max(1e-12, side2Len)) : side2;
    p2 = Vec3.add(p3, Vec3.add(Vec3.mulScalar(d, -s2), side2Clamped));
  }
  return { p0, p1, p2, p3 };
}
function reparameterize(pts, u, bez) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(newtonRaphson(bez, pts[i], u[i]));
  }
  return out;
}
function newtonRaphson(bez, p, u) {
  const q = evalBezier(bez, u);
  const q1 = evalBezierDer1(bez, u);
  const q2 = evalBezierDer2(bez, u);
  const diff = Vec3.sub(q, p);
  const num = Vec3.dot(diff, q1);
  const den = Vec3.dot(q1, q1) + Vec3.dot(diff, q2);
  if (Math.abs(den) <= 1e-12) return u;
  const u2 = u - num / den;
  return u2 < 0 ? 0 : u2 > 1 ? 1 : u2;
}
function maxErrorPoint(pts, u, bez) {
  let maxDist = 0;
  let splitIndex = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const q = evalBezier(bez, u[i]);
    const d = Vec3.distance(q, pts[i]);
    if (d > maxDist) {
      maxDist = d;
      splitIndex = i;
    }
  }
  return { maxDist, splitIndex };
}
function evalBezier(b, t) {
  const b0 = B0(t), b1 = B1(t), b2 = B2(t), b3 = B3(t);
  return Vec3.add(
    Vec3.add(Vec3.mulScalar(b.p0, b0), Vec3.mulScalar(b.p1, b1)),
    Vec3.add(Vec3.mulScalar(b.p2, b2), Vec3.mulScalar(b.p3, b3))
  );
}
function evalBezierDer1(b, t) {
  const mt = 1 - t;
  const a = Vec3.mulScalar(Vec3.sub(b.p1, b.p0), mt * mt);
  const c = Vec3.mulScalar(Vec3.sub(b.p2, b.p1), 2 * mt * t);
  const d = Vec3.mulScalar(Vec3.sub(b.p3, b.p2), t * t);
  return Vec3.mulScalar(Vec3.add(Vec3.add(a, c), d), 3);
}
function evalBezierDer2(b, t) {
  const mt = 1 - t;
  const a = Vec3.add(Vec3.sub(b.p2, Vec3.mulScalar(b.p1, 2)), b.p0);
  const c = Vec3.add(Vec3.sub(b.p3, Vec3.mulScalar(b.p2, 2)), b.p1);
  return Vec3.mulScalar(
    Vec3.add(Vec3.mulScalar(a, mt), Vec3.mulScalar(c, t)),
    6
  );
}
function B0(t) {
  const mt = 1 - t;
  return mt * mt * mt;
}
function B1(t) {
  const mt = 1 - t;
  return 3 * mt * mt * t;
}
function B2(t) {
  const mt = 1 - t;
  return 3 * mt * t * t;
}
function B3(t) {
  return t * t * t;
}
function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}
function endpointTangentLeft(pts) {
  const p0 = pts[0];
  const k = Math.min(4, pts.length - 1);
  let acc = Vec3.zero();
  for (let i = 1; i <= k; i++) {
    acc = Vec3.add(acc, Vec3.sub(pts[i], p0));
  }
  const t = Vec3.normalize(acc);
  return Vec3.lenSq(t) > 1e-18 ? t : Vec3.normalize(Vec3.sub(pts[1], pts[0]));
}
function endpointTangentRight(pts) {
  const pN = pts[pts.length - 1];
  const k = Math.min(4, pts.length - 1);
  let acc = Vec3.zero();
  for (let i = 1; i <= k; i++) {
    acc = Vec3.add(acc, Vec3.sub(pts[pts.length - 1 - i], pN));
  }
  const t = Vec3.normalize(acc);
  return Vec3.lenSq(t) > 1e-18 ? t : Vec3.normalize(Vec3.sub(pts[pts.length - 2], pts[pts.length - 1]));
}
function traceQuadraticIntersection(options) {
  const { equation, maxParameter, tolerance } = options;
  if (!(maxParameter > 0)) return [];
  const tau = 2 * Math.PI;
  const criticalEquations = [
    (theta) => {
      const { a, b, c } = equation(theta);
      return b * b - 4 * a * c;
    },
    (theta) => equation(theta).a,
    (theta) => equation(theta).c,
    (theta) => {
      const { a, b, c } = equation(theta);
      return a * maxParameter * maxParameter + b * maxParameter + c;
    },
    ...options.boundaryEquations ?? []
  ];
  const eventCandidates = [
    { theta: 0, doubleRoot: false },
    ...criticalEquations.flatMap(
      (valueAt, index) => quadraticTrigRoots(valueAt).map((theta) => ({
        theta,
        doubleRoot: index === 0
      }))
    ),
    { theta: tau, doubleRoot: false }
  ].sort((a, b) => a.theta - b.theta);
  const events = [];
  for (const candidate of eventCandidates) {
    const previous = events[events.length - 1];
    if (!previous || candidate.theta - previous.theta > 1e-12)
      events.push(candidate);
    else if (candidate.doubleRoot) {
      previous.doubleRoot = true;
      if (previous.theta !== 0) previous.theta = candidate.theta;
    }
  }
  if (events[events.length - 1].theta < tau)
    events.push({ theta: tau, doubleRoot: false });
  const rootsAt = (theta) => {
    const { a, b, c } = equation(theta);
    return solveQuadratic(
      a * maxParameter * maxParameter,
      b * maxParameter,
      c
    ).map((root) => root * maxParameter);
  };
  const parameterEps = maxParameter * 1e-8;
  const validPoint = (theta, parameter) => {
    if (parameter == null || parameter < -parameterEps || parameter > maxParameter + parameterEps)
      return null;
    const point = options.pointAt(
      theta,
      Math.max(0, Math.min(maxParameter, parameter))
    );
    return options.inside(point) ? point : null;
  };
  const out = [];
  const angularStep = tau / Math.max(32, Math.floor(options.samples));
  for (let interval = 1; interval < events.length; interval++) {
    const leftEvent = events[interval - 1];
    const rightEvent = events[interval];
    const left = leftEvent.theta;
    const right = rightEvent.theta;
    const middle = (left + right) / 2;
    const middleRoots = rootsAt(middle);
    for (let branch = 0; branch < middleRoots.length; branch++) {
      if (!validPoint(middle, middleRoots[branch])) continue;
      const interiorPoint = (theta) => validPoint(theta, rootsAt(theta)[branch]);
      const boundaryPoint = (theta, nearTheta, doubleRoot) => {
        const reference = rootsAt(nearTheta)[branch];
        if (reference == null) return null;
        const { a, b, c } = equation(theta);
        const an = a * maxParameter * maxParameter;
        const bn = b * maxParameter;
        const coefficientScale = Math.max(
          Math.abs(an),
          Math.abs(bn),
          Math.abs(c)
        );
        const discriminant = bn * bn - 4 * an * c;
        const candidates = doubleRoot && Math.abs(an) > coefficientScale * 1e-14 && Math.abs(discriminant) <= coefficientScale * coefficientScale * 1e-11 ? [-bn * maxParameter / (2 * an)] : rootsAt(theta);
        const closest = candidates.reduce(
          (best, root) => best == null || Math.abs(root - reference) < Math.abs(best - reference) ? root : best,
          void 0
        );
        return validPoint(theta, closest);
      };
      const p0 = boundaryPoint(
        left,
        left + (right - left) * 1e-6,
        leftEvent.doubleRoot
      );
      const p3 = boundaryPoint(
        right,
        right - (right - left) * 1e-6,
        rightEvent.doubleRoot
      );
      if (!p0 || !p3) continue;
      const points = [p0];
      const refine = (a, pa, b, pb, depth) => {
        const theta = (a + b) / 2;
        const pm = interiorPoint(theta);
        if (!pm) return false;
        const chordMiddle = Vec3.mulScalar(Vec3.add(pa, pb), 0.5);
        if (depth < 24 && Vec3.distance(pm, chordMiddle) > tolerance * 0.25) {
          if (!refine(a, pa, theta, pm, depth + 1)) return false;
          return refine(theta, pm, b, pb, depth + 1);
        }
        if (Vec3.distanceSq(points[points.length - 1], pb) > tolerance * tolerance * 1e-8)
          points.push(pb);
        return true;
      };
      const segments = Math.max(1, Math.ceil((right - left) / angularStep));
      let previousTheta = left;
      let previousPoint = p0;
      let complete = true;
      for (let segment = 1; segment <= segments; segment++) {
        const theta = left + (right - left) * segment / segments;
        const point = segment === segments ? p3 : interiorPoint(theta);
        if (!point || !refine(previousTheta, previousPoint, theta, point, 0)) {
          complete = false;
          break;
        }
        previousTheta = theta;
        previousPoint = point;
      }
      if (!complete || points.length < 2) continue;
      if (!options.useBezierFit) {
        out.push(...lineCubics(points));
        continue;
      }
      const fitted = fitPolylineToCubics(points, {
        maxError: tolerance * 0.25,
        parameterization: "chordLength",
        reparamIters: 1,
        // Endpoint proximity does not imply a closed intersection. In particular,
        // an open two-point run must not be collapsed to a single point.
        closeEps: 0,
        minAlpha: tolerance * 0.01
      });
      for (const cubic of fitted) {
        let valid = true;
        for (let sample = 0; sample <= 16; sample++) {
          const point = evalCubic3(cubic, sample / 16);
          if (options.surfaceError(point) > tolerance || !options.inside(point)) {
            valid = false;
            break;
          }
        }
        if (valid) out.push(cubic);
        else {
          const start = points.indexOf(cubic.p0);
          const end = points.indexOf(cubic.p3, start + 1);
          if (start >= 0 && end > start)
            out.push(...lineCubics(points.slice(start, end + 1)));
        }
      }
    }
  }
  return out;
}
function lineCubics(points) {
  return points.slice(1).map((point, index) => lineToCubic3(points[index], point));
}
function intersectSphereSphere(s0, s1) {
  const dVec = Vec3.sub(s1.center, s0.center);
  const d = Vec3.len(dVec);
  if (d <= 1e-9 || d > s0.radius + s1.radius || d < Math.abs(s0.radius - s1.radius))
    return [];
  const x = (s0.radius * s0.radius - s1.radius * s1.radius + d * d) / (2 * d);
  const h2 = s0.radius * s0.radius - x * x;
  if (h2 <= 0) return [];
  const normal2 = Vec3.mulScalar(dVec, 1 / d);
  return circleToCubics3({
    center: Vec3.add(s0.center, Vec3.mulScalar(normal2, x)),
    normal: normal2,
    radius: Math.sqrt(h2),
    maxSegmentAngleRad: Math.PI / 4
  });
}
function intersectSphereCylinder(sphere, cylinder, samples, useBezierFit = true, _fitMode = "stitchThenFit") {
  return tracePair(cylinder, sphere, samples, useBezierFit);
}
function intersectSphereCone(sphere, cone, samples, useBezierFit = true, _fitMode = "stitchThenFit") {
  return tracePair(cone, sphere, samples, useBezierFit);
}
function intersectCylinderCylinder(c0, c1, samples, useBezierFit = true, _fitMode = "stitchThenFit") {
  if (Vec3.lenSq(Vec3.cross(c0.axis, c1.axis)) <= 1e-20)
    return parallelCylinderIntersections(c0, c1);
  return tracePair(c0, c1, samples, useBezierFit);
}
function intersectCylinderCone(cylinder, cone, samples, useBezierFit = true, _fitMode = "stitchThenFit") {
  return tracePair(cylinder, cone, samples, useBezierFit);
}
function intersectConeCone(c0, c1, samples, useBezierFit = true, _fitMode = "stitchThenFit") {
  return tracePair(c0, c1, samples, useBezierFit);
}
function tracePair(primary, other, samples, useBezierFit) {
  const surface = angularSurface(primary);
  const equation = (theta) => equationAlongRay(surface.origin(theta), surface.direction(theta), other);
  const scale = Math.max(radiusOf(primary), radiusOf(other));
  const tolerance = Math.max(scale * 2e-5, 1e-10);
  const axialEps = Math.max(
    primary.height,
    other instanceof Sphere ? 0 : other.height,
    scale
  ) * 1e-8;
  const boundaryEquations = other instanceof Sphere ? [] : [0, other.height].map((height) => (theta) => {
    const relativeOrigin = Vec3.sub(
      surface.origin(theta),
      axialOrigin(other)
    );
    const y0 = Vec3.dot(relativeOrigin, other.axis);
    const y1 = Vec3.dot(surface.direction(theta), other.axis);
    const parameterNumerator = height - y0;
    const { a, b, c } = equation(theta);
    return a * parameterNumerator * parameterNumerator + b * parameterNumerator * y1 + c * y1 * y1;
  });
  const curves = traceQuadraticIntersection({
    samples,
    maxParameter: primary.height,
    equation,
    pointAt: (theta, parameter) => Vec3.add(
      surface.origin(theta),
      Vec3.mulScalar(surface.direction(theta), parameter)
    ),
    inside: (point) => insideAxial(point, primary, axialEps) && (other instanceof Sphere || insideAxial(point, other, axialEps)),
    boundaryEquations,
    surfaceError: (point) => Math.max(surfaceDistance(point, primary), surfaceDistance(point, other)),
    tolerance,
    useBezierFit
  });
  return other instanceof Sphere ? curves : [
    ...curves,
    ...degenerateGeneratorIntersections(
      primary,
      other,
      surface,
      equation,
      tolerance
    )
  ];
}
function angularSurface(primitive) {
  const { u, v } = basisFromAxis(primitive.axis);
  const radial = (theta) => Vec3.add(
    Vec3.mulScalar(u, Math.cos(theta)),
    Vec3.mulScalar(v, Math.sin(theta))
  );
  if (primitive instanceof Cylinder) {
    return {
      origin: (theta) => Vec3.add(
        primitive.base,
        Vec3.mulScalar(radial(theta), primitive.radius)
      ),
      direction: () => primitive.axis
    };
  }
  const slope = primitive.baseRadius / primitive.height;
  return {
    origin: () => primitive.apex,
    direction: (theta) => Vec3.add(primitive.axis, Vec3.mulScalar(radial(theta), slope))
  };
}
function equationAlongRay(origin, direction, primitive) {
  if (primitive instanceof Sphere) {
    const relative2 = Vec3.sub(origin, primitive.center);
    return {
      a: Vec3.lenSq(direction),
      b: 2 * Vec3.dot(relative2, direction),
      c: Vec3.lenSq(relative2) - primitive.radius * primitive.radius
    };
  }
  const relative = Vec3.sub(origin, axialOrigin(primitive));
  const y0 = Vec3.dot(relative, primitive.axis);
  const y1 = Vec3.dot(direction, primitive.axis);
  const perpendicularOrigin = Vec3.sub(
    relative,
    Vec3.mulScalar(primitive.axis, y0)
  );
  const perpendicularDirection = Vec3.sub(
    direction,
    Vec3.mulScalar(primitive.axis, y1)
  );
  const slopeSq = primitive instanceof Cone ? (primitive.baseRadius / primitive.height) ** 2 : 0;
  return {
    a: Vec3.lenSq(perpendicularDirection) - slopeSq * y1 * y1,
    b: 2 * (Vec3.dot(perpendicularOrigin, perpendicularDirection) - slopeSq * y0 * y1),
    c: Vec3.lenSq(perpendicularOrigin) - slopeSq * y0 * y0 - (primitive instanceof Cylinder ? primitive.radius * primitive.radius : 0)
  };
}
function axialOrigin(primitive) {
  return primitive instanceof Cylinder ? primitive.base : primitive.apex;
}
function radiusOf(primitive) {
  return primitive instanceof Cone ? primitive.baseRadius : primitive.radius;
}
function insideAxial(point, primitive, eps) {
  const height = Vec3.dot(
    Vec3.sub(point, axialOrigin(primitive)),
    primitive.axis
  );
  return height >= -eps && height <= primitive.height + eps;
}
function surfaceDistance(point, primitive) {
  if (primitive instanceof Sphere)
    return Math.abs(Vec3.distance(point, primitive.center) - primitive.radius);
  const relative = Vec3.sub(point, axialOrigin(primitive));
  const height = Vec3.dot(relative, primitive.axis);
  const radial = Vec3.len(
    Vec3.sub(relative, Vec3.mulScalar(primitive.axis, height))
  );
  if (primitive instanceof Cylinder) return Math.abs(radial - primitive.radius);
  const slope = primitive.baseRadius / primitive.height;
  return Math.abs(radial - slope * height) / Math.sqrt(1 + slope * slope);
}
function parallelCylinderIntersections(c0, c1) {
  const offset = Vec3.sub(c1.base, c0.base);
  const axialOffset = Vec3.dot(offset, c0.axis);
  const perpendicularOffset = Vec3.sub(
    offset,
    Vec3.mulScalar(c0.axis, axialOffset)
  );
  const distance = Vec3.len(perpendicularOffset);
  const eps = Math.max(c0.radius, c1.radius, c0.height, c1.height) * 1e-10;
  if (distance <= eps || distance > c0.radius + c1.radius + eps || distance < Math.abs(c0.radius - c1.radius) - eps)
    return [];
  const along = (c0.radius * c0.radius - c1.radius * c1.radius + distance * distance) / (2 * distance);
  const heightSq = c0.radius * c0.radius - along * along;
  if (heightSq < -eps * Math.max(c0.radius, c1.radius)) return [];
  const c1End = axialOffset + Vec3.dot(c0.axis, c1.axis) * c1.height;
  const start = Math.max(0, Math.min(axialOffset, c1End));
  const end = Math.min(c0.height, Math.max(axialOffset, c1End));
  if (end - start <= eps) return [];
  const u = Vec3.mulScalar(perpendicularOffset, 1 / distance);
  const v = Vec3.normalize(Vec3.cross(c0.axis, u));
  const side = Math.sqrt(Math.max(0, heightSq));
  const offsets = side <= eps ? [0] : [-side, side];
  return offsets.map((lateral) => {
    const radial = Vec3.add(
      Vec3.mulScalar(u, along),
      Vec3.mulScalar(v, lateral)
    );
    const point = Vec3.add(c0.base, radial);
    return lineToCubic3(
      Vec3.add(point, Vec3.mulScalar(c0.axis, start)),
      Vec3.add(point, Vec3.mulScalar(c0.axis, end))
    );
  });
}
function degenerateGeneratorIntersections(primary, other, surface, equation, tolerance) {
  const normalizedEquation = (theta) => {
    const { a, b, c } = equation(theta);
    return [a * primary.height * primary.height, b * primary.height, c];
  };
  const scale = Math.max(
    ...[0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2].flatMap(
      (theta) => normalizedEquation(theta).map(Math.abs)
    )
  );
  if (scale === 0) return [];
  const angles = [
    0,
    ...[0, 1, 2].flatMap(
      (coefficient) => quadraticTrigRoots((theta) => normalizedEquation(theta)[coefficient])
    )
  ].map((theta) => theta > 2 * Math.PI - 1e-9 ? 0 : theta).sort((a, b) => a - b).filter((theta, i, all) => i === 0 || theta - all[i - 1] > 1e-9);
  return angles.flatMap((theta) => {
    if (normalizedEquation(theta).some(
      (coefficient) => Math.abs(coefficient) > scale * 1e-11
    ))
      return [];
    const origin = surface.origin(theta);
    const direction = surface.direction(theta);
    const offset = Vec3.dot(Vec3.sub(origin, axialOrigin(other)), other.axis);
    const rate = Vec3.dot(direction, other.axis);
    let start = 0;
    let end = primary.height;
    if (Math.abs(rate) <= 1e-12) {
      if (offset < 0 || offset > other.height) return [];
    } else {
      const t0 = -offset / rate;
      const t1 = (other.height - offset) / rate;
      start = Math.max(start, Math.min(t0, t1));
      end = Math.min(end, Math.max(t0, t1));
    }
    if (!(end > start)) return [];
    const p0 = Vec3.add(origin, Vec3.mulScalar(direction, start));
    const p3 = Vec3.add(origin, Vec3.mulScalar(direction, end));
    if (surfaceDistance(p0, other) > tolerance || surfaceDistance(p3, other) > tolerance)
      return [];
    return [lineToCubic3(p0, p3)];
  });
}
function intersectPlaneRectPlaneRect(p0, p1) {
  const n0 = p0.normal;
  const n1 = p1.normal;
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);
  if (dirLenSq <= 1e-12) return [];
  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq));
  const d0 = Vec3.dot(n0, p0.center);
  const d1 = Vec3.dot(n1, p1.center);
  const a = Vec3.sub(Vec3.mulScalar(n1, d0), Vec3.mulScalar(n0, d1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);
  const i0 = clipLineToRect$1(x0, dir, p0);
  if (!i0) return [];
  const i1 = clipLineToRect$1(x0, dir, p1);
  if (!i1) return [];
  const tMin = Math.max(i0.tMin, i1.tMin);
  const tMax = Math.min(i0.tMax, i1.tMax);
  if (tMax < tMin) return [];
  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}
function clipLineToRect$1(x0, dir, r) {
  let tMin = -Number.POSITIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;
  const c = r.center;
  const rel = Vec3.sub(x0, c);
  const du0 = Vec3.dot(rel, r.u);
  const du1 = Vec3.dot(dir, r.u);
  const dv0 = Vec3.dot(rel, r.v);
  const dv1 = Vec3.dot(dir, r.v);
  const uInt = slab1D$1(du0, du1, r.halfWidth);
  if (!uInt) return null;
  const vInt = slab1D$1(dv0, dv1, r.halfHeight);
  if (!vInt) return null;
  tMin = Math.max(tMin, uInt.tMin, vInt.tMin);
  tMax = Math.min(tMax, uInt.tMax, vInt.tMax);
  if (tMax < tMin) return null;
  return { tMin, tMax };
}
function slab1D$1(x0, dx, half) {
  if (Math.abs(dx) <= 1e-12) {
    if (Math.abs(x0) > half) return null;
    return { tMin: -Number.POSITIVE_INFINITY, tMax: Number.POSITIVE_INFINITY };
  }
  const t0 = (-half - x0) / dx;
  const t1 = (half - x0) / dx;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}
function derivedCapDisks(primitives) {
  const out = [];
  for (const p of primitives) {
    if (p instanceof Cylinder) {
      const base = new Disk(`${p.id}:cap:base`, p.base, p.axis, p.radius);
      const topC = Vec3.add(p.base, Vec3.mulScalar(p.axis, p.height));
      const top = new Disk(`${p.id}:cap:top`, topC, p.axis, p.radius);
      out.push(base, top);
      continue;
    }
    if (p instanceof Cone) {
      const baseC = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(new Disk(`${p.id}:cap:base`, baseC, p.axis, p.baseRadius));
      continue;
    }
  }
  return out;
}
function intersectDiskDisk(d0, d1) {
  const n0 = d0.normal;
  const n1 = d1.normal;
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);
  if (dirLenSq <= 1e-12) {
    const planeDist = Math.abs(Vec3.dot(n0, Vec3.sub(d1.center, d0.center)));
    if (planeDist > 1e-6) return [];
    return intersectCoplanarDisksAsCircleCircle(d0, d1);
  }
  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq));
  const dEq0 = Vec3.dot(n0, d0.center);
  const dEq1 = Vec3.dot(n1, d1.center);
  const a = Vec3.sub(Vec3.mulScalar(n1, dEq0), Vec3.mulScalar(n0, dEq1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);
  const i0 = clipLineToDisk$1(x0, dir, d0);
  if (!i0) return [];
  const i1 = clipLineToDisk$1(x0, dir, d1);
  if (!i1) return [];
  const tMin = Math.max(i0.tMin, i1.tMin);
  const tMax = Math.min(i0.tMax, i1.tMax);
  if (tMax < tMin) return [];
  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}
function clipLineToDisk$1(x0, dir, d) {
  const m = Vec3.sub(x0, d.center);
  const b = 2 * Vec3.dot(m, dir);
  const c = Vec3.dot(m, m) - d.radius * d.radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / 2;
  const t1 = (-b + s) / 2;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}
function intersectCoplanarDisksAsCircleCircle(d0, d1) {
  const n = Vec3.normalize(d0.normal);
  const { u, v } = basisFromAxis(n);
  const c0 = d0.center;
  const c1 = d1.center;
  const r0 = d0.radius;
  const r1 = d1.radius;
  const dc = Vec3.sub(c1, c0);
  const x = Vec3.dot(dc, u);
  const y = Vec3.dot(dc, v);
  const dist = Math.hypot(x, y);
  if (dist <= 1e-9 && Math.abs(r0 - r1) <= 1e-9) return [];
  if (dist > r0 + r1 + 1e-7) return [];
  if (dist < Math.abs(r0 - r1) - 1e-7) return [];
  if (dist <= 1e-9) return [];
  const a = (r0 * r0 - r1 * r1 + dist * dist) / (2 * dist);
  const h2 = r0 * r0 - a * a;
  const ex = x / dist;
  const ey = y / dist;
  const px = a * ex;
  const py = a * ey;
  const base = Vec3.add(c0, Vec3.add(Vec3.mulScalar(u, px), Vec3.mulScalar(v, py)));
  const markerSize = 0.03 * Math.max(0.1, Math.min(r0, r1));
  if (Math.abs(h2) <= 1e-8) {
    return markerAt$1(base, u, v, markerSize);
  }
  const h = Math.sqrt(Math.max(0, h2));
  const ox = -ey * h;
  const oy = ex * h;
  const pA = Vec3.add(base, Vec3.add(Vec3.mulScalar(u, ox), Vec3.mulScalar(v, oy)));
  const pB = Vec3.sub(base, Vec3.add(Vec3.mulScalar(u, ox), Vec3.mulScalar(v, oy)));
  return [...markerAt$1(pA, u, v, markerSize), ...markerAt$1(pB, u, v, markerSize)];
}
function markerAt$1(p, u, v, s) {
  const a0 = Vec3.sub(p, Vec3.mulScalar(u, s));
  const a1 = Vec3.add(p, Vec3.mulScalar(u, s));
  const b0 = Vec3.sub(p, Vec3.mulScalar(v, s));
  const b1 = Vec3.add(p, Vec3.mulScalar(v, s));
  return [lineToCubic3(a0, a1), lineToCubic3(b0, b1)];
}
function planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved, opts) {
  const angularSamples = Math.max(32, Math.floor(opts?.angularSamples ?? 160));
  const useBezierFit = opts?.useBezierFit ?? true;
  const planes = planeSurfaces.map(toPlaneSurface);
  const out = [];
  for (const pl of planes) {
    for (const obj of curved) {
      if (isCapDiskOf(pl.id, obj.id)) continue;
      const parentId = getCapDiskParentId$1(pl.id);
      const ignorePrimitiveIds = parentId ? [pl.id, obj.id, parentId] : [pl.id, obj.id];
      if (obj instanceof Sphere)
        out.push(
          ...planeSphere(pl, obj, angularSamples, useBezierFit).map((bez) => ({
            bez,
            ignorePrimitiveIds
          }))
        );
      if (obj instanceof Cylinder)
        out.push(
          ...planeCylinder(pl, obj, angularSamples, useBezierFit).map(
            (bez) => ({ bez, ignorePrimitiveIds })
          )
        );
      if (obj instanceof Cone)
        out.push(
          ...planeCone(pl, obj, angularSamples, useBezierFit).map((bez) => ({
            bez,
            ignorePrimitiveIds
          }))
        );
    }
  }
  return out;
}
function isCapDiskOf(diskId, primitiveId) {
  return diskId.startsWith(`${primitiveId}:cap:`);
}
function getCapDiskParentId$1(diskId) {
  const capIdx = diskId.indexOf(":cap:");
  if (capIdx < 0) return null;
  return diskId.slice(0, capIdx);
}
function toPlaneSurface(p) {
  const coordinateEps = Math.max(Math.abs(p.center.x), Math.abs(p.center.y), Math.abs(p.center.z)) * Number.EPSILON * 32;
  if (p instanceof Disk) {
    const eps = Math.max(p.radius * 1e-10, coordinateEps);
    const boundary = (point) => Vec3.distanceSq(point, p.center) - p.radius * p.radius;
    return {
      kind: "disk",
      id: p.id,
      point: p.center,
      normal: p.normal,
      typicalSize: p.radius,
      contains: (point) => boundary(point) <= 2 * p.radius * eps + eps * eps,
      boundaries: [boundary]
    };
  }
  const du = (point) => Vec3.dot(Vec3.sub(point, p.center), p.u);
  const dv = (point) => Vec3.dot(Vec3.sub(point, p.center), p.v);
  return {
    kind: "rect",
    id: p.id,
    point: p.center,
    normal: p.normal,
    typicalSize: Math.max(p.halfWidth, p.halfHeight),
    contains: (point) => Math.abs(du(point)) <= p.halfWidth + Math.max(p.halfWidth * 1e-10, coordinateEps) && Math.abs(dv(point)) <= p.halfHeight + Math.max(p.halfHeight * 1e-10, coordinateEps),
    boundaries: [
      (point) => du(point) - p.halfWidth,
      (point) => du(point) + p.halfWidth,
      (point) => dv(point) - p.halfHeight,
      (point) => dv(point) + p.halfHeight
    ]
  };
}
function planeBoundaryEquations(pl, baseAt, directionAt) {
  return pl.boundaries.map((boundary) => (theta) => {
    const base = baseAt(theta), direction = directionAt(theta);
    const b = Vec3.dot(pl.normal, direction);
    const c = Vec3.dot(pl.normal, Vec3.sub(base, pl.point));
    const f0 = boundary(base), f1 = boundary(Vec3.add(base, direction));
    const fm = boundary(Vec3.sub(base, direction));
    const quadratic = (f1 + fm) / 2 - f0;
    const linear = (f1 - fm) / 2;
    if (pl.kind === "rect") return f0 * b - linear * c;
    return f0 * b * b - linear * c * b + quadratic * c * c;
  });
}
function planeSphere(pl, s, samples, useBezierFit) {
  const n = Vec3.normalize(pl.normal);
  const dist = Vec3.dot(n, Vec3.sub(s.center, pl.point));
  if (Math.abs(dist) > s.radius) return [];
  const center = Vec3.sub(s.center, Vec3.mulScalar(n, dist));
  const radius = Math.sqrt(Math.max(0, s.radius * s.radius - dist * dist));
  if (radius <= s.radius * 1e-10)
    return pl.contains(center) ? markerAt(center, n, Math.max(0.02, pl.typicalSize * 0.02)) : [];
  const { u, v } = basisFromAxis(n);
  const pointAt = (theta) => Vec3.add(
    center,
    Vec3.add(
      Vec3.mulScalar(u, radius * Math.cos(theta)),
      Vec3.mulScalar(v, radius * Math.sin(theta))
    )
  );
  return traceQuadraticIntersection({
    samples,
    maxParameter: 1,
    equation: () => ({ a: 0, b: 1, c: -1 }),
    pointAt,
    inside: pl.contains,
    boundaryEquations: pl.boundaries.map(
      (boundary) => (theta) => boundary(pointAt(theta))
    ),
    surfaceError: (point) => Math.max(
      Math.abs(Vec3.distance(point, s.center) - s.radius),
      Math.abs(Vec3.dot(n, Vec3.sub(point, pl.point)))
    ),
    tolerance: s.radius * 2e-5,
    useBezierFit
  });
}
function planeCylinder(pl, c, samples, useBezierFit) {
  const { u, v } = basisFromAxis(c.axis);
  const baseAt = (theta) => Vec3.add(
    c.base,
    Vec3.add(
      Vec3.mulScalar(u, c.radius * Math.cos(theta)),
      Vec3.mulScalar(v, c.radius * Math.sin(theta))
    )
  );
  const denom = Vec3.dot(pl.normal, c.axis);
  if (Math.abs(denom) <= 1e-12) {
    return quadraticTrigRoots(
      (theta) => Vec3.dot(pl.normal, Vec3.sub(baseAt(theta), pl.point))
    ).flatMap(
      (theta) => clipGenerator(
        pl,
        baseAt(theta),
        Vec3.add(baseAt(theta), Vec3.mulScalar(c.axis, c.height))
      )
    );
  }
  return tracePlaneGenerators(
    pl,
    baseAt,
    () => c.axis,
    c.height,
    Math.max(c.radius, c.height),
    (point) => {
      const offset = Vec3.sub(point, c.base);
      return Math.abs(
        Vec3.len(
          Vec3.sub(offset, Vec3.mulScalar(c.axis, Vec3.dot(offset, c.axis)))
        ) - c.radius
      );
    },
    samples,
    useBezierFit
  );
}
function planeCone(pl, c, samples, useBezierFit) {
  const { u, v } = basisFromAxis(c.axis), slope = c.baseRadius / c.height;
  const directionAt = (theta) => Vec3.add(
    c.axis,
    Vec3.add(
      Vec3.mulScalar(u, slope * Math.cos(theta)),
      Vec3.mulScalar(v, slope * Math.sin(theta))
    )
  );
  const offset = Vec3.dot(pl.normal, Vec3.sub(c.apex, pl.point));
  if (Math.abs(offset) <= Math.max(c.height, c.baseRadius) * 1e-12) {
    return quadraticTrigRoots(
      (theta) => Vec3.dot(pl.normal, directionAt(theta))
    ).flatMap(
      (theta) => clipGenerator(
        pl,
        c.apex,
        Vec3.add(c.apex, Vec3.mulScalar(directionAt(theta), c.height))
      )
    );
  }
  return tracePlaneGenerators(
    pl,
    () => c.apex,
    directionAt,
    c.height,
    Math.max(c.baseRadius, c.height),
    (point) => {
      const d = Vec3.sub(point, c.apex), h = Vec3.dot(d, c.axis);
      return Math.abs(
        Vec3.len(Vec3.sub(d, Vec3.mulScalar(c.axis, h))) - slope * h
      );
    },
    samples,
    useBezierFit
  );
}
function tracePlaneGenerators(pl, baseAt, directionAt, height, scale, surfaceError, samples, useBezierFit) {
  return traceQuadraticIntersection({
    samples,
    maxParameter: height,
    equation: (theta) => ({
      a: 0,
      b: Vec3.dot(pl.normal, directionAt(theta)),
      c: Vec3.dot(pl.normal, Vec3.sub(baseAt(theta), pl.point))
    }),
    pointAt: (theta, parameter) => Vec3.add(baseAt(theta), Vec3.mulScalar(directionAt(theta), parameter)),
    inside: pl.contains,
    boundaryEquations: planeBoundaryEquations(pl, baseAt, directionAt),
    surfaceError: (point) => Math.max(
      surfaceError(point),
      Math.abs(Vec3.dot(pl.normal, Vec3.sub(point, pl.point)))
    ),
    tolerance: scale * 2e-5,
    useBezierFit
  });
}
function clipGenerator(pl, p0, p1) {
  const direction = Vec3.sub(p1, p0);
  const pointAt = (t) => Vec3.add(p0, Vec3.mulScalar(direction, t));
  const cuts = [0, 1];
  for (const boundary of pl.boundaries) {
    const f0 = boundary(p0), f1 = boundary(p1), fm = boundary(pointAt(0.5));
    const a = 2 * f0 + 2 * f1 - 4 * fm;
    cuts.push(
      ...solveQuadratic(a, f1 - f0 - a, f0).filter((t) => t > 0 && t < 1)
    );
  }
  cuts.sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < cuts.length; i++) {
    const left = cuts[i - 1], right = cuts[i];
    if (right - left > 1e-12 && pl.contains(pointAt((left + right) / 2)))
      out.push(lineToCubic3(pointAt(left), pointAt(right)));
  }
  return out;
}
function markerAt(p, normal2, size) {
  const { u, v } = basisFromAxis(Vec3.normalize(normal2));
  const a0 = Vec3.sub(p, Vec3.mulScalar(u, size));
  const a1 = Vec3.add(p, Vec3.mulScalar(u, size));
  const b0 = Vec3.sub(p, Vec3.mulScalar(v, size));
  const b1 = Vec3.add(p, Vec3.mulScalar(v, size));
  return [lineToCubic3(a0, a1), lineToCubic3(b0, b1)];
}
function intersectDiskPlaneRect(d, r, opts) {
  const useBezierFit = opts?.useBezierFit ?? true;
  const fitMode = opts?.fitMode ?? "stitchThenFit";
  const n0 = Vec3.normalize(d.normal);
  const n1 = Vec3.normalize(r.normal);
  const dirRaw = Vec3.cross(n0, n1);
  const dirLenSq = Vec3.lenSq(dirRaw);
  if (dirLenSq <= 1e-12) {
    const planeDist = Math.abs(Vec3.dot(n1, Vec3.sub(d.center, r.center)));
    if (planeDist > 1e-6) return [];
    return intersectCoplanarDiskRect(d, r, useBezierFit, fitMode);
  }
  const dir = Vec3.mulScalar(dirRaw, 1 / Math.sqrt(dirLenSq));
  const d0 = Vec3.dot(n0, d.center);
  const d1 = Vec3.dot(n1, r.center);
  const a = Vec3.sub(Vec3.mulScalar(n1, d0), Vec3.mulScalar(n0, d1));
  const x0 = Vec3.mulScalar(Vec3.cross(a, dirRaw), 1 / dirLenSq);
  const iDisk = clipLineToDisk(x0, dir, d);
  if (!iDisk) return [];
  const iRect = clipLineToRect(x0, dir, r);
  if (!iRect) return [];
  const tMin = Math.max(iDisk.tMin, iRect.tMin);
  const tMax = Math.min(iDisk.tMax, iRect.tMax);
  if (tMax < tMin) return [];
  const A = Vec3.add(x0, Vec3.mulScalar(dir, tMin));
  const B = Vec3.add(x0, Vec3.mulScalar(dir, tMax));
  return [lineToCubic3(A, B)];
}
function clipLineToDisk(x0, dirUnit, d) {
  const m = Vec3.sub(x0, d.center);
  const b = 2 * Vec3.dot(m, dirUnit);
  const c = Vec3.dot(m, m) - d.radius * d.radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / 2;
  const t1 = (-b + s) / 2;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}
function clipLineToRect(x0, dir, r) {
  let tMin = -Number.POSITIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;
  const rel = Vec3.sub(x0, r.center);
  const du0 = Vec3.dot(rel, r.u);
  const du1 = Vec3.dot(dir, r.u);
  const dv0 = Vec3.dot(rel, r.v);
  const dv1 = Vec3.dot(dir, r.v);
  const uInt = slab1D(du0, du1, r.halfWidth);
  if (!uInt) return null;
  const vInt = slab1D(dv0, dv1, r.halfHeight);
  if (!vInt) return null;
  tMin = Math.max(tMin, uInt.tMin, vInt.tMin);
  tMax = Math.min(tMax, uInt.tMax, vInt.tMax);
  if (tMax < tMin) return null;
  return { tMin, tMax };
}
function slab1D(x0, dx, half) {
  if (Math.abs(dx) <= 1e-12) {
    if (Math.abs(x0) > half) return null;
    return { tMin: -Number.POSITIVE_INFINITY, tMax: Number.POSITIVE_INFINITY };
  }
  const t0 = (-half - x0) / dx;
  const t1 = (half - x0) / dx;
  return { tMin: Math.min(t0, t1), tMax: Math.max(t0, t1) };
}
function intersectCoplanarDiskRect(d, r, useBezierFit, fitMode) {
  const n = Vec3.normalize(r.normal);
  const { u, v } = basisFromAxis(n);
  const N = 260;
  const pts = [];
  const step = 2 * Math.PI * d.radius / N;
  const maxJumpSq = step * 10 * (step * 10);
  for (let i = 0; i < N; i++) {
    const th = i / N * Math.PI * 2;
    const p = Vec3.add(d.center, Vec3.add(Vec3.mulScalar(u, d.radius * Math.cos(th)), Vec3.mulScalar(v, d.radius * Math.sin(th))));
    if (rectContains(r, p)) pts.push(p);
  }
  if (pts.length < 2) return [];
  const closeEpsSq = step * 3 * (step * 3);
  const runs = stitchRunsByEndpoints(mergeCyclicRuns(splitRunsByJump(pts, maxJumpSq), closeEpsSq), closeEpsSq);
  if (!useBezierFit) return polylineRunsToLineCubics(runs, closeEpsSq);
  if (fitMode === "stitchThenFit") {
    const merged = tryMergeRunsToSinglePolyline(runs, closeEpsSq);
    if (merged) {
      const maxError2 = step * 0.6;
      return fitPolylineToCubics(merged, { maxError: maxError2, closeEps: step * 3 });
    }
  }
  const maxError = step * 0.6;
  return runs.flatMap((run) => fitPolylineToCubics(run, { maxError, closeEps: step * 3 }));
}
function rectContains(r, p) {
  const d = Vec3.sub(p, r.center);
  const du = Vec3.dot(d, r.u);
  const dv = Vec3.dot(d, r.v);
  return Math.abs(du) <= r.halfWidth + 1e-7 && Math.abs(dv) <= r.halfHeight + 1e-7;
}
function intersectPlaneRectBoxAabb(r, b) {
  const n = Vec3.normalize(r.normal);
  const c = r.center;
  const verts = boxVerts(b);
  const edges = boxEdges(verts);
  const pts = [];
  const coplanarSegs = [];
  for (const [a, bb] of edges) {
    const da = Vec3.dot(n, Vec3.sub(a, c));
    const db = Vec3.dot(n, Vec3.sub(bb, c));
    const ada = Math.abs(da);
    const adb = Math.abs(db);
    if (ada <= 1e-9 && adb <= 1e-9) {
      coplanarSegs.push([a, bb]);
      continue;
    }
    if (da * db > 0) continue;
    const t = da / (da - db);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const p = Vec3.lerp(a, bb, clamp01(t));
    pts.push(p);
  }
  const out = [];
  for (const [a, bb] of coplanarSegs) {
    const clipped = clipSegmentToRectUV(a, bb, r);
    if (clipped) out.push(lineToCubic3(clipped.a, clipped.b));
  }
  const poly = uniquePointsOnPlane(pts, r);
  if (poly.length < 2) return out;
  const ordered = poly.length >= 3 ? orderPolygonOnRectPlane(poly, r) : poly;
  const pairs = ordered.length === 2 ? [[ordered[0], ordered[1]]] : cyclicPairs(ordered);
  for (const [a, bb] of pairs) {
    const clipped = clipSegmentToRectUV(a, bb, r);
    if (!clipped) continue;
    out.push(lineToCubic3(clipped.a, clipped.b));
  }
  return out;
}
function boxVerts(b) {
  const x0 = b.min.x, y0 = b.min.y, z0 = b.min.z;
  const x1 = b.max.x, y1 = b.max.y, z1 = b.max.z;
  return [
    new Vec3(x0, y0, z0),
    new Vec3(x1, y0, z0),
    new Vec3(x0, y1, z0),
    new Vec3(x1, y1, z0),
    new Vec3(x0, y0, z1),
    new Vec3(x1, y0, z1),
    new Vec3(x0, y1, z1),
    new Vec3(x1, y1, z1)
  ];
}
function boxEdges(v) {
  const [v000, v100, v010, v110, v001, v101, v011, v111] = v;
  return [
    [v000, v100],
    [v010, v110],
    [v001, v101],
    [v011, v111],
    [v000, v010],
    [v100, v110],
    [v001, v011],
    [v101, v111],
    [v000, v001],
    [v100, v101],
    [v010, v011],
    [v110, v111]
  ];
}
function uniquePointsOnPlane(points, r) {
  const uv = points.map((p) => {
    const d = Vec3.sub(p, r.center);
    return { p, u: Vec3.dot(d, r.u), v: Vec3.dot(d, r.v) };
  });
  const out = [];
  for (const x of uv) {
    let ok = true;
    for (const y of out) {
      const d = Vec3.sub(y, x.p);
      const du = Vec3.dot(d, r.u);
      const dv = Vec3.dot(d, r.v);
      if (du * du + dv * dv <= 1e-12) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(x.p);
  }
  return out;
}
function orderPolygonOnRectPlane(points, r) {
  const uv = points.map((p) => {
    const d = Vec3.sub(p, r.center);
    return { p, u: Vec3.dot(d, r.u), v: Vec3.dot(d, r.v) };
  });
  const cu = uv.reduce((s, x) => s + x.u, 0) / uv.length;
  const cv = uv.reduce((s, x) => s + x.v, 0) / uv.length;
  uv.sort((a, b) => Math.atan2(a.v - cv, a.u - cu) - Math.atan2(b.v - cv, b.u - cu));
  return uv.map((x) => x.p);
}
function cyclicPairs(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    out.push([points[i], points[(i + 1) % points.length]]);
  }
  return out;
}
function clipSegmentToRectUV(a, b, r) {
  const da = Vec3.sub(a, r.center);
  const db = Vec3.sub(b, r.center);
  const u0 = Vec3.dot(da, r.u);
  const v0 = Vec3.dot(da, r.v);
  const u1 = Vec3.dot(db, r.u);
  const v1 = Vec3.dot(db, r.v);
  let tMin = 0;
  let tMax = 1;
  const uInt = slabSeg1D(u0, u1 - u0, r.halfWidth);
  if (!uInt) return null;
  tMin = Math.max(tMin, uInt.tMin);
  tMax = Math.min(tMax, uInt.tMax);
  if (tMax < tMin) return null;
  const vInt = slabSeg1D(v0, v1 - v0, r.halfHeight);
  if (!vInt) return null;
  tMin = Math.max(tMin, vInt.tMin);
  tMax = Math.min(tMax, vInt.tMax);
  if (tMax < tMin) return null;
  const A = Vec3.lerp(a, b, tMin);
  const B = Vec3.lerp(a, b, tMax);
  return { a: A, b: B };
}
function slabSeg1D(x0, dx, half) {
  if (Math.abs(dx) <= 1e-12) {
    if (Math.abs(x0) > half) return null;
    return { tMin: 0, tMax: 1 };
  }
  const t0 = (-half - x0) / dx;
  const t1 = (half - x0) / dx;
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  return { tMin: Math.max(0, lo), tMax: Math.min(1, hi) };
}
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function intersectBoxAabbBoxAabb(a, b) {
  const fa = boxFacesAsPlaneRects(a, "A");
  const fb = boxFacesAsPlaneRects(b, "B");
  const out = [];
  for (const pa of fa) {
    for (const pb of fb) {
      out.push(...intersectPlaneRectPlaneRect(pa, pb));
    }
  }
  return out;
}
function boxFacesAsPlaneRects(b, tag = "") {
  const x0 = b.min.x, y0 = b.min.y, z0 = b.min.z;
  const x1 = b.max.x, y1 = b.max.y, z1 = b.max.z;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const hx = (x1 - x0) / 2;
  const hy = (y1 - y0) / 2;
  const hz = (z1 - z0) / 2;
  return [
    // +X
    new PlaneRect(`${b.id}:${tag}:face:+x`, new Vec3(x1, cy, cz), new Vec3(1, 0, 0), new Vec3(0, 0, 1), hz, hy),
    // -X
    new PlaneRect(`${b.id}:${tag}:face:-x`, new Vec3(x0, cy, cz), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), hz, hy),
    // +Y
    new PlaneRect(`${b.id}:${tag}:face:+y`, new Vec3(cx, y1, cz), new Vec3(0, 1, 0), new Vec3(1, 0, 0), hx, hz),
    // -Y
    new PlaneRect(`${b.id}:${tag}:face:-y`, new Vec3(cx, y0, cz), new Vec3(0, -1, 0), new Vec3(1, 0, 0), hx, hz),
    // +Z
    new PlaneRect(`${b.id}:${tag}:face:+z`, new Vec3(cx, cy, z1), new Vec3(0, 0, 1), new Vec3(1, 0, 0), hx, hy),
    // -Z
    new PlaneRect(`${b.id}:${tag}:face:-z`, new Vec3(cx, cy, z0), new Vec3(0, 0, -1), new Vec3(1, 0, 0), hx, hy)
  ];
}
function intersectBoxAabbSphereOwned(box, sphere, opts) {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [sphere];
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);
  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, sphere.id]
  }));
}
function intersectBoxAabbCylinderOwned(box, cyl, opts) {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [cyl];
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);
  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, cyl.id]
  }));
}
function intersectBoxAabbConeOwned(box, cone, opts) {
  const faces = boxFacesAsPlaneRects(box, "");
  const curved = [cone];
  const results = planeSurfaceCurvesToOwnedCubics(faces, curved, opts);
  return results.map((r) => ({
    bez: r.bez,
    ignorePrimitiveIds: [box.id, cone.id]
  }));
}
const intersectionCache = /* @__PURE__ */ new WeakMap();
const MAX_CACHED_VARIANTS = 4;
const CACHEABLE_PRIMITIVES = [
  Sphere,
  Cylinder,
  Cone,
  PlaneRect,
  Disk,
  BoxAabb,
  TriangleMesh,
  OrientedBox,
  Csg
].map((type) => ({ type, intersect: type.prototype.intersect }));
function cachedIntersectionCurvesToOwnedCubics(primitives, opts) {
  const geometry = intersectionGeometrySignature(primitives);
  if (geometry === void 0 || !Number.isFinite(opts.angularSamples))
    return freezeOwnedIntersections(
      intersectionCurvesToOwnedCubics(primitives, opts)
    );
  const fingerprint = `${JSON.stringify([opts.angularSamples, opts.useBezierFit ?? true, opts.fitMode ?? "stitchThenFit"])}|${geometry}`;
  const entries = intersectionCache.get(primitives);
  const index = entries?.findIndex((entry) => entry.fingerprint === fingerprint) ?? -1;
  if (entries && index >= 0) {
    const entry = entries[index];
    if (index > 0) {
      entries.splice(index, 1);
      entries.unshift(entry);
    }
    return entry.curves;
  }
  const curves = freezeOwnedIntersections(
    intersectionCurvesToOwnedCubics(primitives, opts)
  );
  const updated = entries ?? [];
  updated.unshift({ fingerprint, curves });
  if (updated.length > MAX_CACHED_VARIANTS) updated.pop();
  if (!entries) intersectionCache.set(primitives, updated);
  return curves;
}
function intersectionGeometrySignature(primitives) {
  const geometry = [];
  for (const p of primitives) {
    const encoded = encodePrimitive(p);
    if (!encoded) return void 0;
    geometry.push(encoded);
  }
  let finite = true;
  const signature = JSON.stringify(geometry, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) finite = false;
    return value;
  });
  return finite ? signature : void 0;
}
function encodePrimitive(p) {
  const vector = (v) => [v.x, v.y, v.z];
  const builtin = CACHEABLE_PRIMITIVES.find(
    ({ type }) => Object.getPrototypeOf(p) === type.prototype
  );
  if (!builtin || p.intersect !== builtin.intersect) return void 0;
  if (p instanceof Sphere) return ["sphere", p.id, vector(p.center), p.radius];
  if (p instanceof Cylinder)
    return [
      "cylinder",
      p.id,
      vector(p.base),
      vector(p.axis),
      p.height,
      p.radius,
      p.caps
    ];
  if (p instanceof Cone)
    return [
      "cone",
      p.id,
      vector(p.apex),
      vector(p.axis),
      p.height,
      p.baseRadius,
      p.k,
      p.cap
    ];
  if (p instanceof PlaneRect)
    return [
      "rect",
      p.id,
      vector(p.center),
      vector(p.normal),
      vector(p.u),
      vector(p.v),
      p.halfWidth,
      p.halfHeight
    ];
  if (p instanceof Disk)
    return ["disk", p.id, vector(p.center), vector(p.normal), p.radius];
  if (p instanceof BoxAabb) return ["box", p.id, vector(p.min), vector(p.max)];
  if (p instanceof TriangleMesh)
    return [
      "mesh",
      p.id,
      p.vertices.map(vector),
      p.triangles,
      vector(p.bounds.min),
      vector(p.bounds.max),
      p.weldEps
    ];
  if (p instanceof OrientedBox)
    return [
      "obb",
      p.id,
      vector(p.center),
      vector(p.halfSize),
      p.axes.map(vector)
    ];
  if (p instanceof Csg) {
    const a = encodePrimitive(p.a);
    const b = encodePrimitive(p.b);
    return a && b ? ["csg", p.id, p.operation, a, b] : void 0;
  }
  return void 0;
}
function freezeOwnedIntersections(curves) {
  const points = /* @__PURE__ */ new Map();
  const copyPoint = (p) => {
    let copy = points.get(p);
    if (!copy) {
      copy = Object.freeze(new Vec3(p.x, p.y, p.z));
      points.set(p, copy);
    }
    return copy;
  };
  return Object.freeze(
    curves.map(
      ({ bez, ignorePrimitiveIds }) => Object.freeze({
        bez: Object.freeze({
          p0: copyPoint(bez.p0),
          p1: copyPoint(bez.p1),
          p2: copyPoint(bez.p2),
          p3: copyPoint(bez.p3)
        }),
        ignorePrimitiveIds: Object.freeze([...ignorePrimitiveIds])
      })
    )
  );
}
function intersectionCurvesToCubics(primitives, opts) {
  return intersectionCurvesToOwnedCubics(primitives, opts).map((x) => x.bez);
}
function intersectionCurvesToOwnedCubics(primitives, opts) {
  const out = [];
  const useBezierFit = opts.useBezierFit ?? true;
  const fitMode = opts.fitMode ?? "stitchThenFit";
  const capDisks = derivedCapDisks(primitives);
  for (let i = 0; i < capDisks.length; i++) {
    for (let j = i + 1; j < capDisks.length; j++) {
      const a = capDisks[i];
      const b = capDisks[j];
      const ignorePrimitiveIds = buildIgnorePrimitiveIds([a.id, b.id]);
      out.push(
        ...intersectDiskDisk(a, b).map((bez) => ({ bez, ignorePrimitiveIds }))
      );
    }
  }
  const planeRects = primitives.filter(
    (p) => p instanceof PlaneRect
  );
  const explicitDisks = primitives.filter((p) => p instanceof Disk);
  const planeSurfaces = [
    ...capDisks,
    ...explicitDisks,
    ...planeRects
  ];
  const curved = primitives.filter(
    (p) => p instanceof Sphere || p instanceof Cylinder || p instanceof Cone
  );
  out.push(
    ...planeSurfaceCurvesToOwnedCubics(planeSurfaces, curved, {
      angularSamples: opts.angularSamples,
      useBezierFit
    })
  );
  const allDisks = [...capDisks, ...explicitDisks];
  for (const d of allDisks) {
    for (const r of planeRects) {
      const ignorePrimitiveIds = buildIgnorePrimitiveIds([d.id, r.id]);
      out.push(
        ...intersectDiskPlaneRect(d, r, { useBezierFit, fitMode }).map(
          (bez) => ({ bez, ignorePrimitiveIds })
        )
      );
    }
  }
  const boxes = primitives.filter((p) => p instanceof BoxAabb);
  for (const r of planeRects) {
    for (const b of boxes) {
      const ignorePrimitiveIds = [r.id, b.id];
      out.push(
        ...intersectPlaneRectBoxAabb(r, b).map((bez) => ({
          bez,
          ignorePrimitiveIds
        }))
      );
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ignorePrimitiveIds = [a.id, b.id];
      out.push(
        ...intersectBoxAabbBoxAabb(a, b).map((bez) => ({
          bez,
          ignorePrimitiveIds
        }))
      );
    }
  }
  const spheres = primitives.filter((p) => p instanceof Sphere);
  for (const box of boxes) {
    for (const sphere of spheres) {
      out.push(
        ...intersectBoxAabbSphereOwned(box, sphere, { useBezierFit })
      );
    }
  }
  const cylinders = primitives.filter(
    (p) => p instanceof Cylinder
  );
  for (const box of boxes) {
    for (const cyl of cylinders) {
      out.push(
        ...intersectBoxAabbCylinderOwned(box, cyl, { useBezierFit })
      );
    }
  }
  const cones = primitives.filter((p) => p instanceof Cone);
  for (const box of boxes) {
    for (const cone of cones) {
      out.push(
        ...intersectBoxAabbConeOwned(box, cone, { useBezierFit })
      );
    }
  }
  for (let i = 0; i < primitives.length; i++) {
    for (let j = i + 1; j < primitives.length; j++) {
      const a = primitives[i];
      const b = primitives[j];
      const ignorePrimitiveIds = [a.id, b.id];
      if (a instanceof Sphere && b instanceof Sphere) {
        out.push(
          ...intersectSphereSphere(a, b).map((bez) => ({
            bez,
            ignorePrimitiveIds
          }))
        );
        continue;
      }
      if (a instanceof Sphere && b instanceof Cylinder) {
        out.push(
          ...intersectSphereCylinder(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (b instanceof Sphere && a instanceof Cylinder) {
        out.push(
          ...intersectSphereCylinder(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (a instanceof Sphere && b instanceof Cone) {
        out.push(
          ...intersectSphereCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (b instanceof Sphere && a instanceof Cone) {
        out.push(
          ...intersectSphereCone(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cylinder) {
        out.push(
          ...intersectCylinderCylinder(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (a instanceof Cylinder && b instanceof Cone) {
        out.push(
          ...intersectCylinderCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (b instanceof Cylinder && a instanceof Cone) {
        out.push(
          ...intersectCylinderCone(
            b,
            a,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (a instanceof Cone && b instanceof Cone) {
        out.push(
          ...intersectConeCone(
            a,
            b,
            opts.angularSamples,
            useBezierFit,
            fitMode
          ).map((bez) => ({ bez, ignorePrimitiveIds }))
        );
        continue;
      }
      if (a instanceof PlaneRect && b instanceof PlaneRect) {
        out.push(
          ...intersectPlaneRectPlaneRect(a, b).map((bez) => ({
            bez,
            ignorePrimitiveIds
          }))
        );
        continue;
      }
    }
  }
  const orientedBoxes = primitives.filter(
    (p) => p instanceof OrientedBox
  );
  orientedBoxes.forEach((box, index) => {
    const faces = box.faces();
    const owned = (bez, other) => ({
      bez,
      ignorePrimitiveIds: buildIgnorePrimitiveIds([box.id, other])
    });
    for (const obj of curved)
      out.push(
        ...planeSurfaceCurvesToOwnedCubics(faces, [obj], {
          angularSamples: opts.angularSamples,
          useBezierFit
        }).map((x) => owned(x.bez, obj.id))
      );
    for (const face of faces) {
      for (const rect of planeRects)
        out.push(
          ...intersectPlaneRectPlaneRect(face, rect).map(
            (bez) => owned(bez, rect.id)
          )
        );
      for (const disk of allDisks)
        out.push(
          ...intersectDiskPlaneRect(disk, face, { useBezierFit, fitMode }).map(
            (bez) => owned(bez, disk.id)
          )
        );
    }
    const otherFaces = [
      ...boxes.map(
        (other) => [other.id, boxFacesAsPlaneRects(other, "B")]
      ),
      ...orientedBoxes.slice(index + 1).map((other) => [other.id, other.faces("B")])
    ];
    for (const [otherId, others] of otherFaces)
      for (const face of faces)
        for (const other of others)
          out.push(
            ...intersectPlaneRectPlaneRect(face, other).map(
              (bez) => owned(bez, otherId)
            )
          );
  });
  const csgs = primitives.filter((p) => p instanceof Csg);
  const boundary = (solid) => {
    const tolerance = solid.size() * CSG_TOLERANCE;
    return (p) => solid.classify(p, tolerance) === 0;
  };
  csgs.forEach((solid, index) => {
    const onSolid = boundary(solid);
    for (const other of primitives) {
      if (other === solid || other instanceof Csg) continue;
      for (const leaf of solid.leaves())
        for (const x of intersectionCurvesToOwnedCubics([leaf, other], opts))
          for (const bez of splitCubicWhere(x.bez, onSolid))
            out.push({
              bez,
              ignorePrimitiveIds: buildIgnorePrimitiveIds([
                solid.id,
                ...x.ignorePrimitiveIds
              ])
            });
    }
    for (const other of csgs.slice(index + 1)) {
      const onOther = boundary(other);
      for (const a of solid.leaves())
        for (const b of other.leaves())
          for (const x of intersectionCurvesToOwnedCubics([a, b], opts))
            for (const bez of splitCubicWhere(
              x.bez,
              (p) => onSolid(p) && onOther(p)
            ))
              out.push({ bez, ignorePrimitiveIds: [solid.id, other.id] });
    }
  });
  return out;
}
function buildIgnorePrimitiveIds(ids) {
  const out = new Set(ids);
  for (const id of ids) {
    const parentId = getCapDiskParentId(id);
    if (parentId) out.add(parentId);
  }
  return [...out];
}
function getCapDiskParentId(diskId) {
  const capIdx = diskId.indexOf(":cap:");
  if (capIdx < 0) return null;
  return diskId.slice(0, capIdx);
}
function findVisibilityCutsOnCubic(b, scene, params, ignorePrimitiveIds) {
  return findVisibilityCutsOnCubicWithVisibility(
    b,
    scene,
    params,
    ignorePrimitiveIds
  ).cuts;
}
function findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds) {
  const samples = Math.max(2, Math.floor(params.samples));
  const sampleVisibility = (t) => scene.visibleAtPoint(evalCubic3(b, t), {
    eps: params.epsVisible,
    ignorePrimitiveIds
  });
  const coarseN = Math.max(0, Math.floor(params.coarseSamples ?? 0));
  const coarseSamples = coarseN >= 2 ? Math.min(coarseN, samples) : 0;
  if (coarseSamples >= 2) {
    let prev2 = sampleVisibility(0);
    let any = false;
    for (let i = 1; i <= coarseSamples; i++) {
      const t = i / coarseSamples;
      const v = sampleVisibility(t);
      if (v !== prev2) any = true;
      prev2 = v;
    }
    if (!any) {
      const vMid = sampleVisibility(0.5);
      return { cuts: [], segmentVisible: [vMid] };
    }
  }
  const vis = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    vis.push(sampleVisibility(t));
  }
  const visSmooth = vis.slice();
  for (let i = 1; i < visSmooth.length - 1; i++) {
    const prev2 = vis[i - 1];
    const mid = vis[i];
    const next = vis[i + 1];
    if (prev2 !== next || mid === prev2) continue;
    const step = 1 / samples;
    const tMid = i / samples;
    const leftProbe = sampleVisibility(clamp01$1(tMid - step * 0.25));
    const rightProbe = sampleVisibility(clamp01$1(tMid + step * 0.25));
    if (leftProbe === prev2 && rightProbe === prev2) {
      visSmooth[i] = prev2;
    }
  }
  const cuts = [];
  for (let i = 1; i <= samples; i++) {
    const v0 = visSmooth[i - 1];
    const v1 = visSmooth[i];
    if (v0 === v1) continue;
    const t0 = (i - 1) / samples;
    const t1 = i / samples;
    const tStar = refineCutBisection(
      b,
      scene,
      params,
      t0,
      t1,
      v0,
      ignorePrimitiveIds
    );
    cuts.push(tStar);
  }
  const sorted = cuts.map(clamp01$1).sort((a, b2) => a - b2);
  const deduped = dedupeSorted(sorted, params.cutEps);
  const finalCuts = deduped.filter(
    (t) => t > params.cutEps && t < 1 - params.cutEps
  );
  const sampleAt = (t) => {
    const tt = clamp01$1(t);
    const idx = Math.max(0, Math.min(samples, Math.round(tt * samples)));
    return visSmooth[idx] ?? true;
  };
  const segmentVisible = [];
  if (finalCuts.length === 0) {
    segmentVisible.push(sampleAt(0.5));
    return { cuts: finalCuts, segmentVisible };
  }
  let prev = 0;
  for (const c of finalCuts) {
    segmentVisible.push(sampleAt((prev + c) / 2));
    prev = c;
  }
  segmentVisible.push(sampleAt((prev + 1) / 2));
  return { cuts: finalCuts, segmentVisible };
}
function refineCutBisection(b, scene, params, tLo, tHi, visLo, ignorePrimitiveIds) {
  let lo = tLo;
  let hi = tHi;
  for (let i = 0; i < params.refineIters; i++) {
    const mid = (lo + hi) / 2;
    const p = evalCubic3(b, mid);
    const v = scene.visibleAtPoint(p, {
      eps: params.epsVisible,
      ignorePrimitiveIds
    });
    if (v === visLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function refineVisibilityCutBisection(b, scene, params, tLo, tHi, visLo, ignorePrimitiveIds) {
  return refineCutBisection(
    b,
    scene,
    params,
    tLo,
    tHi,
    visLo,
    ignorePrimitiveIds
  );
}
const VERY_SHORT_EDGE_SINGLE_VIS_PX = 2.5;
const SHORT_EDGE_FAST_PATH_PX = 10;
function splitCubicByVisibility(b, scene, params) {
  return splitCubicByVisibilityWithIgnore(b, scene, params);
}
function splitCubicByVisibilityWithIgnore(b, scene, params, ignorePrimitiveIds) {
  const { cuts, segmentVisible } = findVisibilityCutsOnCubicWithVisibility(b, scene, params, ignorePrimitiveIds);
  const out = [];
  let current = b;
  let prevCut = 0;
  let segIdx = 0;
  for (const cut of cuts) {
    const localT = (cut - prevCut) / (1 - prevCut);
    const { left, right } = splitCubic3(current, localT);
    pushIfNotTiny(out, left, segmentVisible[segIdx] ?? true, params.minSegLenSq);
    current = right;
    prevCut = cut;
    segIdx++;
  }
  pushIfNotTiny(out, current, segmentVisible[segIdx] ?? true, params.minSegLenSq);
  return out;
}
function splitLineCubicByVisibilityAdaptive(b, scene, camera, width, height, params, ignorePrimitiveIds) {
  const out = [];
  const start = camera.projectToSvg(b.p0, width, height);
  const end = camera.projectToSvg(b.p3, width, height);
  const lineLengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  if (lineLengthPx <= VERY_SHORT_EDGE_SINGLE_VIS_PX) {
    const midVisible = scene.visibleAtPoint(evalCubic3(b, 0.5), {
      eps: params.epsVisible,
      ignorePrimitiveIds
    });
    pushIfNotTiny(out, b, midVisible, params.minSegLenSq);
    return out;
  }
  if (lineLengthPx <= SHORT_EDGE_FAST_PATH_PX) {
    return splitShortLineCubicFastPath(
      b,
      scene,
      params,
      ignorePrimitiveIds,
      out
    );
  }
  const pixelsPerSample = 14;
  const minCoarseSamples = 4;
  const maxAdaptiveDepth = 6;
  const targetSamples = clampInt(
    minCoarseSamples,
    Math.ceil(lineLengthPx / pixelsPerSample),
    Math.max(minCoarseSamples, Math.floor(params.samples))
  );
  const cache = /* @__PURE__ */ new Map();
  const sample = (t) => {
    const key = roundSampleKey(t);
    const cached = cache.get(key);
    if (cached) return cached;
    const point = evalCubic3(b, t);
    const projected = camera.projectToSvg(point, width, height);
    const next = {
      t,
      visible: scene.visibleAtPoint(point, {
        eps: params.epsVisible,
        ignorePrimitiveIds
      }),
      screenX: projected.x,
      screenY: projected.y
    };
    cache.set(key, next);
    return next;
  };
  const ranges = [];
  const pushRange = (t0, t1, visible) => {
    if (t1 - t0 <= params.cutEps) return;
    const prev = ranges[ranges.length - 1];
    if (prev && prev.visible === visible && Math.abs(prev.t1 - t0) <= params.cutEps) {
      prev.t1 = t1;
      return;
    }
    ranges.push({ t0, t1, visible });
  };
  const visit = (a, c, depth) => {
    if (c.t - a.t <= params.cutEps) {
      pushRange(a.t, c.t, a.visible);
      return;
    }
    const mid = sample((a.t + c.t) / 2);
    if (a.visible === mid.visible && mid.visible === c.visible) {
      pushRange(a.t, c.t, a.visible);
      return;
    }
    const spanPx = Math.hypot(c.screenX - a.screenX, c.screenY - a.screenY);
    if (spanPx <= pixelsPerSample || depth >= maxAdaptiveDepth) {
      if (a.visible !== c.visible) {
        const cut = refineVisibilityCutBisection(
          b,
          scene,
          params,
          a.t,
          c.t,
          a.visible,
          ignorePrimitiveIds
        );
        pushRange(a.t, cut, a.visible);
        pushRange(cut, c.t, c.visible);
        return;
      }
      visit(a, mid, depth + 1);
      visit(mid, c, depth + 1);
      return;
    }
    visit(a, mid, depth + 1);
    visit(mid, c, depth + 1);
  };
  for (let i = 0; i < targetSamples; i++) {
    const t0 = i / targetSamples;
    const t1 = (i + 1) / targetSamples;
    visit(sample(t0), sample(t1), 0);
  }
  for (const range of ranges) {
    pushIfNotTiny(
      out,
      sliceCubic3(b, range.t0, range.t1),
      range.visible,
      params.minSegLenSq
    );
  }
  return out;
}
function splitShortLineCubicFastPath(b, scene, params, ignorePrimitiveIds, out) {
  const vis0 = scene.visibleAtPoint(b.p0, {
    eps: params.epsVisible,
    ignorePrimitiveIds
  });
  const visMid = scene.visibleAtPoint(evalCubic3(b, 0.5), {
    eps: params.epsVisible,
    ignorePrimitiveIds
  });
  const vis1 = scene.visibleAtPoint(b.p3, {
    eps: params.epsVisible,
    ignorePrimitiveIds
  });
  if (vis0 === visMid && visMid === vis1) {
    pushIfNotTiny(out, b, visMid, params.minSegLenSq);
    return out;
  }
  if (vis0 !== vis1) {
    if (visMid === vis0) {
      const cut2 = refineVisibilityCutBisection(
        b,
        scene,
        params,
        0.5,
        1,
        vis0,
        ignorePrimitiveIds
      );
      pushIfNotTiny(
        out,
        sliceCubic3(b, 0, cut2),
        vis0,
        params.minSegLenSq
      );
      pushIfNotTiny(
        out,
        sliceCubic3(b, cut2, 1),
        vis1,
        params.minSegLenSq
      );
      return out;
    }
    const cut = refineVisibilityCutBisection(
      b,
      scene,
      params,
      0,
      0.5,
      vis0,
      ignorePrimitiveIds
    );
    pushIfNotTiny(out, sliceCubic3(b, 0, cut), vis0, params.minSegLenSq);
    pushIfNotTiny(out, sliceCubic3(b, cut, 1), vis1, params.minSegLenSq);
    return out;
  }
  const cut0 = refineVisibilityCutBisection(
    b,
    scene,
    params,
    0,
    0.5,
    vis0,
    ignorePrimitiveIds
  );
  const cut1 = refineVisibilityCutBisection(
    b,
    scene,
    params,
    0.5,
    1,
    visMid,
    ignorePrimitiveIds
  );
  pushIfNotTiny(out, sliceCubic3(b, 0, cut0), vis0, params.minSegLenSq);
  pushIfNotTiny(out, sliceCubic3(b, cut0, cut1), visMid, params.minSegLenSq);
  pushIfNotTiny(out, sliceCubic3(b, cut1, 1), vis1, params.minSegLenSq);
  return out;
}
function pushIfNotTiny(out, b, visible, minSegLenSq) {
  const extentSq = cubicControlExtentSq(b);
  if (extentSq < minSegLenSq) return;
  out.push({ bez: b, visible });
}
function sliceCubic3(b, t0, t1) {
  if (t0 <= 0 && t1 >= 1) return b;
  const clampedT0 = Math.max(0, Math.min(1, t0));
  const clampedT1 = Math.max(clampedT0, Math.min(1, t1));
  let segment = b;
  if (clampedT1 < 1) {
    segment = splitCubic3(segment, clampedT1).left;
  }
  if (clampedT0 <= 0) return segment;
  const localT = clampedT1 <= 0 ? 0 : clampedT0 / clampedT1;
  return splitCubic3(segment, localT).right;
}
function clampInt(lo, value, hi) {
  return Math.max(lo, Math.min(hi, value));
}
function roundSampleKey(t) {
  return Math.round(t * 1e9) / 1e9;
}
function cubicControlExtentSq(b) {
  const minX = Math.min(b.p0.x, b.p1.x, b.p2.x, b.p3.x);
  const maxX = Math.max(b.p0.x, b.p1.x, b.p2.x, b.p3.x);
  const minY = Math.min(b.p0.y, b.p1.y, b.p2.y, b.p3.y);
  const maxY = Math.max(b.p0.y, b.p1.y, b.p2.y, b.p3.y);
  const minZ = Math.min(b.p0.z, b.p1.z, b.p2.z, b.p3.z);
  const maxZ = Math.max(b.p0.z, b.p1.z, b.p2.z, b.p3.z);
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  return dx * dx + dy * dy + dz * dz;
}
const defaultStyle = {
  strokeVisible: "black",
  strokeHidden: "black",
  strokeWidthVisible: 1.5,
  strokeWidthHidden: 1.5,
  dashArrayHidden: "3 3",
  opacityHidden: 0.5,
  lineCap: "butt",
  lineJoin: "round"
};
function projectPiecesToSvgPaths(pieces, camera, width, height) {
  return chainPieces(pieces, 1e-6).map((chain) => ({
    d: chainToSvgPathD(chain, camera, width, height),
    visible: chain[0]?.visible ?? true
  }));
}
function piecesToSvg(pieces, camera, opts) {
  return projectedPathsToSvg(
    projectPiecesToSvgPaths(pieces, camera, opts.width, opts.height),
    opts
  );
}
function projectedPathsToSvg(projected, opts) {
  const style = { ...defaultStyle, ...opts.style ?? {} };
  const { width, height } = opts;
  const background = opts.background ?? true;
  const paths = [];
  for (const { d, visible } of projected) {
    const stroke = visible ? style.strokeVisible : style.strokeHidden;
    const strokeWidth = visible ? style.strokeWidthVisible : style.strokeWidthHidden;
    const extra = visible ? "" : ` stroke-dasharray="${style.dashArrayHidden}" opacity="${style.opacityHidden}"`;
    const path = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}"${extra} />`;
    paths.push(path);
  }
  const bg = background ? `<rect width="100%" height="100%" fill="white" />` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` + bg + paths.join("") + `</svg>`;
}
function chainToSvgPathD(chain, camera, width, height) {
  const first = chain[0];
  const p0 = camera.projectToSvg(first.bez.p0, width, height);
  let d = `M ${fmt(p0.x)} ${fmt(p0.y)}`;
  for (const piece of chain) {
    d += projectedCubicCommands(piece.bez, camera, width, height);
  }
  return d;
}
function projectedCubicCommands(bez, camera, width, height, depth = 0) {
  const points = [bez.p0, bez.p1, bez.p2, bez.p3].map(
    (p) => camera.projectToSvg(p, width, height)
  );
  if (camera.kind === "perspective" && depth < 12) {
    let error = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const u = 1 - t;
      const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      let x = 0, y = 0;
      for (let i = 0; i < 4; i++) {
        x += weights[i] * points[i].x;
        y += weights[i] * points[i].y;
      }
      const exact = camera.projectToSvg(evalCubic3(bez, t), width, height);
      error = Math.max(error, Math.hypot(x - exact.x, y - exact.y));
    }
    if (error > 0.2) {
      const halves = splitCubic3(bez, 0.5);
      return projectedCubicCommands(halves.left, camera, width, height, depth + 1) + projectedCubicCommands(halves.right, camera, width, height, depth + 1);
    }
  }
  const [, p1, p2, p3] = points;
  return ` C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
}
function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(3) : "0";
}
function chainPieces(pieces, connectEpsSq) {
  const out = [];
  let cur = [];
  const canAppend = (a, b) => {
    if (a.visible !== b.visible) return false;
    const dx = a.bez.p3.x - b.bez.p0.x;
    const dy = a.bez.p3.y - b.bez.p0.y;
    const dz = a.bez.p3.z - b.bez.p0.z;
    return dx * dx + dy * dy + dz * dz <= connectEpsSq;
  };
  for (const p of pieces) {
    const prev = cur[cur.length - 1];
    if (!prev) {
      cur = [p];
      continue;
    }
    if (canAppend(prev, p)) {
      cur.push(p);
    } else {
      out.push(cur);
      cur = [p];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
const sphereIntersect = Sphere.prototype.intersect;
const cylinderIntersect = Cylinder.prototype.intersect;
const coneIntersect = Cone.prototype.intersect;
const boxIntersect = BoxAabb.prototype.intersect;
const diskIntersect = Disk.prototype.intersect;
const rectIntersect = PlaneRect.prototype.intersect;
const nativeIntersectors = /* @__PURE__ */ new Map([
  [Sphere.prototype, sphereIntersect],
  [Cylinder.prototype, cylinderIntersect],
  [Cone.prototype, coneIntersect],
  [BoxAabb.prototype, boxIntersect],
  [Disk.prototype, diskIntersect],
  [PlaneRect.prototype, rectIntersect],
  [TriangleMesh.prototype, TriangleMesh.prototype.intersect]
]);
function isUnmodifiedNativePrimitive(primitive) {
  return nativeIntersectors.get(Object.getPrototypeOf(primitive)) === primitive.intersect;
}
function isUnitVector(vector) {
  const lengthSq = vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
  return Number.isFinite(lengthSq) && Math.abs(lengthSq - 1) <= 1e-12;
}
function isPerpendicular(a, b) {
  return Math.abs(a.x * b.x + a.y * b.y + a.z * b.z) <= 1e-12;
}
function normal(hit, x, y, z) {
  const length = Math.sqrt(x * x + y * y + z * z);
  const inverse = length > EPS ? 1 / length : 0;
  hit.nx = x * inverse;
  hit.ny = y * inverse;
  hit.nz = z * inverse;
}
function createPreparedPrimitiveIntersector(primitive, fixedDirection) {
  const prototype = Object.getPrototypeOf(primitive);
  if (prototype === Sphere.prototype && primitive.intersect === sphereIntersect) {
    const sphere = primitive;
    const { x: cx, y: cy, z: cz } = sphere.center;
    const radius = Math.abs(sphere.radius), radiusSq = radius * radius;
    const fixedA = fixedDirection ? fixedDirection.x ** 2 + fixedDirection.y ** 2 + fixedDirection.z ** 2 : 0;
    return {
      bounds: {
        minX: cx - radius,
        minY: cy - radius,
        minZ: cz - radius,
        maxX: cx + radius,
        maxY: cy + radius,
        maxZ: cz + radius
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const x = ox - cx, y = oy - cy, z = oz - cz;
        const a = fixedDirection ? fixedA : dx * dx + dy * dy + dz * dz;
        const b = 2 * (x * dx + y * dy + z * dz);
        const c = x * x + y * y + z * z - radiusSq;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return false;
        const s = Math.sqrt(disc), inv2a = 1 / (2 * a);
        let t = (-b - s) * inv2a;
        if (t < tMin || t > tMax) t = (-b + s) * inv2a;
        if (t <= EPS || t < tMin || t > tMax) return false;
        hit.t = t;
        normal(hit, ox + dx * t - cx, oy + dy * t - cy, oz + dz * t - cz);
        return true;
      }
    };
  }
  if (prototype === Cylinder.prototype && primitive.intersect === cylinderIntersect || prototype === Cone.prototype && primitive.intersect === coneIntersect) {
    const isCone = prototype === Cone.prototype;
    const object = primitive;
    if (!isUnitVector(object.axis)) return void 0;
    const origin = isCone ? object.apex : object.base;
    const { x: cx, y: cy, z: cz } = origin;
    const { x: ax, y: ay, z: az } = object.axis;
    const height = object.height;
    const radius = isCone ? object.baseRadius : object.radius;
    const kSq = isCone ? object.k ** 2 : 0;
    const fixedDV = fixedDirection ? fixedDirection.x * ax + fixedDirection.y * ay + fixedDirection.z * az : 0;
    const fixedPX = fixedDirection ? fixedDirection.x - ax * fixedDV : 0;
    const fixedPY = fixedDirection ? fixedDirection.y - ay * fixedDV : 0;
    const fixedPZ = fixedDirection ? fixedDirection.z - az * fixedDV : 0;
    const fixedA = fixedPX * fixedPX + fixedPY * fixedPY + fixedPZ * fixedPZ - kSq * fixedDV * fixedDV;
    const caps = isCone ? object.cap === "base" : object.caps === "both";
    const tx = cx + ax * height, ty = cy + ay * height, tz = cz + az * height;
    const boundRadius = Math.sqrt(radius * radius + (caps ? 1e-8 : 0));
    const rx = boundRadius * Math.sqrt(Math.max(0, 1 - ax * ax));
    const ry = boundRadius * Math.sqrt(Math.max(0, 1 - ay * ay));
    const rz = boundRadius * Math.sqrt(Math.max(0, 1 - az * az));
    return {
      bounds: {
        minX: isCone ? Math.min(cx, tx - rx) : Math.min(cx, tx) - rx,
        minY: isCone ? Math.min(cy, ty - ry) : Math.min(cy, ty) - ry,
        minZ: isCone ? Math.min(cz, tz - rz) : Math.min(cz, tz) - rz,
        maxX: isCone ? Math.max(cx, tx + rx) : Math.max(cx, tx) + rx,
        maxY: isCone ? Math.max(cy, ty + ry) : Math.max(cy, ty) + ry,
        maxZ: isCone ? Math.max(cz, tz + rz) : Math.max(cz, tz) + rz
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const x = ox - cx, y = oy - cy, z = oz - cz;
        const dv = fixedDirection ? fixedDV : dx * ax + dy * ay + dz * az;
        const cv = x * ax + y * ay + z * az;
        const px = fixedDirection ? fixedPX : dx - ax * dv;
        const py = fixedDirection ? fixedPY : dy - ay * dv;
        const pz = fixedDirection ? fixedPZ : dz - az * dv;
        const qx = x - ax * cv, qy = y - ay * cv, qz = z - az * cv;
        const a = fixedDirection ? fixedA : px * px + py * py + pz * pz - kSq * dv * dv;
        const b = 2 * (qx * px + qy * py + qz * pz - kSq * cv * dv);
        const c = qx * qx + qy * qy + qz * qz - kSq * cv * cv - (isCone ? 0 : radius * radius);
        let best = tMax, found = false;
        if (isCone ? Math.abs(a) > EPS : a > EPS) {
          const disc = b * b - 4 * a * c;
          if (disc >= 0) {
            const s = Math.sqrt(disc), inv2a = 1 / (2 * a);
            for (let root = 0; root < 2; root++) {
              const t = (-b + (root === 0 ? -s : s)) * inv2a;
              if (t <= EPS || t < tMin || t > best) continue;
              const hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
              const vx = hx - cx, vy = hy - cy, vz = hz - cz;
              const h = vx * ax + vy * ay + vz * az;
              if (h < 0 || h > height) continue;
              best = t;
              found = true;
              hit.t = t;
              if (isCone)
                normal(
                  hit,
                  2 * (vx - ax * h) - 2 * kSq * h * ax,
                  2 * (vy - ay * h) - 2 * kSq * h * ay,
                  2 * (vz - az * h) - 2 * kSq * h * az
                );
              else
                normal(
                  hit,
                  hx - (cx + ax * h),
                  hy - (cy + ay * h),
                  hz - (cz + az * h)
                );
            }
          }
        }
        if (caps && Math.abs(dv) > EPS) {
          for (let cap = isCone ? 1 : 0; cap < 2; cap++) {
            const bx = cap === 0 ? cx : tx, by = cap === 0 ? cy : ty, bz = cap === 0 ? cz : tz;
            const t = ((bx - ox) * ax + (by - oy) * ay + (bz - oz) * az) / dv;
            if (t <= EPS || t < tMin || t > best || found && t >= best)
              continue;
            const vx = ox + dx * t - bx, vy = oy + dy * t - by, vz = oz + dz * t - bz;
            if (vx * vx + vy * vy + vz * vz > radius * radius + 1e-8) continue;
            best = t;
            found = true;
            hit.t = t;
            const sign = dv < 0 ? 1 : -1;
            hit.nx = sign * ax;
            hit.ny = sign * ay;
            hit.nz = sign * az;
          }
        }
        return found;
      }
    };
  }
  if (prototype === BoxAabb.prototype && primitive.intersect === boxIntersect) {
    const box = primitive;
    const { x: minX, y: minY, z: minZ } = box.min;
    const { x: maxX, y: maxY, z: maxZ } = box.max;
    const minima = [minX, minY, minZ], maxima = [maxX, maxY, maxZ];
    return {
      bounds: { minX, minY, minZ, maxX, maxY, maxZ },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        let enter = -Infinity, exit = Infinity, enterAxis = -1, exitAxis = -1, enterSign = 0, exitSign = 0;
        for (let axis2 = 0; axis2 < 3; axis2++) {
          const o = axis2 === 0 ? ox : axis2 === 1 ? oy : oz;
          const d = axis2 === 0 ? dx : axis2 === 1 ? dy : dz;
          if (Math.abs(d) <= EPS) {
            if (o < minima[axis2] || o > maxima[axis2]) return false;
            continue;
          }
          const inverse = 1 / d;
          let near = (minima[axis2] - o) * inverse, far = (maxima[axis2] - o) * inverse, sign2 = -1;
          if (near > far) {
            const swap = near;
            near = far;
            far = swap;
            sign2 = 1;
          }
          if (near > enter) {
            enter = near;
            enterAxis = axis2;
            enterSign = sign2;
          }
          if (far < exit) {
            exit = far;
            exitAxis = axis2;
            exitSign = -sign2;
          }
          if (enter > exit) return false;
        }
        const useExit = enter <= EPS || enter < tMin;
        const t = useExit ? exit : enter;
        if (!Number.isFinite(t) || t <= EPS || t < tMin || t > tMax)
          return false;
        const axis = useExit ? exitAxis : enterAxis, sign = useExit ? exitSign : enterSign;
        hit.t = t;
        hit.nx = axis === 0 ? sign : 0;
        hit.ny = axis === 1 ? sign : 0;
        hit.nz = axis === 2 ? sign : 0;
        return true;
      }
    };
  }
  if (prototype === Disk.prototype && primitive.intersect === diskIntersect || prototype === PlaneRect.prototype && primitive.intersect === rectIntersect) {
    const isDisk = prototype === Disk.prototype;
    const plane = primitive;
    if (!isUnitVector(plane.normal)) return void 0;
    if (!isDisk) {
      const rectangle = plane;
      if (!isUnitVector(rectangle.u) || !isUnitVector(rectangle.v) || !isPerpendicular(rectangle.normal, rectangle.u) || !isPerpendicular(rectangle.normal, rectangle.v) || !isPerpendicular(rectangle.u, rectangle.v))
        return void 0;
    }
    const { x: cx, y: cy, z: cz } = plane.center;
    const { x: nx, y: ny, z: nz } = plane.normal;
    const fixedDenom = fixedDirection ? fixedDirection.x * nx + fixedDirection.y * ny + fixedDirection.z * nz : 0;
    const rect = isDisk ? void 0 : plane;
    const ux = rect?.u.x ?? 0, uy = rect?.u.y ?? 0, uz = rect?.u.z ?? 0;
    const vx = rect?.v.x ?? 0, vy = rect?.v.y ?? 0, vz = rect?.v.z ?? 0;
    const halfWidth = (rect?.halfWidth ?? 0) + 1e-8, halfHeight = (rect?.halfHeight ?? 0) + 1e-8;
    const radiusSq = isDisk ? plane.radius ** 2 + 1e-8 : 0;
    const radius = Math.sqrt(radiusSq);
    const rx = isDisk ? radius * Math.sqrt(Math.max(0, 1 - nx * nx)) : Math.abs(ux) * halfWidth + Math.abs(vx) * halfHeight;
    const ry = isDisk ? radius * Math.sqrt(Math.max(0, 1 - ny * ny)) : Math.abs(uy) * halfWidth + Math.abs(vy) * halfHeight;
    const rz = isDisk ? radius * Math.sqrt(Math.max(0, 1 - nz * nz)) : Math.abs(uz) * halfWidth + Math.abs(vz) * halfHeight;
    return {
      bounds: {
        minX: cx - rx,
        minY: cy - ry,
        minZ: cz - rz,
        maxX: cx + rx,
        maxY: cy + ry,
        maxZ: cz + rz
      },
      intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit) {
        const denom = fixedDirection ? fixedDenom : dx * nx + dy * ny + dz * nz;
        if (Math.abs(denom) <= EPS) return false;
        const t = ((cx - ox) * nx + (cy - oy) * ny + (cz - oz) * nz) / denom;
        if (t <= EPS || t < tMin || t > tMax) return false;
        const x = ox + dx * t - cx, y = oy + dy * t - cy, z = oz + dz * t - cz;
        if (isDisk ? x * x + y * y + z * z > radiusSq : Math.abs(x * ux + y * uy + z * uz) > halfWidth || Math.abs(x * vx + y * vy + z * vz) > halfHeight)
          return false;
        const sign = denom < 0 ? 1 : -1;
        hit.t = t;
        hit.nx = sign * nx;
        hit.ny = sign * ny;
        hit.nz = sign * nz;
        return true;
      }
    };
  }
  return void 0;
}
let Scene$1 = class Scene {
  constructor(primitives, camera, profiler, preparedGeometry = false) {
    this.primitives = primitives;
    this.camera = camera;
    this.profiler = profiler;
    if (preparedGeometry) {
      const kernels = primitives.map(
        (primitive) => createPreparedPrimitiveIntersector(primitive)
      );
      if (kernels.every((kernel) => kernel !== void 0))
        this.prepared = kernels;
    }
  }
  prepared;
  kernelHit = { t: 0, nx: 0, ny: 0, nz: 0 };
  closestHit = {
    t: 0,
    nx: 0,
    ny: 0,
    nz: 0,
    px: 0,
    py: 0,
    pz: 0,
    primitiveId: ""
  };
  visibilityDepth = 0;
  raycastClosest(ray, opts = {}) {
    const prof = this.profiler;
    if (prof) {
      prof.inc("raycastClosest.calls");
      prof.begin("raycastClosest.ms");
    }
    const tMin = opts.tMin ?? 0;
    let bestT = opts.tMax ?? Number.POSITIVE_INFINITY;
    let closest = null;
    for (const primitive of this.primitives) {
      if (opts.ignorePrimitiveId && primitive.id === opts.ignorePrimitiveId)
        continue;
      if (opts.ignorePrimitiveIds?.includes(primitive.id)) continue;
      if (prof) prof.inc("primitive.intersect.calls");
      const hit = primitive.intersect(ray, tMin, bestT);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        closest = hit;
      }
    }
    if (prof) prof.end("raycastClosest.ms");
    return closest;
  }
  raycastScalar(ox, oy, oz, dx, dy, dz, opts, result) {
    const prof = this.profiler;
    if (prof) {
      prof.inc("raycastClosest.calls");
      prof.begin("raycastClosest.ms");
    }
    const tMin = opts.tMin ?? 0;
    let bestT = opts.tMax ?? Number.POSITIVE_INFINITY;
    let found = false;
    let fallbackRay;
    for (let index = 0; index < this.primitives.length; index++) {
      const primitive = this.primitives[index];
      if (opts.ignorePrimitiveId === primitive.id || opts.ignorePrimitiveIds?.includes(primitive.id))
        continue;
      if (prof) prof.inc("primitive.intersect.calls");
      const kernel = this.prepared?.[index];
      if (kernel) {
        const hit = this.kernelHit;
        if (!kernel.intersect(ox, oy, oz, dx, dy, dz, tMin, bestT, hit) || !(hit.t < bestT))
          continue;
        bestT = hit.t;
        result.t = hit.t;
        result.nx = hit.nx;
        result.ny = hit.ny;
        result.nz = hit.nz;
        result.px = ox + dx * hit.t;
        result.py = oy + dy * hit.t;
        result.pz = oz + dz * hit.t;
        result.primitiveId = primitive.id;
        found = true;
      } else {
        fallbackRay ??= {
          origin: new Vec3(ox, oy, oz),
          dir: new Vec3(dx, dy, dz)
        };
        const hit = primitive.intersect(fallbackRay, tMin, bestT);
        if (!hit || !(hit.t < bestT)) continue;
        bestT = hit.t;
        result.t = hit.t;
        result.nx = hit.normal.x;
        result.ny = hit.normal.y;
        result.nz = hit.normal.z;
        result.px = hit.point.x;
        result.py = hit.point.y;
        result.pz = hit.point.z;
        result.primitiveId = hit.primitiveId;
        found = true;
      }
    }
    if (prof) prof.end("raycastClosest.ms");
    return found;
  }
  visibleAtPoint(worldPoint, opts) {
    const prof = this.profiler;
    if (prof) {
      prof.inc("visibleAtPoint.calls");
      prof.begin("visibleAtPoint.ms");
    }
    const nested = this.visibilityDepth++ > 0;
    try {
      const epsAbs = opts?.eps ?? 2e-4;
      let ox, oy, oz, dx, dy, dz, targetDist;
      if (this.camera.kind === "perspective") {
        const origin = this.camera.position;
        ox = origin.x;
        oy = origin.y;
        oz = origin.z;
        dx = worldPoint.x - ox;
        dy = worldPoint.y - oy;
        dz = worldPoint.z - oz;
        targetDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const inverse = targetDist > 1e-9 ? 1 / targetDist : 0;
        dx *= inverse;
        dy *= inverse;
        dz *= inverse;
      } else {
        const direction = this.camera.forward;
        const length = Math.sqrt(
          direction.x * direction.x + direction.y * direction.y + direction.z * direction.z
        );
        const inverse = length > 1e-9 ? 1 / length : 0;
        dx = direction.x * inverse;
        dy = direction.y * inverse;
        dz = direction.z * inverse;
        targetDist = Math.max(this.camera.far, epsAbs * 2);
        ox = worldPoint.x - dx * targetDist;
        oy = worldPoint.y - dy * targetDist;
        oz = worldPoint.z - dz * targetDist;
      }
      const scale = Math.max(
        1,
        Math.abs(ox),
        Math.abs(oy),
        Math.abs(oz),
        Math.abs(worldPoint.x),
        Math.abs(worldPoint.y),
        Math.abs(worldPoint.z)
      );
      const rayGap = Math.max(epsAbs, scale * Number.EPSILON * 64);
      const tMax = Math.max(0, targetDist - rayGap);
      let hit = nested ? { t: 0, nx: 0, ny: 0, nz: 0, px: 0, py: 0, pz: 0, primitiveId: "" } : this.closestHit;
      if (!this.prepared || this.raycastClosest !== originalRaycastClosest$1) {
        const origin = this.camera.kind === "perspective" ? this.camera.position : new Vec3(ox, oy, oz);
        const custom = this.raycastClosest(
          { origin, dir: new Vec3(dx, dy, dz) },
          { tMin: 0, tMax }
        );
        if (!custom) return true;
        hit = {
          t: custom.t,
          px: custom.point.x,
          py: custom.point.y,
          pz: custom.point.z,
          nx: custom.normal.x,
          ny: custom.normal.y,
          nz: custom.normal.z,
          primitiveId: custom.primitiveId
        };
      } else if (!this.raycastScalar(ox, oy, oz, dx, dy, dz, { tMin: 0, tMax }, hit))
        return true;
      const allowed = opts?.ignorePrimitiveIds;
      if (allowed && !allowed.includes(hit.primitiveId)) return false;
      const snap = allowed ? Math.max(
        epsAbs * 24,
        Math.max(
          scale,
          Math.abs(hit.px),
          Math.abs(hit.py),
          Math.abs(hit.pz)
        ) * Number.EPSILON * 512
      ) : rayGap;
      const px = hit.px - worldPoint.x, py = hit.py - worldPoint.y, pz = hit.pz - worldPoint.z;
      return px * px + py * py + pz * pz <= snap * snap || Math.max(0, targetDist - hit.t) <= snap;
    } finally {
      this.visibilityDepth--;
      if (prof) prof.end("visibleAtPoint.ms");
    }
  }
};
const originalRaycastClosest$1 = Scene$1.prototype.raycastClosest;
class Scene2 {
  _primitives;
  constructor(primitives = []) {
    this._primitives = [...primitives];
  }
  get primitives() {
    return this._primitives;
  }
  add(...primitives) {
    this._primitives.push(...primitives);
    return this;
  }
  removeById(id) {
    this._primitives = this._primitives.filter((p) => p.id !== id);
    return this;
  }
  clear() {
    this._primitives = [];
    return this;
  }
  /** Convert to internal Scene for visibility/raycasting */
  toRaycastScene(camera, profiler, preparedGeometry = false) {
    return new Scene$1(
      this._primitives,
      camera,
      profiler,
      preparedGeometry
    );
  }
}
function boxCorners(b) {
  return Array.from(
    { length: 8 },
    (_, i) => new Vec3(
      i & 1 ? b.max.x : b.min.x,
      i & 2 ? b.max.y : b.min.y,
      i & 4 ? b.max.z : b.min.z
    )
  );
}
const BOX_EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
];
function leafCurves(leaf, camera) {
  const viewDirection = camera.kind === "orthographic" ? camera.forward : void 0;
  const cameraPos = camera.position;
  if (leaf instanceof Sphere)
    return sphereSilhouetteToCubics3({
      cameraPos,
      viewDirection,
      center: leaf.center,
      radius: leaf.radius
    });
  if (leaf instanceof Cylinder) {
    const top = Vec3.add(leaf.base, Vec3.mulScalar(leaf.axis, leaf.height));
    return [
      ...cylinderSilhouetteToCubics3({
        cameraPos,
        viewDirection,
        base: leaf.base,
        axis: leaf.axis,
        height: leaf.height,
        radius: leaf.radius
      }),
      ...circleToCubics3({
        center: leaf.base,
        normal: leaf.axis,
        radius: leaf.radius
      }),
      ...circleToCubics3({
        center: top,
        normal: leaf.axis,
        radius: leaf.radius
      })
    ];
  }
  if (leaf instanceof Cone) {
    const base = Vec3.add(leaf.apex, Vec3.mulScalar(leaf.axis, leaf.height));
    return [
      ...coneSilhouetteToCubics3({
        cameraPos,
        viewDirection,
        apex: leaf.apex,
        axis: leaf.axis,
        height: leaf.height,
        baseRadius: leaf.baseRadius
      }),
      ...circleToCubics3({
        center: base,
        normal: leaf.axis,
        radius: leaf.baseRadius
      })
    ];
  }
  if (leaf instanceof OrientedBox)
    return leaf.edges().map(([a, b]) => lineToCubic3(a, b));
  const corners = boxCorners(leaf);
  return BOX_EDGES.map(([a, b]) => lineToCubic3(corners[a], corners[b]));
}
const seams = /* @__PURE__ */ new WeakMap();
function operandSeams(csg) {
  let curves = seams.get(csg);
  if (!curves) {
    curves = intersectionCurvesToOwnedCubics(csg.leaves(), {
      angularSamples: 192
    }).map((x) => x.bez);
    seams.set(csg, curves);
  }
  return curves;
}
function csgBoundaryCurves(csg, camera) {
  const tolerance = csg.size() * CSG_TOLERANCE;
  const onBoundary = (p) => csg.classify(p, tolerance) === 0;
  const candidates = [
    ...csg.leaves().flatMap((leaf) => leafCurves(leaf, camera)),
    ...operandSeams(csg)
  ];
  return candidates.flatMap((curve) => splitCubicWhere(curve, onBoundary));
}
function csgCurvesForPrimitives(primitives, camera) {
  return primitives.flatMap(
    (p) => p instanceof Csg ? csgBoundaryCurves(p, camera) : []
  );
}
function defaultCurveInclude() {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    meshEdges: true,
    csg: true
  };
}
function curvesFromPrimitives(primitives, camera, include = {}, mesh = {}) {
  const inc = { ...defaultCurveInclude(), ...include };
  const out = [];
  if (inc.silhouettes)
    out.push(...silhouettesForPrimitives(primitives, camera));
  if (inc.rims) out.push(...rimsForPrimitives(primitives));
  if (inc.borders) out.push(...bordersForPrimitives(primitives));
  if (inc.boxEdges) out.push(...boxEdgesForPrimitives(primitives));
  if (inc.meshEdges) out.push(...meshFeatureCurves(primitives, camera, mesh));
  if (inc.csg) out.push(...csgCurvesForPrimitives(primitives, camera));
  return out;
}
function silhouettesForPrimitives(primitives, camera) {
  const out = [];
  for (const p of primitives) {
    if (p instanceof Sphere) {
      out.push(
        ...sphereSilhouetteToCubics3({
          cameraPos: camera.position,
          viewDirection: camera.kind === "orthographic" ? camera.forward : void 0,
          center: p.center,
          radius: p.radius
        })
      );
      continue;
    }
    if (p instanceof Cylinder) {
      out.push(
        ...cylinderSilhouetteToCubics3({
          cameraPos: camera.position,
          viewDirection: camera.kind === "orthographic" ? camera.forward : void 0,
          base: p.base,
          axis: p.axis,
          height: p.height,
          radius: p.radius
        })
      );
      continue;
    }
    if (p instanceof Cone) {
      out.push(
        ...coneSilhouetteToCubics3({
          cameraPos: camera.position,
          viewDirection: camera.kind === "orthographic" ? camera.forward : void 0,
          apex: p.apex,
          axis: p.axis,
          height: p.height,
          baseRadius: p.baseRadius
        })
      );
      continue;
    }
  }
  return out;
}
function rimsForPrimitives(primitives) {
  const out = [];
  for (const p of primitives) {
    if (p instanceof Cylinder) {
      out.push(
        ...circleToCubics3({
          center: p.base,
          normal: p.axis,
          radius: p.radius
        })
      );
      out.push(
        ...circleToCubics3({
          center: Vec3.add(p.base, Vec3.mulScalar(p.axis, p.height)),
          normal: p.axis,
          radius: p.radius
        })
      );
      continue;
    }
    if (p instanceof Cone) {
      const baseCenter = Vec3.add(p.apex, Vec3.mulScalar(p.axis, p.height));
      out.push(
        ...circleToCubics3({
          center: baseCenter,
          normal: p.axis,
          radius: p.baseRadius
        })
      );
      continue;
    }
    if (p instanceof Disk) {
      out.push(
        ...circleToCubics3({
          center: p.center,
          normal: p.normal,
          radius: p.radius
        })
      );
      continue;
    }
  }
  return out;
}
function bordersForPrimitives(primitives) {
  const out = [];
  for (const p of primitives) {
    if (p instanceof PlaneRect) out.push(...planeRectBorderCubics(p));
  }
  return out;
}
function planeRectBorderCubics(r) {
  const ux = Vec3.mulScalar(r.u, r.halfWidth);
  const vy = Vec3.mulScalar(r.v, r.halfHeight);
  const c = r.center;
  const p00 = Vec3.sub(Vec3.sub(c, ux), vy);
  const p10 = Vec3.add(Vec3.sub(c, vy), ux);
  const p11 = Vec3.add(Vec3.add(c, ux), vy);
  const p01 = Vec3.add(Vec3.sub(c, ux), vy);
  return [
    lineToCubic3(p00, p10),
    lineToCubic3(p10, p11),
    lineToCubic3(p11, p01),
    lineToCubic3(p01, p00)
  ];
}
function boxEdgesForPrimitives(primitives) {
  const out = [];
  for (const p of primitives) {
    if (p instanceof BoxAabb) out.push(...boxEdgesToCubics3(p));
    else if (p instanceof OrientedBox)
      out.push(...p.edges().map(([a, b]) => lineToCubic3(a, b)));
  }
  return out;
}
function boxEdgesToCubics3(b) {
  const min = b.min;
  const max = b.max;
  const p000 = new Vec3(min.x, min.y, min.z);
  const p001 = new Vec3(min.x, min.y, max.z);
  const p010 = new Vec3(min.x, max.y, min.z);
  const p011 = new Vec3(min.x, max.y, max.z);
  const p100 = new Vec3(max.x, min.y, min.z);
  const p101 = new Vec3(max.x, min.y, max.z);
  const p110 = new Vec3(max.x, max.y, min.z);
  const p111 = new Vec3(max.x, max.y, max.z);
  return [
    // bottom rect
    lineToCubic3(p000, p100),
    lineToCubic3(p100, p101),
    lineToCubic3(p101, p001),
    lineToCubic3(p001, p000),
    // top rect
    lineToCubic3(p010, p110),
    lineToCubic3(p110, p111),
    lineToCubic3(p111, p011),
    lineToCubic3(p011, p010),
    // verticals
    lineToCubic3(p000, p010),
    lineToCubic3(p100, p110),
    lineToCubic3(p101, p111),
    lineToCubic3(p001, p011)
  ];
}
function meshFeatureCurves(primitives, camera, mesh) {
  const out = [];
  const creaseAngleDeg = mesh.creaseAngleDeg ?? 30;
  for (const p of primitives) {
    if (!(p instanceof TriangleMesh)) continue;
    for (const edge of p.featureEdges(camera, { creaseAngleDeg })) {
      out.push(lineToCubic3(edge.start, edge.end));
    }
  }
  return out;
}
const originalProjectToSvg = Camera.prototype.projectToSvg;
const originalProjectToNdc = Camera.prototype.projectToNdc;
const originalToRaycastScene = Scene2.prototype.toRaycastScene;
const originalVisibleAtPoint = Scene$1.prototype.visibleAtPoint;
const originalRaycastClosest = Scene$1.prototype.raycastClosest;
const DEFAULT_HLR_PARAMS = {
  samples: 192,
  coarseSamples: 0,
  refineIters: 22,
  epsVisible: 2e-4,
  cutEps: 1e-6,
  minSegLenSq: 1e-6
};
const DEFAULT_INTERSECTION_PARAMS = {
  angularSamples: 160,
  useBezierFit: true,
  fitMode: "stitchThenFit"
};
const DEFAULT_MESH_PARAMS = {
  creaseAngleDeg: 30
};
const cubicKey = (b) => [
  b.p0.x,
  b.p0.y,
  b.p0.z,
  b.p1.x,
  b.p1.y,
  b.p1.z,
  b.p2.x,
  b.p2.y,
  b.p2.z,
  b.p3.x,
  b.p3.y,
  b.p3.z
];
function defaultInclude() {
  return {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    meshEdges: true,
    csg: true,
    intersections: true
  };
}
class SvgRenderer {
  projectedCache;
  base;
  constructor(opts) {
    this.base = opts;
  }
  render(scene, camera, opts = {}) {
    const width = this.base.width;
    const height = this.base.height;
    const profiler = opts.profiler ?? this.base.profiler;
    if (profiler) profiler.reset();
    if (profiler) profiler.begin("render.total");
    const include = {
      ...defaultInclude(),
      ...this.base.include ?? {},
      ...opts.include ?? {}
    };
    const ix = {
      ...DEFAULT_INTERSECTION_PARAMS,
      ...this.base.intersections ?? {},
      ...opts.intersections ?? {}
    };
    const mesh = {
      ...DEFAULT_MESH_PARAMS,
      ...this.base.mesh ?? {},
      ...opts.mesh ?? {}
    };
    const primitives = scene.primitives;
    const hasTriangleMesh = primitives.some((p) => p instanceof TriangleMesh);
    const hlrDefaults = hasTriangleMesh ? { ...DEFAULT_HLR_PARAMS, coarseSamples: 24 } : DEFAULT_HLR_PARAMS;
    const hlr = {
      ...hlrDefaults,
      ...this.base.hlr ?? {},
      ...opts.hlr ?? {}
    };
    const svgOpts = {
      width,
      height,
      background: opts.background ?? this.base.background,
      style: { ...this.base.style ?? {}, ...opts.style ?? {} }
    };
    const geometry = hasTriangleMesh ? void 0 : intersectionGeometrySignature(primitives);
    const cacheKey = geometry === void 0 ? void 0 : geometry + JSON.stringify([
      width,
      height,
      camera.kind,
      camera.near,
      camera.far,
      camera.fovYRad,
      camera.halfHeight,
      camera.position.x,
      camera.position.y,
      camera.position.z,
      camera.forward.x,
      camera.forward.y,
      camera.forward.z,
      camera.view.m,
      camera.proj.m,
      include,
      ix,
      mesh,
      hlr,
      opts.curves?.map(cubicKey),
      opts.ownedCurves?.map((x) => [cubicKey(x.bez), x.ignorePrimitiveIds])
    ]);
    const cameraMethods = Object.getPrototypeOf(camera) === Camera.prototype && camera.projectToSvg === originalProjectToSvg && camera.projectToNdc === originalProjectToNdc && Object.getPrototypeOf(scene) === Scene2.prototype && scene.toRaycastScene === originalToRaycastScene && Scene$1.prototype.visibleAtPoint === originalVisibleAtPoint && Scene$1.prototype.raycastClosest === originalRaycastClosest;
    if (cacheKey !== void 0 && cameraMethods && this.projectedCache?.key === cacheKey) {
      if (profiler) {
        profiler.inc("render.visibility.cacheHit");
        profiler.begin("render.svgWrite");
      }
      const out2 = projectedPathsToSvg(this.projectedCache.paths, svgOpts);
      if (profiler) {
        profiler.end("render.svgWrite");
        profiler.end("render.total");
      }
      return out2;
    }
    this.projectedCache = void 0;
    const cubics = [];
    const meshCubics = [];
    if (profiler) profiler.begin("render.curvesFromPrimitives");
    cubics.push(
      ...curvesFromPrimitives(
        primitives,
        camera,
        { ...include, meshEdges: false },
        mesh
      )
    );
    if (include.meshEdges) {
      meshCubics.push(...meshFeatureCurves(primitives, camera, mesh));
    }
    if (profiler) profiler.end("render.curvesFromPrimitives");
    if (opts.curves) cubics.push(...opts.curves);
    if (profiler) profiler.begin("render.intersections");
    const intersectionsForScene = hasTriangleMesh ? intersectionCurvesToOwnedCubics : cachedIntersectionCurvesToOwnedCubics;
    const ownedIntersections = include.intersections ? intersectionsForScene(primitives, {
      angularSamples: ix.angularSamples,
      useBezierFit: ix.useBezierFit,
      fitMode: ix.fitMode
    }) : [];
    if (profiler) profiler.end("render.intersections");
    const rayScene = scene.toRaycastScene(camera, profiler, true);
    const hiddenPieces = [];
    const visiblePieces = [];
    if (profiler) profiler.begin("render.visibilitySplit");
    for (const b of cubics) {
      for (const p of splitCubicByVisibility(b, rayScene, hlr))
        (p.visible ? visiblePieces : hiddenPieces).push(p);
    }
    for (const b of meshCubics) {
      for (const p of splitLineCubicByVisibilityAdaptive(
        b,
        rayScene,
        camera,
        width,
        height,
        hlr
      )) {
        (p.visible ? visiblePieces : hiddenPieces).push(p);
      }
    }
    for (const x of [...ownedIntersections, ...opts.ownedCurves ?? []]) {
      for (const p of splitCubicByVisibilityWithIgnore(
        x.bez,
        rayScene,
        hlr,
        x.ignorePrimitiveIds
      )) {
        (p.visible ? visiblePieces : hiddenPieces).push(p);
      }
    }
    if (profiler) profiler.end("render.visibilitySplit");
    const sorted = [...hiddenPieces, ...visiblePieces];
    if (profiler) profiler.begin("render.svgWrite");
    const paths = projectPiecesToSvgPaths(sorted, camera, width, height);
    if (cacheKey !== void 0 && cameraMethods)
      this.projectedCache = { key: cacheKey, paths };
    const out = projectedPathsToSvg(paths, svgOpts);
    if (profiler) profiler.end("render.svgWrite");
    if (profiler) profiler.end("render.total");
    return out;
  }
}
function renderToSvg(scene, camera, opts) {
  const r = new SvgRenderer(opts);
  return r.render(scene, camera, {
    curves: opts.curves,
    ownedCurves: opts.ownedCurves
  });
}
function renderPrimitivesToSvg(primitives, camera, opts) {
  return renderToSvg(new Scene2(primitives), camera, opts);
}
const nativeScreenToRay = Camera.prototype.screenToRay;
const PAPER_TONES = { unlit: 1, shadow: 0.72, lit: 0.99 };
function buildSurfaceBuffer(primitives, camera, options) {
  const { width, height } = options;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Surface buffer dimensions must be positive integers");
  }
  const pixelCount = width * height;
  const normals = new Float32Array(pixelCount * 3);
  const primitiveIndices = new Int32Array(pixelCount).fill(-1);
  const depth = new Float32Array(pixelCount).fill(Number.POSITIVE_INFINITY);
  const primitiveIds = primitives.map((primitive) => primitive.id);
  const buffer = {
    width,
    height,
    normals,
    primitiveIndices,
    primitiveIds,
    depth
  };
  if (primitives.length === 0) return buffer;
  if (Object.getPrototypeOf(camera) !== Camera.prototype || camera.screenToRay !== nativeScreenToRay || primitives.some((primitive) => !isUnmodifiedNativePrimitive(primitive))) {
    renderGenericSurfaces(primitives, camera, buffer);
    return buffer;
  }
  const m = camera.viewProjInv.m;
  const perspective = camera.kind === "perspective";
  const originDepth = perspective ? 0 : camera.near;
  const { x: fx, y: fy, z: fz } = camera.forward;
  const ndcX = Float64Array.from(
    { length: width },
    (_, x) => (x + 0.5) / width * 2 - 1
  );
  const clipX = Float64Array.from(ndcX, (x) => m[0] * x);
  const clipY = Float64Array.from(ndcX, (x) => m[1] * x);
  const clipZ = Float64Array.from(ndcX, (x) => m[2] * x);
  const clipW = Float64Array.from(ndcX, (x) => m[3] * x);
  const orthoRate = fx * fx + fy * fy + fz * fz;
  const orthoFar = (camera.far - camera.near) / orthoRate;
  const hit = { t: 0, nx: 0, ny: 0, nz: 0 };
  const useProjectedBounds = cameraPoseAndMatricesAgree(camera);
  if (perspective && useProjectedBounds && primitives.length > 1 && renderOverlappingSurfaces(
    primitives,
    camera,
    buffer,
    clipX,
    clipY,
    clipZ,
    clipW
  ))
    return buffer;
  const closest = new Float64Array(pixelCount).fill(Infinity);
  for (let index = 0; index < primitives.length; index++) {
    const primitive = primitives[index];
    const prepared = createPreparedPrimitiveIntersector(
      primitive,
      perspective ? void 0 : camera.forward
    );
    const bounds = prepared && useProjectedBounds ? projectedBounds(prepared.bounds, camera, width, height) : { x0: 0, x1: width, y0: 0, y1: height };
    if (!bounds) continue;
    for (let y = bounds.y0; y < bounds.y1; y++) {
      const ny = 1 - (y + 0.5) / height * 2;
      const rowX = m[4] * ny, rowY = m[5] * ny, rowZ = m[6] * ny, rowW = m[7] * ny;
      for (let x = bounds.x0; x < bounds.x1; x++) {
        const pixel = y * width + x;
        const cx = clipX[x] + rowX, cy = clipY[x] + rowY, cz = clipZ[x] + rowZ, cw = clipW[x] + rowW;
        const nearW = cw - m[11] + m[15] || 1;
        const nearX = (cx - m[8] + m[12]) / nearW;
        const nearY = (cy - m[9] + m[13]) / nearW;
        const nearZ = (cz - m[10] + m[14]) / nearW;
        let ox = nearX, oy = nearY, oz = nearZ, dx = fx, dy = fy, dz = fz;
        if (perspective) {
          const farW = cw + m[11] + m[15] || 1;
          dx = (cx + m[8] + m[12]) / farW - nearX;
          dy = (cy + m[9] + m[13]) / farW - nearY;
          dz = (cz + m[10] + m[14]) / farW - nearZ;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const inverse = length <= EPS ? 0 : 1 / length;
          dx *= inverse;
          dy *= inverse;
          dz *= inverse;
          ox = camera.position.x;
          oy = camera.position.y;
          oz = camera.position.z;
        }
        const forwardRate = perspective ? dx * fx + dy * fy + dz * fz : orthoRate;
        if (forwardRate <= 0) continue;
        const tMin = perspective ? camera.near / forwardRate : 0;
        const tMax = Math.min(
          closest[pixel],
          perspective ? camera.far / forwardRate : orthoFar
        );
        if (prepared) {
          if (!prepared.intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit))
            continue;
        } else {
          const fallback = primitive.intersect(
            { origin: new Vec3(ox, oy, oz), dir: new Vec3(dx, dy, dz) },
            tMin,
            tMax
          );
          if (!fallback) continue;
          hit.t = fallback.t;
          hit.nx = fallback.normal.x;
          hit.ny = fallback.normal.y;
          hit.nz = fallback.normal.z;
        }
        if (hit.t < tMin || hit.t > tMax || primitiveIndices[pixel] !== -1 && hit.t === closest[pixel])
          continue;
        closest[pixel] = hit.t;
        primitiveIndices[pixel] = index;
        depth[pixel] = originDepth + hit.t * forwardRate;
        const offset = pixel * 3;
        if (prepared && (hit.nx !== 0 || hit.ny !== 0 || hit.nz !== 0)) {
          normals[offset] = hit.nx;
          normals[offset + 1] = hit.ny;
          normals[offset + 2] = hit.nz;
        } else {
          const normalLength = Math.hypot(hit.nx, hit.ny, hit.nz);
          if (normalLength > 0) {
            normals[offset] = hit.nx / normalLength;
            normals[offset + 1] = hit.ny / normalLength;
            normals[offset + 2] = hit.nz / normalLength;
          } else {
            normals[offset] = -dx;
            normals[offset + 1] = -dy;
            normals[offset + 2] = -dz;
          }
        }
      }
    }
  }
  return buffer;
}
function renderOverlappingSurfaces(primitives, camera, buffer, clipX, clipY, clipZ, clipW) {
  const { width, height, primitiveIndices, depth, normals } = buffer;
  const candidates = [];
  let areaSum = 0, x0 = width, x1 = 0, y0 = height, y1 = 0;
  for (let index = 0; index < primitives.length; index++) {
    const prepared = createPreparedPrimitiveIntersector(primitives[index]);
    if (!prepared) return false;
    const bounds = projectedBounds(prepared.bounds, camera, width, height);
    if (!bounds) continue;
    candidates.push({ index, prepared, bounds });
    areaSum += (bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0);
    x0 = Math.min(x0, bounds.x0);
    x1 = Math.max(x1, bounds.x1);
    y0 = Math.min(y0, bounds.y0);
    y1 = Math.max(y1, bounds.y1);
  }
  if (candidates.length < 2 || areaSum <= 1.3 * (x1 - x0) * (y1 - y0))
    return false;
  const m = camera.viewProjInv.m;
  const { x: ox, y: oy, z: oz } = camera.position;
  const { x: fx, y: fy, z: fz } = camera.forward;
  const hit = { t: 0, nx: 0, ny: 0, nz: 0 };
  const active = [];
  for (let y = y0; y < y1; y++) {
    active.length = 0;
    let rowLeft = width, rowRight = 0;
    for (const candidate of candidates) {
      const b = candidate.bounds;
      if (y < b.y0 || y >= b.y1) continue;
      active.push(candidate);
      rowLeft = Math.min(rowLeft, b.x0);
      rowRight = Math.max(rowRight, b.x1);
    }
    const ndcY = 1 - (y + 0.5) / height * 2;
    const rowX = m[4] * ndcY, rowY = m[5] * ndcY, rowZ = m[6] * ndcY, rowW = m[7] * ndcY;
    for (let x = rowLeft; x < rowRight; x++) {
      const cx = clipX[x] + rowX, cy = clipY[x] + rowY, cz = clipZ[x] + rowZ, cw = clipW[x] + rowW;
      const nearW = cw - m[11] + m[15] || 1;
      const nearX = (cx - m[8] + m[12]) / nearW;
      const nearY = (cy - m[9] + m[13]) / nearW;
      const nearZ = (cz - m[10] + m[14]) / nearW;
      const farW = cw + m[11] + m[15] || 1;
      let dx = (cx + m[8] + m[12]) / farW - nearX;
      let dy = (cy + m[9] + m[13]) / farW - nearY;
      let dz = (cz + m[10] + m[14]) / farW - nearZ;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const inverse = length <= EPS ? 0 : 1 / length;
      dx *= inverse;
      dy *= inverse;
      dz *= inverse;
      const rate = dx * fx + dy * fy + dz * fz;
      if (rate <= 0) continue;
      const tMin = camera.near / rate;
      let closest = camera.far / rate, owner = -1, nx = 0, ny = 0, nz = 0;
      for (const candidate of active) {
        if (x < candidate.bounds.x0 || x >= candidate.bounds.x1) continue;
        if (!candidate.prepared.intersect(
          ox,
          oy,
          oz,
          dx,
          dy,
          dz,
          tMin,
          closest,
          hit
        ))
          continue;
        if (hit.t < tMin || hit.t > closest || owner !== -1 && hit.t === closest)
          continue;
        closest = hit.t;
        owner = candidate.index;
        nx = hit.nx;
        ny = hit.ny;
        nz = hit.nz;
      }
      if (owner < 0) continue;
      const pixel = y * width + x, offset = pixel * 3;
      primitiveIndices[pixel] = owner;
      depth[pixel] = closest * rate;
      if (nx !== 0 || ny !== 0 || nz !== 0) {
        normals[offset] = nx;
        normals[offset + 1] = ny;
        normals[offset + 2] = nz;
      } else {
        normals[offset] = -dx;
        normals[offset + 1] = -dy;
        normals[offset + 2] = -dz;
      }
    }
  }
  return true;
}
function cameraPoseAndMatricesAgree(camera) {
  const view = camera.view.m;
  const { x, y, z } = camera.position;
  const poseTolerance = Number.EPSILON * 64 * Math.max(
    1,
    Math.abs(x),
    Math.abs(y),
    Math.abs(z),
    Math.abs(view[12]),
    Math.abs(view[13]),
    Math.abs(view[14])
  );
  for (let row = 0; row < 3; row++) {
    const translated = view[row] * x + view[row + 4] * y + view[row + 8] * z + view[row + 12];
    if (!(Math.abs(translated) <= poseTolerance)) return false;
  }
  if (!(Math.abs(camera.forward.x + view[2]) <= 1e-12) || !(Math.abs(camera.forward.y + view[6]) <= 1e-12) || !(Math.abs(camera.forward.z + view[10]) <= 1e-12))
    return false;
  const projection = camera.viewProj.m, inverse = camera.viewProjInv.m;
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let value = 0, magnitude = 0;
      for (let k = 0; k < 4; k++) {
        const term = projection[k * 4 + row] * inverse[column * 4 + k];
        value += term;
        magnitude += Math.abs(term);
      }
      const expected = row === column ? 1 : 0;
      if (!(Math.abs(value - expected) <= Number.EPSILON * 128 * Math.max(1, magnitude)))
        return false;
    }
  }
  return true;
}
function renderGenericSurfaces(primitives, camera, buffer) {
  const { width, height, primitiveIndices, depth, normals } = buffer;
  const originDepth = camera.kind === "orthographic" ? camera.near : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ray = camera.screenToRay(x + 0.5, y + 0.5, width, height);
      const rate = Vec3.dot(ray.dir, camera.forward);
      if (rate <= 0) continue;
      const tMin = (camera.near - originDepth) / rate;
      let closest = (camera.far - originDepth) / rate;
      const pixel = y * width + x;
      for (let index = 0; index < primitives.length; index++) {
        const hit = primitives[index].intersect(ray, tMin, closest);
        if (!hit || hit.t < tMin || hit.t > closest) continue;
        if (primitiveIndices[pixel] !== -1 && hit.t === closest) continue;
        closest = hit.t;
        primitiveIndices[pixel] = index;
        depth[pixel] = originDepth + hit.t * rate;
        const length = Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z);
        const offset = pixel * 3;
        normals[offset] = length > 0 ? hit.normal.x / length : -ray.dir.x;
        normals[offset + 1] = length > 0 ? hit.normal.y / length : -ray.dir.y;
        normals[offset + 2] = length > 0 ? hit.normal.z / length : -ray.dir.z;
      }
    }
  }
}
function projectedBounds(bounds, camera, width, height) {
  const m = camera.viewProj.m;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    const x = corner & 1 ? bounds.maxX : bounds.minX;
    const y = corner & 2 ? bounds.maxY : bounds.minY;
    const z = corner & 4 ? bounds.maxZ : bounds.minZ;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!(w > 0)) return { x0: 0, x1: width, y0: 0, y1: height };
    const screenX = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * width;
    const screenY = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * height;
    minX = Math.min(minX, screenX);
    maxX = Math.max(maxX, screenX);
    minY = Math.min(minY, screenY);
    maxY = Math.max(maxY, screenY);
  }
  if (![minX, maxX, minY, maxY].every(Number.isFinite))
    return { x0: 0, x1: width, y0: 0, y1: height };
  const x0 = Math.max(0, Math.floor(minX - 0.5) - 1), x1 = Math.min(width, Math.ceil(maxX - 0.5) + 2);
  const y0 = Math.max(0, Math.floor(minY - 0.5) - 1), y1 = Math.min(height, Math.ceil(maxY - 0.5) + 2);
  return x0 < x1 && y0 < y1 ? { x0, x1, y0, y1 } : null;
}
function buildSurfaceClipPaths(buffer, options = {}) {
  const width = options.width ?? buffer.width;
  const height = options.height ?? buffer.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Surface clip dimensions must be positive finite numbers");
  }
  const scaleX = width / buffer.width;
  const scaleY = height / buffer.height;
  const parts = buffer.primitiveIds.map(() => []);
  let active = [];
  const coordinate = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  const append = (run) => {
    const x0 = coordinate(run.x0 * scaleX);
    const x1 = coordinate(run.x1 * scaleX);
    const y0 = coordinate(run.y0 * scaleY);
    const y1 = coordinate(run.y1 * scaleY);
    parts[run.index].push(`M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`);
  };
  for (let y = 0; y < buffer.height; y++) {
    const next = [];
    let previousIndex = 0;
    let x = 0;
    while (x < buffer.width) {
      const x0 = x;
      const index = buffer.primitiveIndices[y * buffer.width + x];
      while (x < buffer.width && buffer.primitiveIndices[y * buffer.width + x] === index)
        x++;
      if (index < 0 || index >= parts.length) continue;
      while (previousIndex < active.length && active[previousIndex].x0 < x0)
        append(active[previousIndex++]);
      const previous = active[previousIndex];
      if (previous?.x0 === x0 && previous.x1 === x && previous.index === index) {
        previous.y1 = y + 1;
        previousIndex++;
        next.push(previous);
      } else {
        next.push({ index, x0, x1: x, y0: y, y1: y + 1 });
      }
    }
    while (previousIndex < active.length) append(active[previousIndex++]);
    active = next;
  }
  for (const run of active) append(run);
  const byId = /* @__PURE__ */ new Map();
  for (let index = 0; index < buffer.primitiveIds.length; index++) {
    const id = buffer.primitiveIds[index];
    const existing = byId.get(id);
    if (existing) existing.push(...parts[index]);
    else byId.set(id, parts[index]);
  }
  return [...byId].map(([primitiveId, commands]) => ({
    primitiveId,
    path: commands.join(" ")
  }));
}
function shadeSurfaceBuffer(buffer, options) {
  const light = Vec3.normalize(options.lightDirection);
  const ambient = Math.max(0, Math.min(1, options.ambient ?? 0.35));
  const tones = { ...PAPER_TONES, ...options.tones };
  const shadow = tones.shadow;
  const span2 = options.tones ? tones.lit - tones.shadow : 0.27;
  const rgba = new Uint8ClampedArray(buffer.width * buffer.height * 4);
  if (options.selectedId == null) {
    for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
      if (buffer.primitiveIndices[pixel] < 0) continue;
      const offset = pixel * 3;
      const lambert = Math.max(
        0,
        buffer.normals[offset] * light.x + buffer.normals[offset + 1] * light.y + buffer.normals[offset + 2] * light.z
      );
      const brightness = shadow + span2 * (ambient + (1 - ambient) * lambert);
      const value = brightness * 255;
      const colorOffset = pixel * 4;
      rgba[colorOffset] = value;
      rgba[colorOffset + 1] = value;
      rgba[colorOffset + 2] = value;
      rgba[colorOffset + 3] = 255;
    }
    return applyUnlitSurfaces(
      buffer,
      rgba,
      options.unlitPrimitiveIds,
      tones.unlit
    );
  }
  const selectedOwners = Uint8Array.from(
    buffer.primitiveIds,
    (id) => options.selectedId != null && id === options.selectedId ? 1 : 0
  );
  for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
    const index = buffer.primitiveIndices[pixel];
    if (index < 0) continue;
    const offset = pixel * 3;
    const lambert = Math.max(
      0,
      buffer.normals[offset] * light.x + buffer.normals[offset + 1] * light.y + buffer.normals[offset + 2] * light.z
    );
    const brightness = shadow + span2 * (ambient + (1 - ambient) * lambert);
    const value = brightness * 255;
    const selected = selectedOwners[index] === 1;
    const colorOffset = pixel * 4;
    rgba[colorOffset] = selected ? value * 0.88 : value;
    rgba[colorOffset + 1] = value;
    rgba[colorOffset + 2] = selected ? value * 0.92 : value;
    rgba[colorOffset + 3] = 255;
  }
  return applyUnlitSurfaces(
    buffer,
    rgba,
    options.unlitPrimitiveIds,
    tones.unlit
  );
}
function applyUnlitSurfaces(buffer, rgba, primitiveIds, unlit) {
  if (!primitiveIds?.length) return rgba;
  const ids = new Set(primitiveIds);
  const unlitOwners = Uint8Array.from(
    buffer.primitiveIds,
    (id) => ids.has(id) ? 1 : 0
  );
  const value = Math.round(Math.max(0, Math.min(1, unlit)) * 255);
  for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
    const owner = buffer.primitiveIndices[pixel];
    if (owner >= 0 && unlitOwners[owner]) {
      rgba.fill(value, pixel * 4, pixel * 4 + 3);
      rgba[pixel * 4 + 3] = 255;
    }
  }
  return rgba;
}
function lightDirectionFromAngles(azimuthDegrees, elevationDegrees) {
  const azimuth = azimuthDegrees * Math.PI / 180;
  const elevation = elevationDegrees * Math.PI / 180;
  const horizontal = Math.cos(elevation);
  return new Vec3(
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation),
    Math.cos(azimuth) * horizontal
  );
}
function defaultNow() {
  const p = globalThis.performance;
  if (p && typeof p.now === "function") return p.now();
  return Date.now();
}
function createProfiler() {
  const counts = /* @__PURE__ */ new Map();
  const ms = /* @__PURE__ */ new Map();
  const open = /* @__PURE__ */ new Map();
  const now = () => defaultNow();
  const reset = () => {
    counts.clear();
    ms.clear();
    open.clear();
  };
  const inc = (name, by = 1) => {
    counts.set(name, (counts.get(name) ?? 0) + by);
  };
  const addMs = (name, v) => {
    ms.set(name, (ms.get(name) ?? 0) + v);
  };
  const begin = (name) => {
    open.set(name, now());
  };
  const end = (name) => {
    const t0 = open.get(name);
    if (t0 === void 0) return;
    open.delete(name);
    addMs(name, now() - t0);
  };
  const report = () => {
    const countsObj = {};
    const msObj = {};
    for (const [k, v] of counts) countsObj[k] = v;
    for (const [k, v] of ms) msObj[k] = v;
    const totalMs = msObj["render.total"] ?? 0;
    return { totalMs, ms: msObj, counts: countsObj };
  };
  return { reset, inc, addMs, begin, end, report, now };
}
function formatProfileReport(r) {
  const lines = [];
  lines.push(`total: ${r.totalMs.toFixed(2)}ms`);
  const msEntries = Object.entries(r.ms).sort((a, b) => b[1] - a[1]);
  if (msEntries.length) {
    lines.push("ms:");
    for (const [k, v] of msEntries) lines.push(`  ${k}: ${v.toFixed(2)}`);
  }
  const cEntries = Object.entries(r.counts).sort((a, b) => b[1] - a[1]);
  if (cEntries.length) {
    lines.push("counts:");
    for (const [k, v] of cEntries) lines.push(`  ${k}: ${v}`);
  }
  return lines.join("\n");
}
function parseObj(source) {
  const text = decodeText(source);
  const warnings = [];
  const warnedKeywords = /* @__PURE__ */ new Set();
  const vertices = [];
  const chunks = [];
  let currentName = "mesh-1";
  let autoId = 1;
  let currentChunkIndex = -1;
  const getChunk = () => {
    if (currentChunkIndex >= 0) return chunks[currentChunkIndex];
    const chunk = { name: currentName, triangles: [] };
    currentChunkIndex = chunks.length;
    chunks.push(chunk);
    if (currentName.startsWith("mesh-")) autoId += 1;
    return chunk;
  };
  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = lines[lineNo];
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [keyword, ...rest] = line.split(/\s+/);
    if (keyword === "v") {
      if (rest.length < 3) {
        warnings.push(`Line ${lineNo + 1}: invalid vertex record.`);
        continue;
      }
      const x = Number(rest[0]);
      const y = Number(rest[1]);
      const z = Number(rest[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        warnings.push(`Line ${lineNo + 1}: invalid vertex coordinates.`);
        continue;
      }
      vertices.push(new Vec3(x, y, z));
      continue;
    }
    if (keyword === "o" || keyword === "g") {
      const name = rest.join(" ").trim();
      if (name) {
        currentName = name;
      } else {
        currentName = `mesh-${autoId}`;
      }
      currentChunkIndex = -1;
      continue;
    }
    if (keyword === "f") {
      if (rest.length < 3) {
        warnings.push(`Line ${lineNo + 1}: face needs at least 3 vertices.`);
        continue;
      }
      const faceIndices = [];
      let invalid = false;
      for (const token of rest) {
        const index = parseObjVertexIndex(token, vertices.length);
        if (index === null || index < 0 || index >= vertices.length) {
          warnings.push(`Line ${lineNo + 1}: invalid face index "${token}".`);
          invalid = true;
          break;
        }
        faceIndices.push(index);
      }
      if (invalid) continue;
      const chunk = getChunk();
      for (let i = 1; i < faceIndices.length - 1; i++) {
        chunk.triangles.push([
          faceIndices[0],
          faceIndices[i],
          faceIndices[i + 1]
        ]);
      }
      continue;
    }
    if (keyword === "mtllib" || keyword === "usemtl" || keyword === "vt" || keyword === "l" || keyword === "p" || keyword === "curv") {
      if (!warnedKeywords.has(keyword)) {
        warnings.push(`OBJ keyword "${keyword}" is ignored in v1.`);
        warnedKeywords.add(keyword);
      }
      continue;
    }
    if (keyword === "vn") continue;
    if (!warnedKeywords.has(keyword)) {
      warnings.push(`OBJ keyword "${keyword}" is not supported and was ignored.`);
      warnedKeywords.add(keyword);
    }
  }
  const meshes = chunks.map(
    (chunk, index) => buildMeshFromGlobal(
      `mesh-${index + 1}`,
      chunk.name,
      vertices,
      chunk.triangles
    )
  ).filter((mesh) => mesh !== null);
  if (meshes.length === 0 && vertices.length > 0) {
    warnings.push("OBJ parsed, but no valid triangles were found.");
  }
  if (meshes.length === 0 && vertices.length === 0) {
    warnings.push("OBJ file did not contain any vertex data.");
  }
  return {
    meshes,
    bounds: meshes.length > 0 ? mergeBounds(meshes.map((mesh) => mesh.bounds)) : {
      min: Vec3.zero(),
      max: Vec3.zero()
    },
    warnings
  };
}
function buildMeshFromGlobal(fallbackName, name, vertices, triangles) {
  if (triangles.length === 0) return null;
  const localVertices = [];
  const localTriangles = [];
  const remap = /* @__PURE__ */ new Map();
  const localIndexOf = (globalIndex) => {
    const existing = remap.get(globalIndex);
    if (existing !== void 0) return existing;
    const next = localVertices.length;
    localVertices.push(vertices[globalIndex]);
    remap.set(globalIndex, next);
    return next;
  };
  for (const tri of triangles) {
    localTriangles.push([
      localIndexOf(tri[0]),
      localIndexOf(tri[1]),
      localIndexOf(tri[2])
    ]);
  }
  const mesh = new TriangleMesh(name || fallbackName, localVertices, localTriangles);
  return mesh.triangleCount > 0 ? mesh : null;
}
function parseObjVertexIndex(token, vertexCount) {
  const head = token.split("/")[0]?.trim();
  if (!head) return null;
  const raw = Number(head);
  if (!Number.isInteger(raw) || raw === 0) return null;
  return raw > 0 ? raw - 1 : vertexCount + raw;
}
function decodeText(source) {
  if (typeof source === "string") return source;
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  return new TextDecoder().decode(bytes);
}
function parseStl(source) {
  const warnings = [];
  const bytes = toBytes(source);
  const parsed = typeof source === "string" ? parseAsciiStl(source, warnings) : detectBinaryStl(bytes) ? parseBinaryStl(bytes, warnings) : parseAsciiStl(new TextDecoder().decode(bytes), warnings);
  const mesh = new TriangleMesh("mesh-1", parsed.vertices, parsed.triangles);
  if (mesh.triangleCount === 0) warnings.push("STL file did not contain valid triangles.");
  return {
    meshes: mesh.triangleCount > 0 ? [mesh] : [],
    bounds: mesh.bounds,
    warnings
  };
}
function parseAsciiStl(text, warnings) {
  const vertices = [];
  const triangles = [];
  let pending = [];
  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo].trim();
    if (!line) continue;
    const match = /^vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)$/i.exec(line);
    if (!match) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    const z = Number(match[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      warnings.push(`Line ${lineNo + 1}: invalid STL vertex.`);
      pending = [];
      continue;
    }
    const index = vertices.length;
    vertices.push(new Vec3(x, y, z));
    pending.push(index);
    if (pending.length === 3) {
      triangles.push([pending[0], pending[1], pending[2]]);
      pending = [];
    }
  }
  if (pending.length !== 0) {
    warnings.push("ASCII STL ended with an incomplete facet.");
  }
  return { vertices, triangles };
}
function parseBinaryStl(bytes, warnings) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const faceCount = view.getUint32(80, true);
  const expectedBytes = 84 + faceCount * 50;
  if (expectedBytes > bytes.byteLength) {
    warnings.push("Binary STL header length did not match payload size.");
  }
  const vertices = [];
  const triangles = [];
  let offset = 84;
  for (let i = 0; i < faceCount && offset + 50 <= bytes.byteLength; i++) {
    offset += 12;
    const a = readBinaryVertex(view, offset);
    offset += 12;
    const b = readBinaryVertex(view, offset);
    offset += 12;
    const c = readBinaryVertex(view, offset);
    offset += 12;
    const base = vertices.length;
    vertices.push(a, b, c);
    triangles.push([base, base + 1, base + 2]);
    offset += 2;
  }
  return { vertices, triangles };
}
function readBinaryVertex(view, offset) {
  return new Vec3(
    view.getFloat32(offset, true),
    view.getFloat32(offset + 4, true),
    view.getFloat32(offset + 8, true)
  );
}
function detectBinaryStl(bytes) {
  if (bytes.byteLength < 84) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  return 84 + count * 50 === bytes.byteLength;
}
function toBytes(source) {
  if (typeof source === "string") return new TextEncoder().encode(source);
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}
export {
  BoxAabb,
  CSG_TOLERANCE,
  Camera,
  Cone,
  Csg,
  Cylinder,
  DEFAULT_HLR_PARAMS,
  DEFAULT_INTERSECTION_PARAMS,
  DEFAULT_MESH_PARAMS,
  Disk,
  EPS,
  Mat4,
  OrientedBox,
  PAPER_TONES,
  PlaneRect,
  Scene2 as Scene,
  Sphere,
  SvgRenderer,
  TriangleMesh,
  Vec3,
  almostEqual,
  bordersForPrimitives,
  boundsFromPoints,
  boxEdgesForPrimitives,
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
  cachedIntersectionCurvesToOwnedCubics,
  circleToCubics3,
  clamp01$1 as clamp01,
  coneGeneratorsToCubics3,
  coneSilhouetteToCubics3,
  createProfiler,
  csgBoundaryCurves,
  csgCurvesForPrimitives,
  csgSpans,
  curvesFromPrimitives,
  cylinderGeneratorsToCubics3,
  cylinderSilhouetteToCubics3,
  dedupeSorted,
  defaultBezierFitParams,
  defaultCurveInclude,
  evalCubic3,
  findVisibilityCutsOnCubic,
  findVisibilityCutsOnCubicWithVisibility,
  fitPolylineToCubics,
  formatProfileReport,
  intersectionCurvesToCubics,
  intersectionCurvesToOwnedCubics,
  intersectionGeometrySignature,
  leafDistance,
  lightDirectionFromAngles,
  lineToCubic3,
  mergeBounds,
  meshFeatureCurves,
  parseObj,
  parseStl,
  piecesToSvg,
  projectPiecesToSvgPaths,
  projectedPathsToSvg,
  refineVisibilityCutBisection,
  renderPrimitivesToSvg,
  renderToSvg,
  rimsForPrimitives,
  shadeSurfaceBuffer,
  silhouettesForPrimitives,
  sphereSilhouetteToCubics3,
  splitCubic3,
  splitCubicByVisibility,
  splitCubicByVisibilityWithIgnore,
  splitCubicWhere,
  splitLineCubicByVisibilityAdaptive,
  subCubic3
};
