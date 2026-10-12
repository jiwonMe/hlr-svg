import { Vec3 } from "../../dist/math/vec3.js";

/** Deliberately simple public-API oracle, independent of bounds and scalar kernels. */
export function bruteSurfaceBuffer(primitives, camera, { width, height }) {
  const normals = new Float32Array(width * height * 3);
  const primitiveIndices = new Int32Array(width * height).fill(-1);
  const depth = new Float32Array(width * height).fill(Infinity);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const ray = camera.screenToRay(x + 0.5, y + 0.5, width, height);
      const rate = Vec3.dot(ray.dir, camera.forward);
      if (rate <= 0) continue;
      const originDepth = camera.kind === "orthographic" ? camera.near : 0;
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
  return {
    width,
    height,
    normals,
    primitiveIndices,
    primitiveIds: primitives.map((p) => p.id),
    depth,
  };
}

/** Original scalar lighting formula with a direct owner-id comparison. */
export function bruteShadeSurfaceBuffer(buffer, options) {
  const light = Vec3.normalize(options.lightDirection);
  const ambient = Math.max(0, Math.min(1, options.ambient ?? 0.35));
  const rgba = new Uint8ClampedArray(buffer.width * buffer.height * 4);
  for (let pixel = 0; pixel < buffer.primitiveIndices.length; pixel++) {
    const owner = buffer.primitiveIndices[pixel];
    if (owner < 0) continue;
    const offset = pixel * 3;
    const lambert = Math.max(
      0,
      buffer.normals[offset] * light.x +
        buffer.normals[offset + 1] * light.y +
        buffer.normals[offset + 2] * light.z,
    );
    const value = (0.72 + 0.27 * (ambient + (1 - ambient) * lambert)) * 255;
    const selected =
      options.selectedId != null &&
      buffer.primitiveIds[owner] === options.selectedId;
    const color = pixel * 4;
    rgba[color] = selected ? value * 0.88 : value;
    rgba[color + 1] = value;
    rgba[color + 2] = selected ? value * 0.92 : value;
    rgba[color + 3] = 255;
  }
  return rgba;
}
