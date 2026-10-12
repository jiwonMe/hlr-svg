import { Camera } from "../camera/camera.js";
import { Vec3 } from "../math/vec3.js";
import { EPS } from "../math/eps.js";
import type { Primitive } from "../scene/primitive.js";
import {
  createPreparedPrimitiveIntersector,
  isUnmodifiedNativePrimitive,
  type PreparedPrimitiveIntersector,
  type SurfaceWorldBounds,
} from "./surfaceKernels.js";

const nativeScreenToRay = Camera.prototype.screenToRay;

export type SurfaceBuffer = {
  readonly width: number;
  readonly height: number;
  /** World-space unit normals; three consecutive values per pixel. */
  readonly normals: Float32Array;
  /** Index into primitiveIds, or -1 for a background pixel. */
  readonly primitiveIndices: Int32Array;
  readonly primitiveIds: readonly string[];
  /** Camera-forward depth, in the same units as camera.near and camera.far. */
  readonly depth: Float32Array;
};

export type SurfaceBufferOptions = {
  width: number;
  height: number;
};

export type SurfaceShadingOptions = {
  /** World-space direction from the surface toward the light. */
  lightDirection: Vec3;
  ambient?: number;
  selectedId?: string | null;
};

export type SurfaceClipPath = {
  primitiveId: string;
  path: string;
};

export type SurfaceClipPathOptions = {
  /** Output coordinate size; defaults to the surface buffer resolution. */
  width?: number;
  height?: number;
};

