import type { Camera } from "@hlr/camera/camera.js";
import { lineToCubic3 } from "@hlr/curves/builders.js";
import type { CubicBezier3 } from "@hlr/curves/cubicBezier3.js";
import { Vec3 } from "@hlr/math/vec3.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Disk } from "@hlr/scene/primitives/disk.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";
import { Scene as RaycastScene } from "@hlr/scene/scene.js";
import {
  add3,
  applyMat,
  eulerToMatrix,
  isRightAngleRotation,
  scale3,
  vec,
  type Tuple3,
} from "./math";
import type { EditorDoc, EditorObject, RotatedObject } from "./model";

export type Bounds = { min: Tuple3; max: Tuple3 };

/** One solid as the library sees it, plus how to write it as code. */
export type BuiltPrimitive = {
  objectId: string;
  primitive: Primitive;
  note?: string;
};

export type BuiltScene = {
  primitives: Primitive[];
  built: BuiltPrimitive[];
  segments: {
    id: string;
    from: Tuple3;
    to: Tuple3;
    arrow: boolean;
    curve: CubicBezier3;
  }[];
  points: Map<string, Tuple3>;
  bounds: Map<string, Bounds>;
  sceneBounds: Bounds | null;
};

const MIN_SIZE = 0.01;
const positive = (value: number) => Math.max(MIN_SIZE, value);

/** Local axes of a rotated object in world space. */
export function frame(object: RotatedObject) {
  const m = eulerToMatrix(object.rotation);
  return {
    right: applyMat(m, [1, 0, 0]),
    up: applyMat(m, [0, 1, 0]),
    forward: applyMat(m, [0, 0, 1]),
  };
}

function ring(center: Tuple3, a: Tuple3, b: Tuple3, radius: number): Tuple3[] {
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return add3(
      center,
      add3(scale3(a, radius * Math.cos(t)), scale3(b, radius * Math.sin(t))),
    );
  });
}

function boundsOf(points: readonly Tuple3[]): Bounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  return { min: min as unknown as Tuple3, max: max as unknown as Tuple3 };
}

export function boxCorners(
  position: Tuple3,
  rotation: Tuple3,
  size: Tuple3,
): Tuple3[] {
  const m = eulerToMatrix(rotation);
  return Array.from({ length: 8 }, (_, i) =>
    add3(
      position,
      applyMat(m, [
        ((i & 1 ? 1 : -1) * positive(size[0])) / 2,
        ((i & 2 ? 1 : -1) * positive(size[1])) / 2,
        ((i & 4 ? 1 : -1) * positive(size[2])) / 2,
      ]),
    ),
  );
}

// Outward winding per face keeps coplanar triangles from reading as creases.
export const BOX_TRIANGLES: readonly [number, number, number][] = [
  [0, 2, 3],
  [0, 3, 1],
  [4, 5, 7],
  [4, 7, 6],
  [0, 4, 6],
  [0, 6, 2],
  [1, 3, 7],
  [1, 7, 5],
  [0, 1, 5],
  [0, 5, 4],
  [2, 6, 7],
  [2, 7, 3],
];

/** Corners of a plane rectangle, in order around its border. */
export function planeCorners(
  object: Extract<EditorObject, { kind: "plane" }>,
): Tuple3[] {
  const { right, forward } = frame(object);
  const hw = positive(object.width) / 2;
  const hd = positive(object.depth) / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) =>
    add3(
      object.position,
      add3(scale3(right, a! * hw), scale3(forward, b! * hd)),
    ),
  );
}

