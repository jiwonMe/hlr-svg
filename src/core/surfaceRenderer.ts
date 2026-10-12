import type { Camera } from "../camera/camera.js";
import { Vec3 } from "../math/vec3.js";
import type { Primitive } from "../scene/primitive.js";

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
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Surface buffer dimensions must be positive integers");
  }

  const pixelCount = width * height;
  const normals = new Float32Array(pixelCount * 3);
  const primitiveIndices = new Int32Array(pixelCount).fill(-1);
  const depth = new Float32Array(pixelCount).fill(Number.POSITIVE_INFINITY);
  const primitiveIds = primitives.map((primitive) => primitive.id);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ray = camera.screenToRay(x + 0.5, y + 0.5, width, height);
      const forwardRate = Vec3.dot(ray.dir, camera.forward);
      if (forwardRate <= 0) continue;

      // Near/far are view-space planes, rather than distances along an oblique ray.
      // Orthographic screenToRay already starts on the near plane.
      const originDepth = camera.kind === "orthographic" ? camera.near : 0;
      const tMin = (camera.near - originDepth) / forwardRate;
      let closestT = (camera.far - originDepth) / forwardRate;
      const pixel = y * width + x;

      for (let index = 0; index < primitives.length; index++) {
        const hit = primitives[index]!.intersect(ray, tMin, closestT);
        if (!hit || hit.t < tMin || hit.t > closestT) continue;
        // Retain the first primitive for exactly coincident surfaces.
        if (primitiveIndices[pixel] !== -1 && hit.t === closestT) continue;

        closestT = hit.t;
        primitiveIndices[pixel] = index;
        depth[pixel] = originDepth + hit.t * forwardRate;
        const normalLength = Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z);
        const offset = pixel * 3;
        if (normalLength > 0) {
          normals[offset] = hit.normal.x / normalLength;
          normals[offset + 1] = hit.normal.y / normalLength;
          normals[offset + 2] = hit.normal.z / normalLength;
        } else {
          // At a singular point such as a cone apex, use a view-facing normal.
          normals[offset] = -ray.dir.x;
          normals[offset + 1] = -ray.dir.y;
          normals[offset + 2] = -ray.dir.z;
        }
      }
    }
  }

  return { width, height, normals, primitiveIndices, primitiveIds, depth };
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
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Surface clip dimensions must be positive finite numbers");
  }

  const scaleX = width / buffer.width;
  const scaleY = height / buffer.height;
  const parts: string[][] = buffer.primitiveIds.map(() => []);
  let active = new Map<string, SurfacePixelRun>();
  const coordinate = (value: number): string => String(Number(value.toFixed(6)));
  const append = (run: SurfacePixelRun): void => {
    const x0 = coordinate(run.x0 * scaleX);
    const x1 = coordinate(run.x1 * scaleX);
    const y0 = coordinate(run.y0 * scaleY);
    const y1 = coordinate(run.y1 * scaleY);
    parts[run.index]!.push(`M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`);
  };

  for (let y = 0; y < buffer.height; y++) {
    const next = new Map<string, SurfacePixelRun>();
    let x = 0;
    while (x < buffer.width) {
      const x0 = x;
      const index = buffer.primitiveIndices[y * buffer.width + x]!;
      while (x < buffer.width && buffer.primitiveIndices[y * buffer.width + x] === index) x++;
      if (index < 0 || index >= parts.length) continue;

      const key = `${index}:${x0}:${x}`;
      const previous = active.get(key);
      if (previous) {
        previous.y1 = y + 1;
        active.delete(key);
        next.set(key, previous);
      } else {
        next.set(key, { index, x0, x1: x, y0: y, y1: y + 1 });
      }
    }
    for (const run of active.values()) append(run);
    active = next;
  }
  for (const run of active.values()) append(run);

  // IDs describe object ownership. If several primitives share an object ID,
  // their disjoint visible pixel regions belong to the same clip path.
  const byId = new Map<string, string[]>();
  for (let index = 0; index < buffer.primitiveIds.length; index++) {
    const id = buffer.primitiveIds[index]!;
    const existing = byId.get(id);
    if (existing) existing.push(...parts[index]!);
    else byId.set(id, parts[index]!);
  }
  return [...byId].map(([primitiveId, commands]) => ({ primitiveId, path: commands.join(" ") }));
}

/** Re-light an existing surface buffer without any visibility raycasts. */
export function shadeSurfaceBuffer(
  buffer: SurfaceBuffer,
  options: SurfaceShadingOptions,
): Uint8ClampedArray {
  const light = Vec3.normalize(options.lightDirection);
  const ambient = Math.max(0, Math.min(1, options.ambient ?? 0.35));
  const rgba = new Uint8ClampedArray(buffer.width * buffer.height * 4);

  for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
    const index = buffer.primitiveIndices[pixel]!;
    if (index < 0) continue;

    const offset = pixel * 3;
    const lambert = Math.max(0,
      buffer.normals[offset]! * light.x +
      buffer.normals[offset + 1]! * light.y +
      buffer.normals[offset + 2]! * light.z,
    );
    const brightness = 0.72 + 0.27 * (ambient + (1 - ambient) * lambert);
    const value = brightness * 255;
    const selected = options.selectedId != null && buffer.primitiveIds[index] === options.selectedId;
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
