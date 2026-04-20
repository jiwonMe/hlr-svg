import type { Camera } from "../../camera/camera.js";
import { EPS } from "../../math/eps.js";
import { Vec3 } from "../../math/vec3.js";
import type { Hit, Ray } from "../ray.js";
import type { Primitive } from "../primitive.js";

const DEFAULT_WELD_SCALE = 1e-6;
const MIN_WELD_EPS = 1e-9;
const BVH_LEAF_SIZE = 8;

export type TriangleIndices = readonly [number, number, number];

export type Bounds3 = {
  min: Vec3;
  max: Vec3;
};

export type MeshFeatureKind =
  | "boundary"
  | "nonManifold"
  | "crease"
  | "silhouette";

export type MeshFeatureEdge = {
  kind: MeshFeatureKind;
  start: Vec3;
  end: Vec3;
};

type TriangleFace = {
  indices: [number, number, number];
  a: Vec3;
  b: Vec3;
  c: Vec3;
  normal: Vec3;
  center: Vec3;
  bounds: Bounds3;
};

type TopologyEdge = {
  a: number;
  b: number;
  faces: number[];
};

type BvhNode = {
  bounds: Bounds3;
  left: BvhNode | null;
  right: BvhNode | null;
  faceIndices: number[] | null;
};

type RayBoundsHit = {
  tNear: number;
  tFar: number;
};

type TriangleHit = {
  t: number;
  point: Vec3;
  normal: Vec3;
};

type WeldResult = {
  vertices: Vec3[];
  remap: number[];
};

export class TriangleMesh implements Primitive {
  readonly vertices: readonly Vec3[];
  readonly triangles: readonly TriangleIndices[];
  readonly bounds: Bounds3;
  readonly weldEps: number;

  private readonly faces: readonly TriangleFace[];
  private readonly topologyEdges: readonly TopologyEdge[];
  private readonly bvh: BvhNode | null;

  constructor(
    public readonly id: string,
    vertices: readonly Vec3[],
    triangles: readonly TriangleIndices[],
  ) {
    const sourceBounds = boundsFromPoints(vertices);
    const diagonal = Vec3.distance(sourceBounds.min, sourceBounds.max);
    this.weldEps = Math.max(diagonal * DEFAULT_WELD_SCALE, MIN_WELD_EPS);

    const welded = weldVertices(vertices, this.weldEps);
    const builtFaces = buildFaces(
      welded.vertices,
      triangles,
      welded.remap,
      this.weldEps,
    );
    const edgeMap = buildEdgeMap(builtFaces);

    this.vertices = welded.vertices;
    this.faces = builtFaces;
    this.triangles = builtFaces.map((face) => face.indices);
    this.bounds =
      this.vertices.length > 0 ? boundsFromPoints(this.vertices) : zeroBounds();
    this.topologyEdges = [...edgeMap.values()];
    this.bvh = buildBvh(builtFaces, builtFaces.map((_, index) => index));
  }

  get triangleCount(): number {
    return this.triangles.length;
  }

  get vertexCount(): number {
    return this.vertices.length;
  }

  get edgeCount(): number {
    return this.topologyEdges.length;
  }

  intersect(ray: Ray, tMin: number, tMax: number): Hit | null {
    if (!this.bvh) return null;
    const hit = intersectNode(this.bvh, ray, tMin, tMax, this.faces);
    if (!hit) return null;
    return { ...hit, primitiveId: this.id };
  }

  featureEdges(
    camera: Camera,
    opts: { creaseAngleDeg?: number } = {},
  ): MeshFeatureEdge[] {
    const creaseAngleDeg = opts.creaseAngleDeg ?? 30;
    const creaseCos = Math.cos((creaseAngleDeg * Math.PI) / 180);
    const out: MeshFeatureEdge[] = [];

    for (const edge of this.topologyEdges) {
      const kind = classifyFeatureEdge(edge, this.faces, camera, creaseCos);
      if (!kind) continue;
      out.push({
        kind,
        start: this.vertices[edge.a]!,
        end: this.vertices[edge.b]!,
      });
    }

    return out;
  }
}