/** Turns the editor document into library primitives and extra curves. */
export function buildScene(doc: EditorDoc): BuiltScene {
  const points = new Map<string, Tuple3>();
  for (const object of doc.objects)
    if (object.kind === "point") points.set(object.id, object.position);

  const built: BuiltPrimitive[] = [];
  const segments: BuiltScene["segments"] = [];
  const bounds = new Map<string, Bounds>();

  for (const object of doc.objects) {
    const { id } = object;
    switch (object.kind) {
      case "sphere": {
        const r = positive(object.radius);
        bounds.set(id, {
          min: add3(object.position, [-r, -r, -r]),
          max: add3(object.position, [r, r, r]),
        });
        if (!object.hidden)
          built.push({
            objectId: id,
            primitive: new Sphere(id, vec(object.position), r),
          });
        break;
      }
      case "cylinder":
      case "cone": {
        const { right, up, forward } = frame(object);
        const h = positive(object.height);
        const r = positive(object.radius);
        const top = add3(object.position, scale3(up, h / 2));
        const bottom = add3(object.position, scale3(up, -h / 2));
        bounds.set(
          id,
          boundsOf([
            ...ring(bottom, right, forward, r),
            ...(object.kind === "cylinder"
              ? ring(top, right, forward, r)
              : [top]),
          ]),
        );
        if (object.hidden) break;
        built.push({
          objectId: id,
          primitive:
            object.kind === "cylinder"
              ? new Cylinder(id, vec(bottom), vec(up), h, r, "both")
              : new Cone(id, vec(top), vec(scale3(up, -1)), h, r, "base"),
        });
        break;
      }
      case "box": {
        const corners = boxCorners(
          object.position,
          object.rotation,
          object.size,
        );
        const box = boundsOf(corners);
        bounds.set(id, box);
        if (object.hidden) break;
        // Quarter turns keep the box axis-aligned; any other angle becomes a mesh.
        built.push(
          isRightAngleRotation(object.rotation)
            ? {
                objectId: id,
                primitive: new BoxAabb(id, vec(box.min), vec(box.max)),
              }
            : {
                objectId: id,
                primitive: new TriangleMesh(
                  id,
                  corners.map(vec),
                  BOX_TRIANGLES,
                ),
                note: "기울인 직육면체는 삼각형 메시로 그려, 다른 도형과의 교선은 계산하지 않습니다.",
              },
        );
        break;
      }
      case "plane": {
        const corners = planeCorners(object);
        bounds.set(id, boundsOf(corners));
        if (object.hidden) break;
        const { right, up } = frame(object);
        built.push({
          objectId: id,
          primitive: new PlaneRect(
            id,
            vec(object.position),
            vec(up),
            vec(right),
            positive(object.width) / 2,
            positive(object.depth) / 2,
          ),
        });
        break;
      }
      case "disk": {
        const { right, up, forward } = frame(object);
        const r = positive(object.radius);
        bounds.set(id, boundsOf(ring(object.position, right, forward, r)));
        if (!object.hidden)
          built.push({
            objectId: id,
            primitive: new Disk(id, vec(object.position), vec(up), r),
          });
        break;
      }
      case "point":
        bounds.set(id, boundsOf([object.position]));
        break;
      case "segment": {
        const from = points.get(object.from);
        const to = points.get(object.to);
        if (!from || !to) break;
        bounds.set(id, boundsOf([from, to]));
        if (!object.hidden)
          segments.push({
            id,
            from,
            to,
            arrow: object.arrow,
            curve: lineToCubic3(vec(from), vec(to)),
          });
        break;
      }
      case "face": {
        const corners = object.points
          .map((pointId) => points.get(pointId))
          .filter((p): p is Tuple3 => !!p);
        if (corners.length < 3) break;
        bounds.set(id, boundsOf(corners));
        if (object.hidden) break;
        const triangles = corners
          .slice(2)
          .map((_, i) => [0, i + 1, i + 2] as [number, number, number]);
        built.push({
          objectId: id,
          primitive: new TriangleMesh(id, corners.map(vec), triangles),
          note: "면은 가림면이 되어 뒤쪽 선을 점선으로 만듭니다. 메시라서 다른 도형과의 교선은 그리지 않습니다.",
        });
        break;
      }
    }
  }

  const visibleBounds = doc.objects
    .filter((object) => !object.hidden)
    .map((object) => bounds.get(object.id))
    .filter((b): b is Bounds => !!b);
  return {
    primitives: built.map((item) => item.primitive),
    built,
    segments,
    points,
    bounds,
    sceneBounds: visibleBounds.length
      ? boundsOf(visibleBounds.flatMap((b) => [b.min, b.max]))
      : null,
  };
}

export function boundsCenter(b: Bounds): Tuple3 {
  return scale3(add3(b.min, b.max), 0.5);
}

export function boundsRadius(b: Bounds): number {
  return Math.max(
    0.5,
    Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) /
      2,
  );
}

export function boundsCorners(b: Bounds): Tuple3[] {
  return Array.from({ length: 8 }, (_, i) => [
    i & 1 ? b.max[0] : b.min[0],
    i & 2 ? b.max[1] : b.min[1],
    i & 4 ? b.max[2] : b.min[2],
  ]);
}

/* ── Exported annotations: point dots, labels and arrowheads ───────────── */

type Point2 = { x: number; y: number };

function unit(v: Point2): Point2 {
  const length = Math.hypot(v.x, v.y);
  return length < 1e-6
    ? { x: 0.7071, y: -0.7071 }
    : { x: v.x / length, y: v.y / length };
}

const fmt = (n: number) => n.toFixed(2);

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Upright capitals for points; italic for variables, curves and solids. */
function italicLabel(object: EditorObject): boolean {
  if (object.kind !== "point") return true;
  return !/^[A-Z]/.test(object.label);
}