type SurfacePixelRun = {
  index: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

/** Resolve surface ownership once, independently of the current lighting. */
export function buildSurfaceBuffer(
  primitives: readonly Primitive[],
  camera: Camera,
  options: SurfaceBufferOptions,
): SurfaceBuffer {
  const { width, height } = options;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
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
    depth,
  };
  if (primitives.length === 0) return buffer;
  if (
    Object.getPrototypeOf(camera) !== Camera.prototype ||
    camera.screenToRay !== nativeScreenToRay ||
    primitives.some((primitive) => !isUnmodifiedNativePrimitive(primitive))
  ) {
    // A custom ray generator may disagree with the camera matrices or vary its
    // direction even in orthographic mode. Preserve its public call semantics,
    // including one call per pixel, and never infer bounds from those matrices.
    // Custom primitives may also share per-pixel state or inspect ray identity.
    // Preserve the original traversal and Camera-provided Ray in the whole scene.
    renderGenericSurfaces(primitives, camera, buffer);
    return buffer;
  }

  const m = camera.viewProjInv.m;
  const perspective = camera.kind === "perspective";
  const originDepth = perspective ? 0 : camera.near;
  const { x: fx, y: fy, z: fz } = camera.forward;
  const ndcX = Float64Array.from(
    { length: width },
    (_, x) => ((x + 0.5) / width) * 2 - 1,
  );
  const clipX = Float64Array.from(ndcX, (x) => m[0]! * x);
  const clipY = Float64Array.from(ndcX, (x) => m[1]! * x);
  const clipZ = Float64Array.from(ndcX, (x) => m[2]! * x);
  const clipW = Float64Array.from(ndcX, (x) => m[3]! * x);
  const orthoRate = fx * fx + fy * fy + fz * fz;
  const orthoFar = (camera.far - camera.near) / orthoRate;
  const hit = { t: 0, nx: 0, ny: 0, nz: 0 };
  const useProjectedBounds = cameraPoseAndMatricesAgree(camera);
  if (
    perspective &&
    useProjectedBounds &&
    primitives.length > 1 &&
    renderOverlappingSurfaces(
      primitives,
      camera,
      buffer,
      clipX,
      clipY,
      clipZ,
      clipW,
    )
  )
    return buffer;

  // Keep comparisons in double precision: rounding to the output Float32 depth
  // must not change which of two nearby, intersecting surfaces owns a pixel.
  const closest = new Float64Array(pixelCount).fill(Infinity);

  // Rasterize only a primitive's conservative projected bounds. Each candidate
  // still uses its exact analytic intersection; bounds never choose ownership.
  for (let index = 0; index < primitives.length; index++) {
    const primitive = primitives[index]!;
    const prepared = createPreparedPrimitiveIntersector(
      primitive,
      perspective ? undefined : camera.forward,
    );
    const bounds =
      prepared && useProjectedBounds
        ? projectedBounds(prepared.bounds, camera, width, height)
        : { x0: 0, x1: width, y0: 0, y1: height };
    if (!bounds) continue;
    for (let y = bounds.y0; y < bounds.y1; y++) {
      const ny = 1 - ((y + 0.5) / height) * 2;
      const rowX = m[4]! * ny,
        rowY = m[5]! * ny,
        rowZ = m[6]! * ny,
        rowW = m[7]! * ny;
      for (let x = bounds.x0; x < bounds.x1; x++) {
        const pixel = y * width + x;
        const cx = clipX[x]! + rowX,
          cy = clipY[x]! + rowY,
          cz = clipZ[x]! + rowZ,
          cw = clipW[x]! + rowW;
        const nearW = cw - m[11]! + m[15]! || 1;
        const nearX = (cx - m[8]! + m[12]!) / nearW;
        const nearY = (cy - m[9]! + m[13]!) / nearW;
        const nearZ = (cz - m[10]! + m[14]!) / nearW;
        let ox = nearX,
          oy = nearY,
          oz = nearZ,
          dx = fx,
          dy = fy,
          dz = fz;
        if (perspective) {
          const farW = cw + m[11]! + m[15]! || 1;
          dx = (cx + m[8]! + m[12]!) / farW - nearX;
          dy = (cy + m[9]! + m[13]!) / farW - nearY;
          dz = (cz + m[10]! + m[14]!) / farW - nearZ;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const inverse = length <= EPS ? 0 : 1 / length;
          dx *= inverse;
          dy *= inverse;
          dz *= inverse;
          ox = camera.position.x;
          oy = camera.position.y;
          oz = camera.position.z;
        }
        const forwardRate = perspective
          ? dx * fx + dy * fy + dz * fz
          : orthoRate;
        if (forwardRate <= 0) continue;
        // Clipping planes use forward depth rather than oblique ray distance.
        const tMin = perspective ? camera.near / forwardRate : 0;
        const tMax = Math.min(
          closest[pixel]!,
          perspective ? camera.far / forwardRate : orthoFar,
        );
        if (prepared) {
          if (!prepared.intersect(ox, oy, oz, dx, dy, dz, tMin, tMax, hit))
            continue;
        } else {
          const fallback = primitive.intersect(
            { origin: new Vec3(ox, oy, oz), dir: new Vec3(dx, dy, dz) },
            tMin,
            tMax,
          );
          if (!fallback) continue;
          hit.t = fallback.t;
          hit.nx = fallback.normal.x;
          hit.ny = fallback.normal.y;
          hit.nz = fallback.normal.z;
        }
        if (
          hit.t < tMin ||
          hit.t > tMax ||
          (primitiveIndices[pixel] !== -1 && hit.t === closest[pixel])
        )
          continue;
        closest[pixel] = hit.t;
        primitiveIndices[pixel] = index;
        depth[pixel] = originDepth + hit.t * forwardRate;
        const offset = pixel * 3;
        if (prepared && (hit.nx !== 0 || hit.ny !== 0 || hit.nz !== 0)) {
          // Analytic kernels already return unit normals.
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

/** Share unprojection in densely overlapping native perspective bounds without
 * retaining per-pixel rays or depth scratch arrays. Sparse scenes keep the
 * primitive traversal, which visits fewer background cells. */
function renderOverlappingSurfaces(
  primitives: readonly Primitive[],
  camera: Camera,
  buffer: SurfaceBuffer,
  clipX: Float64Array,
  clipY: Float64Array,
  clipZ: Float64Array,
  clipW: Float64Array,
): boolean {
  const { width, height, primitiveIndices, depth, normals } = buffer;
  const candidates: {
    index: number;
    prepared: PreparedPrimitiveIntersector;
    bounds: NonNullable<ReturnType<typeof projectedBounds>>;
  }[] = [];
  let areaSum = 0,
    x0 = width,
    x1 = 0,
    y0 = height,
    y1 = 0;
  for (let index = 0; index < primitives.length; index++) {
    const prepared = createPreparedPrimitiveIntersector(primitives[index]!);
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
  const active: typeof candidates = [];
  for (let y = y0; y < y1; y++) {
    active.length = 0;
    let rowLeft = width,
      rowRight = 0;
    for (const candidate of candidates) {
      const b = candidate.bounds;
      if (y < b.y0 || y >= b.y1) continue;
      active.push(candidate);
      rowLeft = Math.min(rowLeft, b.x0);
      rowRight = Math.max(rowRight, b.x1);
    }
    const ndcY = 1 - ((y + 0.5) / height) * 2;
    const rowX = m[4]! * ndcY,
      rowY = m[5]! * ndcY,
      rowZ = m[6]! * ndcY,
      rowW = m[7]! * ndcY;
    for (let x = rowLeft; x < rowRight; x++) {
      const cx = clipX[x]! + rowX,
        cy = clipY[x]! + rowY,
        cz = clipZ[x]! + rowZ,
        cw = clipW[x]! + rowW;
      const nearW = cw - m[11]! + m[15]! || 1;
      const nearX = (cx - m[8]! + m[12]!) / nearW;
      const nearY = (cy - m[9]! + m[13]!) / nearW;
      const nearZ = (cz - m[10]! + m[14]!) / nearW;
      const farW = cw + m[11]! + m[15]! || 1;
      let dx = (cx + m[8]! + m[12]!) / farW - nearX;
      let dy = (cy + m[9]! + m[13]!) / farW - nearY;
      let dz = (cz + m[10]! + m[14]!) / farW - nearZ;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const inverse = length <= EPS ? 0 : 1 / length;
      dx *= inverse;
      dy *= inverse;
      dz *= inverse;
      const rate = dx * fx + dy * fy + dz * fz;
      if (rate <= 0) continue;
      const tMin = camera.near / rate;
      let closest = camera.far / rate,
        owner = -1,
        nx = 0,
        ny = 0,
        nz = 0;
      for (const candidate of active) {
        if (x < candidate.bounds.x0 || x >= candidate.bounds.x1) continue;
        if (
          !candidate.prepared.intersect(
            ox,
            oy,
            oz,
            dx,
            dy,
            dz,
            tMin,
            closest,
            hit,
          )
        )
          continue;
        if (
          hit.t < tMin ||
          hit.t > closest ||
          (owner !== -1 && hit.t === closest)
        )
          continue;
        closest = hit.t;
        owner = candidate.index;
        nx = hit.nx;
        ny = hit.ny;
        nz = hit.nz;
      }
      if (owner < 0) continue;
      const pixel = y * width + x,
        offset = pixel * 3;
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

/** Mutable pose/matrix values can invalidate projection bounds without changing
 * screenToRay itself. Its scalar formula remains valid; only bounds are disabled. */
function cameraPoseAndMatricesAgree(camera: Camera): boolean {
  const view = camera.view.m;
  const { x, y, z } = camera.position;
  const poseTolerance =
    Number.EPSILON *
    64 *
    Math.max(
      1,
      Math.abs(x),
      Math.abs(y),
      Math.abs(z),
      Math.abs(view[12]!),
      Math.abs(view[13]!),
      Math.abs(view[14]!),
    );
  for (let row = 0; row < 3; row++) {
    const translated =
      view[row]! * x +
      view[row + 4]! * y +
      view[row + 8]! * z +
      view[row + 12]!;
    if (!(Math.abs(translated) <= poseTolerance)) return false;
  }
  if (
    !(Math.abs(camera.forward.x + view[2]!) <= 1e-12) ||
    !(Math.abs(camera.forward.y + view[6]!) <= 1e-12) ||
    !(Math.abs(camera.forward.z + view[10]!) <= 1e-12)
  )
    return false;

  const projection = camera.viewProj.m,
    inverse = camera.viewProjInv.m;
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let value = 0,
        magnitude = 0;
      for (let k = 0; k < 4; k++) {
        const term = projection[k * 4 + row]! * inverse[column * 4 + k]!;
        value += term;
        magnitude += Math.abs(term);
      }
      const expected = row === column ? 1 : 0;
      if (
        !(
          Math.abs(value - expected) <=
          Number.EPSILON * 128 * Math.max(1, magnitude)
        )
      )
        return false;
    }
  }
  return true;
}

function renderGenericSurfaces(
  primitives: readonly Primitive[],
  camera: Camera,
  buffer: SurfaceBuffer,
): void {
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
        const hit = primitives[index]!.intersect(ray, tMin, closest);
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

function projectedBounds(
  bounds: SurfaceWorldBounds,
  camera: Camera,
  width: number,
  height: number,
): { x0: number; x1: number; y0: number; y1: number } | null {
  const m = camera.viewProj.m;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    const x = corner & 1 ? bounds.maxX : bounds.minX;
    const y = corner & 2 ? bounds.maxY : bounds.minY;
    const z = corner & 4 ? bounds.maxZ : bounds.minZ;
    const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    // A box crossing the eye plane cannot be bounded by projected vertices.
    if (!(w > 0)) return { x0: 0, x1: width, y0: 0, y1: height };
    const screenX =
      (((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w) * 0.5 + 0.5) * width;
    const screenY =
      (0.5 - ((m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w) * 0.5) * height;
    minX = Math.min(minX, screenX);
    maxX = Math.max(maxX, screenX);
    minY = Math.min(minY, screenY);
    maxY = Math.max(maxY, screenY);
  }
  if (![minX, maxX, minY, maxY].every(Number.isFinite))
    return { x0: 0, x1: width, y0: 0, y1: height };
  // Include a cell of padding for cap tolerances and projection roundoff.
  const x0 = Math.max(0, Math.floor(minX - 0.5) - 1),
    x1 = Math.min(width, Math.ceil(maxX - 0.5) + 2);
  const y0 = Math.max(0, Math.floor(minY - 0.5) - 1),
    y1 = Math.min(height, Math.ceil(maxY - 0.5) + 2);
  return x0 < x1 && y0 < y1 ? { x0, x1, y0, y1 } : null;
}

/**
 * Convert cached nearest-surface ownership into SVG clip regions.
 * Boundaries follow pixel cells rather than exact analytic surface contours.
 * Identical runs on adjacent rows are merged into a single rectangle subpath.
 */
export function buildSurfaceClipPaths(
  buffer: SurfaceBuffer,
  options: SurfaceClipPathOptions = {},
): readonly SurfaceClipPath[] {
  const width = options.width ?? buffer.width;
  const height = options.height ?? buffer.height;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Surface clip dimensions must be positive finite numbers");
  }

  const scaleX = width / buffer.width;
  const scaleY = height / buffer.height;
  const parts: string[][] = buffer.primitiveIds.map(() => []);
  let active: SurfacePixelRun[] = [];
  const coordinate = (value: number): string =>
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  const append = (run: SurfacePixelRun): void => {
    const x0 = coordinate(run.x0 * scaleX);
    const x1 = coordinate(run.x1 * scaleX);
    const y0 = coordinate(run.y0 * scaleY);
    const y1 = coordinate(run.y1 * scaleY);
    parts[run.index]!.push(`M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`);
  };

  for (let y = 0; y < buffer.height; y++) {
    const next: SurfacePixelRun[] = [];
    let previousIndex = 0;
    let x = 0;
    while (x < buffer.width) {
      const x0 = x;
      const index = buffer.primitiveIndices[y * buffer.width + x]!;
      while (
        x < buffer.width &&
        buffer.primitiveIndices[y * buffer.width + x] === index
      )
        x++;
      if (index < 0 || index >= parts.length) continue;

      // Runs are ordered by x on both rows, so matching needs a linear merge,
      // with no per-run string keys or hash maps.
      while (previousIndex < active.length && active[previousIndex]!.x0 < x0)
        append(active[previousIndex++]!);
      const previous = active[previousIndex];
      if (
        previous?.x0 === x0 &&
        previous.x1 === x &&
        previous.index === index
      ) {
        previous.y1 = y + 1;
        previousIndex++;
        next.push(previous);
      } else {
        next.push({ index, x0, x1: x, y0: y, y1: y + 1 });
      }
    }
    while (previousIndex < active.length) append(active[previousIndex++]!);
    active = next;
  }
  for (const run of active) append(run);

  // IDs describe object ownership. If several primitives share an object ID,
  // their disjoint visible pixel regions belong to the same clip path.
  const byId = new Map<string, string[]>();
  for (let index = 0; index < buffer.primitiveIds.length; index++) {
    const id = buffer.primitiveIds[index]!;
    const existing = byId.get(id);
    if (existing) existing.push(...parts[index]!);
    else byId.set(id, parts[index]!);
  }
  return [...byId].map(([primitiveId, commands]) => ({
    primitiveId,
    path: commands.join(" "),
  }));
}

/** Re-light an existing surface buffer without any visibility raycasts. */
export function shadeSurfaceBuffer(
  buffer: SurfaceBuffer,
  options: SurfaceShadingOptions,
): Uint8ClampedArray {
  const light = Vec3.normalize(options.lightDirection);
  const ambient = Math.max(0, Math.min(1, options.ambient ?? 0.35));
  const rgba = new Uint8ClampedArray(buffer.width * buffer.height * 4);
  if (options.selectedId == null) {
    // The usual lighting-only update has no owner tint. Hoist that decision so
    // occupied pixels need no selected-owner array, lookup, or color branches.
    for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
      if (buffer.primitiveIndices[pixel]! < 0) continue;
      const offset = pixel * 3;
      const lambert = Math.max(
        0,
        buffer.normals[offset]! * light.x +
          buffer.normals[offset + 1]! * light.y +
          buffer.normals[offset + 2]! * light.z,
      );
      const brightness = 0.72 + 0.27 * (ambient + (1 - ambient) * lambert);
      const value = brightness * 255;
      const colorOffset = pixel * 4;
      rgba[colorOffset] = value;
      rgba[colorOffset + 1] = value;
      rgba[colorOffset + 2] = value;
      rgba[colorOffset + 3] = 255;
    }
    return rgba;
  }
  const selectedOwners = Uint8Array.from(buffer.primitiveIds, (id) =>
    options.selectedId != null && id === options.selectedId ? 1 : 0,
  );

  for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
    const index = buffer.primitiveIndices[pixel]!;
    if (index < 0) continue;

    const offset = pixel * 3;
    const lambert = Math.max(
      0,
      buffer.normals[offset]! * light.x +
        buffer.normals[offset + 1]! * light.y +
        buffer.normals[offset + 2]! * light.z,
    );
    const brightness = 0.72 + 0.27 * (ambient + (1 - ambient) * lambert);
    const value = brightness * 255;
    const selected = selectedOwners[index] === 1;
    const colorOffset = pixel * 4;
    rgba[colorOffset] = selected ? value * 0.88 : value;
    rgba[colorOffset + 1] = value;
    rgba[colorOffset + 2] = selected ? value * 0.92 : value;
    rgba[colorOffset + 3] = 255;
  }

  return rgba;
}

/** Azimuth 0 faces +Z, azimuth 90 faces +X, and elevation rises toward +Y. */
export function lightDirectionFromAngles(
  azimuthDegrees: number,
  elevationDegrees: number,
): Vec3 {
  const azimuth = (azimuthDegrees * Math.PI) / 180;
  const elevation = (elevationDegrees * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return new Vec3(
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation),
    Math.cos(azimuth) * horizontal,
  );
}