function classifyFeatureEdge(
  edge: TopologyEdge,
  faces: readonly TriangleFace[],
  camera: Camera,
  creaseCos: number,
): MeshFeatureKind | null {
  if (edge.faces.length === 1) return "boundary";
  if (edge.faces.length !== 2) return "nonManifold";

  const face0 = faces[edge.faces[0]!]!;
  const face1 = faces[edge.faces[1]!]!;
  const s0 = facingSign(face0, camera);
  const s1 = facingSign(face1, camera);
  if (s0 !== 0 && s1 !== 0 && s0 !== s1) return "silhouette";

  const cosTheta = Vec3.dot(face0.normal, face1.normal);
  if (cosTheta < creaseCos) return "crease";
  return null;
}

function facingSign(face: TriangleFace, camera: Camera): -1 | 0 | 1 {
  const viewDir =
    camera.kind === "perspective"
      ? Vec3.sub(camera.position, face.center)
      : Vec3.mulScalar(camera.forward, -1);
  const dot = Vec3.dot(face.normal, viewDir);
  const eps = 1e-10;
  if (dot > eps) return 1;
  if (dot < -eps) return -1;
  return 0;
}

function buildFaces(
  vertices: readonly Vec3[],
  triangles: readonly TriangleIndices[],
  remap: readonly number[],
  weldEps: number,
): TriangleFace[] {
  const out: TriangleFace[] = [];
  const areaEpsSq = Math.max(weldEps * weldEps, MIN_WELD_EPS * MIN_WELD_EPS);

  for (const tri of triangles) {
    const ia = remap[tri[0]];
    const ib = remap[tri[1]];
    const ic = remap[tri[2]];
    if (ia === undefined || ib === undefined || ic === undefined) continue;
    if (ia === ib || ib === ic || ic === ia) continue;

    const a = vertices[ia]!;
    const b = vertices[ib]!;
    const c = vertices[ic]!;
    const ab = Vec3.sub(b, a);
    const ac = Vec3.sub(c, a);
    const cross = Vec3.cross(ab, ac);
    if (Vec3.lenSq(cross) <= areaEpsSq) continue;

    const normal = Vec3.normalize(cross);
    const center = new Vec3(
      (a.x + b.x + c.x) / 3,
      (a.y + b.y + c.y) / 3,
      (a.z + b.z + c.z) / 3,
    );
    out.push({
      indices: [ia, ib, ic],
      a,
      b,
      c,
      normal,
      center,
      bounds: boundsFromPoints([a, b, c]),
    });
  }

  return out;
}

function buildEdgeMap(faces: readonly TriangleFace[]): Map<string, TopologyEdge> {
  const edges = new Map<string, TopologyEdge>();

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
    const [a, b, c] = faces[faceIndex]!.indices;
    addEdge(edges, a, b, faceIndex);
    addEdge(edges, b, c, faceIndex);
    addEdge(edges, c, a, faceIndex);
  }

  return edges;
}