/** Writes subscript digits (S1 → S₁) as a smaller, lowered tspan. */
function labelMarkup(text: string): string {
  const match = /^(.*?)([0-9₀-₉]+)$/.exec(text);
  if (!match) return escapeText(text);
  const digits = match[2]!.replace(/[₀-₉]/g, (d) =>
    String(d.charCodeAt(0) - 0x2080),
  );
  return `${escapeText(match[1]!)}<tspan baseline-shift="sub" font-size="68%">${digits}</tspan>`;
}

export function annotationSvg(
  objects: readonly EditorObject[],
  settings: Pick<EditorDoc["settings"], "labels" | "pointDots">,
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
): string {
  const project = (p: Tuple3) => camera.projectToSvg(vec(p), width, height);
  const fontSize = Math.round(
    Math.min(18, Math.max(13, Math.min(width, height) * 0.028)),
  );
  const occluders = new RaycastScene(scene.primitives, camera, undefined, true);
  const visible = (p: Tuple3) => occluders.visibleAtPoint(vec(p));
  const center = scene.sceneBounds
    ? project(boundsCenter(scene.sceneBounds))
    : { x: width / 2, y: height / 2 };
  const right = Vec3.normalize(Vec3.cross(camera.forward, camera.up));
  const parts: string[] = [];

  // Arrowheads at the end of arrow segments; their end labels sit past the tip.
  const arrowTail = new Map<string, Tuple3>();
  for (const object of objects) {
    if (object.kind !== "segment" || !object.arrow || object.hidden) continue;
    const from = scene.points.get(object.from);
    if (from) arrowTail.set(object.to, from);
  }
  for (const segment of scene.segments) {
    if (!segment.arrow) continue;
    const tail = project(segment.from);
    const tip = project(segment.to);
    const d = unit({ x: tip.x - tail.x, y: tip.y - tail.y });
    const size = fontSize * 0.62;
    const base = { x: tip.x - d.x * size, y: tip.y - d.y * size };
    const w = size * 0.36;
    parts.push(
      `<path d="M ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(base.x - d.y * w)} ${fmt(base.y + d.x * w)} L ${fmt(base.x + d.y * w)} ${fmt(base.y - d.x * w)} Z" fill="#0a0a0a" stroke="none"${visible(segment.to) ? "" : ' opacity="0.45"'}/>`,
    );
  }

  // Point dots fade when a solid hides them.
  if (settings.pointDots)
    for (const object of objects) {
      if (object.kind !== "point" || object.hidden || arrowTail.has(object.id))
        continue;
      const p = project(object.position);
      parts.push(
        `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="2.3" fill="#0a0a0a" stroke="none"${visible(object.position) ? "" : ' opacity="0.45"'}/>`,
      );
    }

  if (settings.labels) {
    const texts: string[] = [];
    for (const object of objects) {
      if (!object.label || object.hidden) continue;
      let at: Point2;
      if (object.kind === "point") {
        const p = project(object.position);
        const tail = arrowTail.get(object.id);
        const from = tail ? project(tail) : center;
        const away = unit({ x: p.x - from.x, y: p.y - from.y });
        at = {
          x: p.x + away.x * fontSize * 0.95,
          y: p.y + away.y * fontSize * 0.95,
        };
      } else if (object.kind === "sphere") {
        const c = project(object.position);
        const edge = project(
          add3(object.position, [
            right.x * object.radius,
            right.y * object.radius,
            right.z * object.radius,
          ]),
        );
        const r = Math.hypot(edge.x - c.x, edge.y - c.y);
        at = {
          x: c.x + r * 0.74 + fontSize * 0.45,
          y: c.y - r * 0.74 - fontSize * 0.2,
        };
      } else if (object.kind === "plane") {
        const inset = planeCorners({
          ...object,
          width: object.width * 0.84,
          depth: object.depth * 0.84,
        })
          .map(project)
          .sort((a, b) => a.x - b.x || a.y - b.y)[0]!;
        at = inset;
      } else {
        const b = scene.bounds.get(object.id);
        if (!b) continue;
        const corners = boundsCorners(b).map(project);
        at = {
          x: Math.max(...corners.map((c) => c.x)) + fontSize * 0.5,
          y: Math.min(...corners.map((c) => c.y)) + fontSize * 0.3,
        };
      }
      texts.push(
        `<text x="${fmt(at.x)}" y="${fmt(at.y)}"${italicLabel(object) ? ' class="fig-var"' : ""}>${labelMarkup(object.label)}</text>`,
      );
    }
    if (texts.length)
      parts.push(
        `<g class="fig-labels" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" fill="#0a0a0a" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${texts.join("")}</g>`,
      );
  }
  return parts.length
    ? `<g data-editor-annotations="true">${parts.join("")}</g>`
    : "";
}
