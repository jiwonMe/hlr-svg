import { Vec3 } from "../math/vec3.js";
import { TriangleMesh } from "../scene/primitives/triangleMesh.js";
import type { TriangleIndices } from "../scene/primitives/triangleMesh.js";
import type { ImportedModel } from "./types.js";

export function parseStl(
  source: string | ArrayBuffer | Uint8Array,
): ImportedModel {
  const warnings: string[] = [];
  const bytes = toBytes(source);
  const parsed =
    typeof source === "string"
      ? parseAsciiStl(source, warnings)
      : detectBinaryStl(bytes)
        ? parseBinaryStl(bytes, warnings)
        : parseAsciiStl(new TextDecoder().decode(bytes), warnings);

  const mesh = new TriangleMesh("mesh-1", parsed.vertices, parsed.triangles);
  if (mesh.triangleCount === 0) warnings.push("STL file did not contain valid triangles.");

  return {
    meshes: mesh.triangleCount > 0 ? [mesh] : [],
    bounds: mesh.bounds,
    warnings,
  };
}

function parseAsciiStl(
  text: string,
  warnings: string[],
): { vertices: Vec3[]; triangles: TriangleIndices[] } {
  const vertices: Vec3[] = [];
  const triangles: TriangleIndices[] = [];
  let pending: number[] = [];
  const lines = text.split(/\r?\n/);

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo]!.trim();
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
      triangles.push([pending[0]!, pending[1]!, pending[2]!]);
      pending = [];
    }
  }

  if (pending.length !== 0) {
    warnings.push("ASCII STL ended with an incomplete facet.");
  }

  return { vertices, triangles };
}

function parseBinaryStl(
  bytes: Uint8Array,
  warnings: string[],
): { vertices: Vec3[]; triangles: TriangleIndices[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const faceCount = view.getUint32(80, true);
  const expectedBytes = 84 + faceCount * 50;
  if (expectedBytes > bytes.byteLength) {
    warnings.push("Binary STL header length did not match payload size.");
  }

  const vertices: Vec3[] = [];
  const triangles: TriangleIndices[] = [];
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

function readBinaryVertex(view: DataView, offset: number): Vec3 {
  return new Vec3(
    view.getFloat32(offset, true),
    view.getFloat32(offset + 4, true),
    view.getFloat32(offset + 8, true),
  );
}

function detectBinaryStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 84) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  return 84 + count * 50 === bytes.byteLength;
}

function toBytes(source: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof source === "string") return new TextEncoder().encode(source);
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}