function addEdge(
  edges: Map<string, TopologyEdge>,
  i0: number,
  i1: number,
  faceIndex: number,
): void {
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

function weldVertices(
  vertices: readonly Vec3[],
  weldEps: number,
): WeldResult {
  const buckets = new Map<string, number[]>();
  const out: Vec3[] = [];
  const remap = new Array<number>(vertices.length);
  const invCell = 1 / Math.max(weldEps, MIN_WELD_EPS);
  const maxDistSq = weldEps * weldEps;

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!;
    const cellX = Math.floor(v.x * invCell);
    const cellY = Math.floor(v.y * invCell);
    const cellZ = Math.floor(v.z * invCell);

    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) {
      for (let dy = -1; dy <= 1 && found < 0; dy++) {
        for (let dz = -1; dz <= 1 && found < 0; dz++) {
          const bucket = buckets.get(
            bucketKey(cellX + dx, cellY + dy, cellZ + dz),
          );
          if (!bucket) continue;
          for (const candidate of bucket) {
            if (Vec3.distanceSq(out[candidate]!, v) <= maxDistSq) {
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

function bucketKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function buildBvh(
  faces: readonly TriangleFace[],
  faceIndices: readonly number[],
): BvhNode | null {
  if (faceIndices.length === 0) return null;
  const bounds = mergeFaceBounds(faceIndices, faces);

  if (faceIndices.length <= BVH_LEAF_SIZE) {
    return {
      bounds,
      left: null,
      right: null,
      faceIndices: [...faceIndices],
    };
  }

  const axis = longestAxis(bounds);
  const sorted = [...faceIndices].sort((a, b) => {
    const ca = faces[a]!.center[axis];
    const cb = faces[b]!.center[axis];
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
      faceIndices: [...faceIndices],
    };
  }

  return { bounds, left, right, faceIndices: null };
}

function intersectNode(
  node: BvhNode,
  ray: Ray,
  tMin: number,
  tMax: number,
  faces: readonly TriangleFace[],
): TriangleHit | null {
  const boundsHit = intersectBounds(ray, node.bounds, tMin, tMax);
  if (!boundsHit) return null;

  let bestT = Math.min(tMax, boundsHit.tFar);
  let best: TriangleHit | null = null;

  if (node.faceIndices) {
    for (const faceIndex of node.faceIndices) {
      const hit = intersectTriangle(ray, faces[faceIndex]!, bestT);
      if (!hit || hit.t < tMin || hit.t > bestT) continue;
      best = hit;
      bestT = hit.t;
    }
    return best;
  }

  const leftHit = node.left
    ? intersectBounds(ray, node.left.bounds, tMin, bestT)
    : null;
  const rightHit = node.right
    ? intersectBounds(ray, node.right.bounds, tMin, bestT)
    : null;

  const first =
    !rightHit || (leftHit && leftHit.tNear <= rightHit.tNear)
      ? node.left
      : node.right;
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

function intersectTriangle(
  ray: Ray,
  face: TriangleFace,
  tMax: number,
): TriangleHit | null {
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
    normal: face.normal,
  };
}

function intersectBounds(
  ray: Ray,
  bounds: Bounds3,
  tMin: number,
  tMax: number,
): RayBoundsHit | null {
  let near = tMin;
  let far = tMax;
  const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];

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

function mergeFaceBounds(
  faceIndices: readonly number[],
  faces: readonly TriangleFace[],
): Bounds3 {
  const first = faces[faceIndices[0]!]!.bounds;
  let minX = first.min.x;
  let minY = first.min.y;
  let minZ = first.min.z;
  let maxX = first.max.x;
  let maxY = first.max.y;
  let maxZ = first.max.z;

  for (let i = 1; i < faceIndices.length; i++) {
    const bounds = faces[faceIndices[i]!]!.bounds;
    minX = Math.min(minX, bounds.min.x);
    minY = Math.min(minY, bounds.min.y);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxY = Math.max(maxY, bounds.max.y);
    maxZ = Math.max(maxZ, bounds.max.z);
  }

  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ),
  };
}

function longestAxis(bounds: Bounds3): "x" | "y" | "z" {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const dz = bounds.max.z - bounds.min.z;
  if (dx >= dy && dx >= dz) return "x";
  if (dy >= dz) return "y";
  return "z";
}

export function boundsFromPoints(points: readonly Vec3[]): Bounds3 {
  if (points.length === 0) return zeroBounds();

  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let minZ = points[0]!.z;
  let maxX = points[0]!.x;
  let maxY = points[0]!.y;
  let maxZ = points[0]!.z;

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ),
  };
}

export function mergeBounds(boundsList: readonly Bounds3[]): Bounds3 {
  if (boundsList.length === 0) return zeroBounds();

  let minX = boundsList[0]!.min.x;
  let minY = boundsList[0]!.min.y;
  let minZ = boundsList[0]!.min.z;
  let maxX = boundsList[0]!.max.x;
  let maxY = boundsList[0]!.max.y;
  let maxZ = boundsList[0]!.max.z;

  for (let i = 1; i < boundsList.length; i++) {
    const bounds = boundsList[i]!;
    minX = Math.min(minX, bounds.min.x);
    minY = Math.min(minY, bounds.min.y);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxY = Math.max(maxY, bounds.max.y);
    maxZ = Math.max(maxZ, bounds.max.z);
  }

  return {
    min: new Vec3(minX, minY, minZ),
    max: new Vec3(maxX, maxY, maxZ),
  };
}

function zeroBounds(): Bounds3 {
  return {
    min: Vec3.zero(),
    max: Vec3.zero(),
  };
}
