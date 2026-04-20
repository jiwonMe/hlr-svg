import { Vec3 } from "../math/vec3.js";
import { TriangleMesh, mergeBounds } from "../scene/primitives/triangleMesh.js";
import type { TriangleIndices } from "../scene/primitives/triangleMesh.js";
import type { ImportedModel } from "./types.js";

type ObjChunk = {
  name: string;
  triangles: TriangleIndices[];
};

export function parseObj(
  source: string | ArrayBuffer | Uint8Array,
): ImportedModel {
  const text = decodeText(source);
  const warnings: string[] = [];
  const warnedKeywords = new Set<string>();
  const vertices: Vec3[] = [];
  const chunks: ObjChunk[] = [];
  let currentName = "mesh-1";
  let autoId = 1;
  let currentChunkIndex = -1;

  const getChunk = (): ObjChunk => {
    if (currentChunkIndex >= 0) return chunks[currentChunkIndex]!;
    const chunk = { name: currentName, triangles: [] };
    currentChunkIndex = chunks.length;
    chunks.push(chunk);
    if (currentName.startsWith("mesh-")) autoId += 1;
    return chunk;
  };

  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = lines[lineNo]!;
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
      const faceIndices: number[] = [];
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
          faceIndices[0]!,
          faceIndices[i]!,
          faceIndices[i + 1]!,
        ]);
      }
      continue;
    }

    if (
      keyword === "mtllib" ||
      keyword === "usemtl" ||
      keyword === "vt" ||
      keyword === "l" ||
      keyword === "p" ||
      keyword === "curv"
    ) {
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

  const meshes = chunks
    .map((chunk, index) =>
      buildMeshFromGlobal(
        `mesh-${index + 1}`,
        chunk.name,
        vertices,
        chunk.triangles,
      ),
    )
    .filter((mesh): mesh is TriangleMesh => mesh !== null);

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
      max: Vec3.zero(),
    },
    warnings,
  };
}

function buildMeshFromGlobal(
  fallbackName: string,
  name: string,
  vertices: readonly Vec3[],
  triangles: readonly TriangleIndices[],
): TriangleMesh | null {
  if (triangles.length === 0) return null;
  const localVertices: Vec3[] = [];
  const localTriangles: TriangleIndices[] = [];
  const remap = new Map<number, number>();

  const localIndexOf = (globalIndex: number): number => {
    const existing = remap.get(globalIndex);
    if (existing !== undefined) return existing;
    const next = localVertices.length;
    localVertices.push(vertices[globalIndex]!);
    remap.set(globalIndex, next);
    return next;
  };

  for (const tri of triangles) {
    localTriangles.push([
      localIndexOf(tri[0]),
      localIndexOf(tri[1]),
      localIndexOf(tri[2]),
    ]);
  }

  const mesh = new TriangleMesh(name || fallbackName, localVertices, localTriangles);
  return mesh.triangleCount > 0 ? mesh : null;
}

function parseObjVertexIndex(token: string, vertexCount: number): number | null {
  const head = token.split("/")[0]?.trim();
  if (!head) return null;
  const raw = Number(head);
  if (!Number.isInteger(raw) || raw === 0) return null;
  return raw > 0 ? raw - 1 : vertexCount + raw;
}

function decodeText(source: string | ArrayBuffer | Uint8Array): string {
  if (typeof source === "string") return source;
  const bytes =
    source instanceof Uint8Array ? source : new Uint8Array(source);
  return new TextDecoder().decode(bytes);
}
