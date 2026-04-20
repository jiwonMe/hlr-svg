import type { Camera } from "../camera/camera.js";
import type { CubicBezier3 } from "../curves/cubicBezier3.js";
import { evalCubic3 } from "../curves/cubicBezier3.js";
import { Mat4 } from "../math/mat4.js";
import { Vec3 } from "../math/vec3.js";
import type { Primitive } from "../scene/primitive.js";
import { BoxAabb } from "../scene/primitives/boxAabb.js";
import { Cone } from "../scene/primitives/cone.js";
import { Cylinder } from "../scene/primitives/cylinder.js";
import { Disk } from "../scene/primitives/disk.js";
import { PlaneRect } from "../scene/primitives/planeRect.js";
import { Sphere } from "../scene/primitives/sphere.js";
import {
  TriangleMesh,
  type TriangleIndices,
} from "../scene/primitives/triangleMesh.js";
import {
  curvesFromPrimitives,
  defaultCurveInclude,
  meshFeatureCurves,
  type CurveInclude,
} from "./curves.js";
import {
  DEFAULT_MESH_PARAMS,
  resolveLineStyle,
  type LineStyle,
  type MeshRenderParams,
} from "./renderSnapshot.js";
import type { Scene } from "./scene.js";

export type GpuPreviewCurveSampling = {
  minSegmentsPerCubic: number;
  maxSegmentsPerCubic: number;
  targetPixelsPerSegment: number;
};

export type GpuPreviewOptions = {
  width: number;
  height: number;
  background?: boolean;
  style?: Partial<LineStyle>;
  include?: CurveInclude;
  mesh?: Partial<MeshRenderParams>;
  curves?: readonly CubicBezier3[];
  curveSampling?: Partial<GpuPreviewCurveSampling>;
};

export type GpuPreviewSurfaceMesh = {
  positions: Float32Array;
  indices: Uint32Array;
};

export type GpuPreviewLineBuffer = {
  vertices: Float32Array;
  indices: Uint32Array;
  segmentCount: number;
};

export type GpuPreviewFrame = {
  width: number;
  height: number;
  background: boolean;
  style: LineStyle;
  viewProj: Float32Array;
  surfaces: readonly GpuPreviewSurfaceMesh[];
  lines: GpuPreviewLineBuffer;
};

const DEFAULT_CURVE_SAMPLING: GpuPreviewCurveSampling = {
  minSegmentsPerCubic: 1,
  maxSegmentsPerCubic: 32,
  targetPixelsPerSegment: 18,
};

const SURFACE_CACHE = new WeakMap<object, readonly GpuPreviewSurfaceMesh[]>();
const CYLINDER_SEGMENTS = 28;
const CONE_SEGMENTS = 28;
const DISK_SEGMENTS = 28;
const SPHERE_LAT_SEGMENTS = 18;
const SPHERE_LON_SEGMENTS = 28;

export function renderSceneToGpuPreview(
  scene: Scene,
  camera: Camera,
  opts: GpuPreviewOptions,
): GpuPreviewFrame {
  const include = {
    ...defaultCurveInclude(),
    ...(opts.include ?? {}),
  };
  const mesh = {
    ...DEFAULT_MESH_PARAMS,
    ...(opts.mesh ?? {}),
  };
  const curveSampling = {
    ...DEFAULT_CURVE_SAMPLING,
    ...(opts.curveSampling ?? {}),
  };

  const cubics: CubicBezier3[] = [
    ...curvesFromPrimitives(
      scene.primitives,
      camera,
      { ...include, meshEdges: false },
      mesh,
    ),
  ];

  if (include.meshEdges) {
    cubics.push(...meshFeatureCurves(scene.primitives, camera, mesh));
  }
  if (opts.curves) {
    cubics.push(...opts.curves);
  }

  return {
    width: opts.width,
    height: opts.height,
    background: opts.background ?? false,
    style: resolveLineStyle(opts.style),
    viewProj: new Float32Array(Mat4.mul(camera.proj, camera.view).m),
    surfaces: scene.primitives.flatMap((primitive) =>
      previewMeshesForPrimitive(primitive),
    ),
    lines: cubicsToPreviewLines(
      cubics,
      camera,
      opts.width,
      opts.height,
      curveSampling,
    ),
  };
}

function cubicsToPreviewLines(
  cubics: readonly CubicBezier3[],
  camera: Camera,
  width: number,
  height: number,
  sampling: GpuPreviewCurveSampling,
): GpuPreviewLineBuffer {
  const vertices: number[] = [];
  const indices: number[] = [];
  let segmentCount = 0;

  for (const cubic of cubics) {
    const points = flattenCubicForPreview(cubic, camera, width, height, sampling);
    if (points.length < 2) continue;

    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const next = points[i]!;
      const screenLength = Math.hypot(
        next.screenX - prev.screenX,
        next.screenY - prev.screenY,
      );
      if (screenLength <= 1e-4) continue;

      appendLineSegment(
        vertices,
        indices,
        segmentCount,
        prev.world,
        next.world,
        distance,
        distance + screenLength,
      );
      distance += screenLength;
      segmentCount += 1;
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    segmentCount,
  };
}

function appendLineSegment(
  vertices: number[],
  indices: number[],
  segmentIndex: number,
  start: Vec3,
  end: Vec3,
  distanceStart: number,
  distanceEnd: number,
): void {
  const baseVertex = segmentIndex * 4;
  const quad: readonly [number, number][] = [
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ];

  for (const [side, along] of quad) {
    vertices.push(
      start.x,
      start.y,
      start.z,
      end.x,
      end.y,
      end.z,
      distanceStart,
      distanceEnd,
      side,
      along,
    );
  }

  indices.push(
    baseVertex,
    baseVertex + 1,
    baseVertex + 2,
    baseVertex + 2,
    baseVertex + 1,
    baseVertex + 3,
  );
}

function flattenCubicForPreview(
  cubic: CubicBezier3,
  camera: Camera,
  width: number,
  height: number,
  sampling: GpuPreviewCurveSampling,
): Array<{ world: Vec3; screenX: number; screenY: number }> {
  const p0 = camera.projectToSvg(cubic.p0, width, height);
  const p1 = camera.projectToSvg(cubic.p1, width, height);
  const p2 = camera.projectToSvg(cubic.p2, width, height);
  const p3 = camera.projectToSvg(cubic.p3, width, height);

  const chord = distance2d(p0.x, p0.y, p3.x, p3.y);
  const controlSpan = Math.max(
    distance2d(p0.x, p0.y, p1.x, p1.y),
    distance2d(p1.x, p1.y, p2.x, p2.y),
    distance2d(p2.x, p2.y, p3.x, p3.y),
  );
  const deviation = Math.max(
    distancePointToSegment(p1.x, p1.y, p0.x, p0.y, p3.x, p3.y),
    distancePointToSegment(p2.x, p2.y, p0.x, p0.y, p3.x, p3.y),
  );
  const approxPixels = Math.max(chord, controlSpan, deviation * 8);
  const segmentCount = clampInt(
    Math.ceil(approxPixels / sampling.targetPixelsPerSegment),
    sampling.minSegmentsPerCubic,
    sampling.maxSegmentsPerCubic,
  );

  const out: Array<{ world: Vec3; screenX: number; screenY: number }> = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = segmentCount === 0 ? 0 : i / segmentCount;
    const world = i === 0 ? cubic.p0 : i === segmentCount ? cubic.p3 : evalCubic3(cubic, t);
    const screen = camera.projectToSvg(world, width, height);
    out.push({
      world,
      screenX: screen.x,
      screenY: screen.y,
    });
  }
  return out;
}

function distance2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 1e-8) return Math.hypot(px - ax, py - ay);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq),
  );
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  return Math.hypot(px - qx, py - qy);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function previewMeshesForPrimitive(
  primitive: Primitive,
): readonly GpuPreviewSurfaceMesh[] {
  const cached = SURFACE_CACHE.get(primitive);
  if (cached) return cached;

  const built = buildPreviewMeshesForPrimitive(primitive);
  SURFACE_CACHE.set(primitive, built);
  return built;
}

function buildPreviewMeshesForPrimitive(
  primitive: Primitive,
): readonly GpuPreviewSurfaceMesh[] {
  if (primitive instanceof Sphere) {
    return [buildSphereMesh(primitive)];
  }
  if (primitive instanceof Cylinder) {
    return [buildCylinderMesh(primitive)];
  }
  if (primitive instanceof Cone) {
    return [buildConeMesh(primitive)];
  }
  if (primitive instanceof BoxAabb) {
    return [buildBoxMesh(primitive)];
  }
  if (primitive instanceof PlaneRect) {
    return [buildPlaneRectMesh(primitive)];
  }
  if (primitive instanceof Disk) {
    return [buildDiskMesh(primitive)];
  }
  if (primitive instanceof TriangleMesh) {
    return [meshFromTriangles(primitive.vertices, primitive.triangles)];
  }
  return [];
}

function buildSphereMesh(sphere: Sphere): GpuPreviewSurfaceMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const row = SPHERE_LON_SEGMENTS + 1;

  for (let lat = 0; lat <= SPHERE_LAT_SEGMENTS; lat++) {
    const v = lat / SPHERE_LAT_SEGMENTS;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= SPHERE_LON_SEGMENTS; lon++) {
      const u = lon / SPHERE_LON_SEGMENTS;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const p = new Vec3(
        sphere.center.x + sphere.radius * sinTheta * cosPhi,
        sphere.center.y + sphere.radius * cosTheta,
        sphere.center.z + sphere.radius * sinTheta * sinPhi,
      );
      positions.push(p.x, p.y, p.z);
    }
  }

  for (let lat = 0; lat < SPHERE_LAT_SEGMENTS; lat++) {
    for (let lon = 0; lon < SPHERE_LON_SEGMENTS; lon++) {
      const a = lat * row + lon;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function buildCylinderMesh(cylinder: Cylinder): GpuPreviewSurfaceMesh {
  const { u, v } = orthonormalBasis(cylinder.axis);
  const topCenter = Vec3.add(
    cylinder.base,
    Vec3.mulScalar(cylinder.axis, cylinder.height),
  );
  const positions: number[] = [];
  const indices: number[] = [];
  const baseRing: number[] = [];
  const topRing: number[] = [];

  for (let i = 0; i < CYLINDER_SEGMENTS; i++) {
    const angle = (i / CYLINDER_SEGMENTS) * Math.PI * 2;
    const radial = Vec3.add(
      Vec3.mulScalar(u, Math.cos(angle) * cylinder.radius),
      Vec3.mulScalar(v, Math.sin(angle) * cylinder.radius),
    );
    const base = Vec3.add(cylinder.base, radial);
    const top = Vec3.add(topCenter, radial);
    baseRing.push(pushVec3(positions, base));
    topRing.push(pushVec3(positions, top));
  }

  for (let i = 0; i < CYLINDER_SEGMENTS; i++) {
    const next = (i + 1) % CYLINDER_SEGMENTS;
    const b0 = baseRing[i]!;
    const b1 = baseRing[next]!;
    const t0 = topRing[i]!;
    const t1 = topRing[next]!;
    indices.push(b0, t0, b1, b1, t0, t1);
  }

  if (cylinder.caps === "both") {
    appendDiskTriangles(indices, positions, cylinder.base, cylinder.axis, cylinder.radius, baseRing);
    appendDiskTriangles(indices, positions, topCenter, Vec3.mulScalar(cylinder.axis, -1), cylinder.radius, topRing);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function buildConeMesh(cone: Cone): GpuPreviewSurfaceMesh {
  const { u, v } = orthonormalBasis(cone.axis);
  const baseCenter = Vec3.add(cone.apex, Vec3.mulScalar(cone.axis, cone.height));
  const positions: number[] = [];
  const indices: number[] = [];
  const apexIndex = pushVec3(positions, cone.apex);
  const ring: number[] = [];

  for (let i = 0; i < CONE_SEGMENTS; i++) {
    const angle = (i / CONE_SEGMENTS) * Math.PI * 2;
    const radial = Vec3.add(
      Vec3.mulScalar(u, Math.cos(angle) * cone.baseRadius),
      Vec3.mulScalar(v, Math.sin(angle) * cone.baseRadius),
    );
    ring.push(pushVec3(positions, Vec3.add(baseCenter, radial)));
  }

  for (let i = 0; i < CONE_SEGMENTS; i++) {
    const next = (i + 1) % CONE_SEGMENTS;
    indices.push(apexIndex, ring[next]!, ring[i]!);
  }

  if (cone.cap === "base") {
    appendDiskTriangles(indices, positions, baseCenter, cone.axis, cone.baseRadius, ring);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function buildBoxMesh(box: BoxAabb): GpuPreviewSurfaceMesh {
  const { min, max } = box;
  const positions = new Float32Array([
    min.x, min.y, min.z,
    max.x, min.y, min.z,
    min.x, max.y, min.z,
    max.x, max.y, min.z,
    min.x, min.y, max.z,
    max.x, min.y, max.z,
    min.x, max.y, max.z,
    max.x, max.y, max.z,
  ]);

  return {
    positions,
    indices: new Uint32Array([
      0, 1, 2, 2, 1, 3,
      4, 6, 5, 5, 6, 7,
      0, 4, 1, 1, 4, 5,
      2, 3, 6, 6, 3, 7,
      0, 2, 4, 4, 2, 6,
      1, 5, 3, 3, 5, 7,
    ]),
  };
}

function buildPlaneRectMesh(plane: PlaneRect): GpuPreviewSurfaceMesh {
  const ux = Vec3.mulScalar(plane.u, plane.halfWidth);
  const vy = Vec3.mulScalar(plane.v, plane.halfHeight);
  const p0 = Vec3.sub(Vec3.sub(plane.center, ux), vy);
  const p1 = Vec3.add(Vec3.sub(plane.center, vy), ux);
  const p2 = Vec3.add(Vec3.add(plane.center, ux), vy);
  const p3 = Vec3.add(Vec3.sub(plane.center, ux), vy);

  return {
    positions: new Float32Array([
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

function buildDiskMesh(disk: Disk): GpuPreviewSurfaceMesh {
  const { u, v } = orthonormalBasis(disk.normal);
  const positions: number[] = [];
  const indices: number[] = [];
  const centerIndex = pushVec3(positions, disk.center);
  const ring: number[] = [];

  for (let i = 0; i < DISK_SEGMENTS; i++) {
    const angle = (i / DISK_SEGMENTS) * Math.PI * 2;
    const radial = Vec3.add(
      Vec3.mulScalar(u, Math.cos(angle) * disk.radius),
      Vec3.mulScalar(v, Math.sin(angle) * disk.radius),
    );
    ring.push(pushVec3(positions, Vec3.add(disk.center, radial)));
  }

  for (let i = 0; i < DISK_SEGMENTS; i++) {
    const next = (i + 1) % DISK_SEGMENTS;
    indices.push(centerIndex, ring[i]!, ring[next]!);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function appendDiskTriangles(
  indices: number[],
  positions: number[],
  center: Vec3,
  normal: Vec3,
  radius: number,
  ring: readonly number[],
): void {
  const centerIndex = pushVec3(positions, center);
  const orientation = shouldFlipFan(normal) ? -1 : 1;

  void radius;
  for (let i = 0; i < ring.length; i++) {
    const next = (i + 1) % ring.length;
    if (orientation > 0) {
      indices.push(centerIndex, ring[i]!, ring[next]!);
    } else {
      indices.push(centerIndex, ring[next]!, ring[i]!);
    }
  }
}

function shouldFlipFan(normal: Vec3): boolean {
  return Math.abs(normal.y) > Math.abs(normal.x) && Math.abs(normal.y) > Math.abs(normal.z)
    ? normal.y < 0
    : normal.z < 0;
}

function meshFromTriangles(
  vertices: readonly Vec3[],
  triangles: readonly TriangleIndices[],
): GpuPreviewSurfaceMesh {
  const positions = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i]!;
    const base = i * 3;
    positions[base] = vertex.x;
    positions[base + 1] = vertex.y;
    positions[base + 2] = vertex.z;
  }

  const indices = new Uint32Array(triangles.length * 3);
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i]!;
    const base = i * 3;
    indices[base] = tri[0];
    indices[base + 1] = tri[1];
    indices[base + 2] = tri[2];
  }

  return { positions, indices };
}

function orthonormalBasis(normal: Vec3): { u: Vec3; v: Vec3 } {
  const helper =
    Math.abs(normal.z) < 0.9 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
  const u = Vec3.normalize(Vec3.cross(helper, normal));
  const v = Vec3.normalize(Vec3.cross(normal, u));
  return { u, v };
}

function pushVec3(out: number[], point: Vec3): number {
  const index = out.length / 3;
  out.push(point.x, point.y, point.z);
  return index;
}
