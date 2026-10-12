import { Vec3 } from "@hlr/math/vec3.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";

export type PlaygroundObject = {
  id: string;
  name: string;
  kind: string;
};

export type PlaygroundPreset = {
  id: string;
  name: string;
  description: string;
  category: "기본 도형" | "겹침 도형";
  primitives: readonly Primitive[];
  objects: readonly PlaygroundObject[];
  halfHeight: number;
  annotations?: readonly {
    text: string;
    point: Vec3;
    dx: number;
    dy: number;
  }[];
  auxiliarySegments?: readonly [string, string][];
};

const origin = Vec3.zero();
const up = new Vec3(0, 1, 0);
const down = new Vec3(0, -1, 0);

function octahedron(): TriangleMesh {
  return new TriangleMesh(
    "octahedron",
    [
      new Vec3(0, 1.65, 0),
      new Vec3(0, -1.65, 0),
      new Vec3(1.65, 0, 0),
      new Vec3(0, 0, 1.65),
      new Vec3(-1.65, 0, 0),
      new Vec3(0, 0, -1.65),
    ],
    [
      [0, 3, 2],
      [0, 4, 3],
      [0, 5, 4],
      [0, 2, 5],
      [1, 2, 3],
      [1, 3, 4],
      [1, 4, 5],
      [1, 5, 2],
    ],
  );
}

export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: "sphere-cylinder",
    name: "구 × 원기둥",
    description: "곡면이 만나 만들어지는 교선을 살펴보세요.",
    category: "겹침 도형",
    primitives: [
      new Sphere("sphere", new Vec3(0.45, 0.1, 0), 1.35),
      new Cylinder("cylinder", new Vec3(-0.3, -1.7, 0), up, 3.4, 0.82),
    ],
    objects: [
      { id: "sphere", name: "구", kind: "곡면" },
      { id: "cylinder", name: "원기둥", kind: "곡면 · 밑면 2개" },
    ],
    halfHeight: 2.65,
  },
  {
    id: "sphere",
    name: "구",
    description: "빛의 방향에 따라 달라지는 매끄러운 곡면.",
    category: "기본 도형",
    primitives: [new Sphere("sphere", origin, 1.5)],
    objects: [{ id: "sphere", name: "구", kind: "곡면" }],
    halfHeight: 2.5,
    annotations: [
      { text: "O", point: origin, dx: -9, dy: -8 },
      { text: "P", point: new Vec3(1.5, 0, 0), dx: 9, dy: 12 },
    ],
    auxiliarySegments: [["O", "P"]],
  },
  {
    id: "cylinder",
    name: "원기둥",
    description: "옆면의 음영과 두 밑면의 타원을 비교하세요.",
    category: "기본 도형",
    primitives: [new Cylinder("cylinder", new Vec3(0, -1.5, 0), up, 3, 1.05)],
    objects: [{ id: "cylinder", name: "원기둥", kind: "곡면 · 밑면 2개" }],
    halfHeight: 2.6,
    annotations: [
      {
        text: "Q",
        point: new Vec3(1.05 * 0.85, 1.5, 1.05 * Math.sqrt(1 - 0.85 ** 2)),
        dx: 8,
        dy: -10,
      },
      { text: "P", point: new Vec3(1.05, -1.5, 0), dx: 10, dy: 14 },
      { text: "O", point: new Vec3(0, -1.5, 0), dx: -10, dy: -8 },
    ],
    auxiliarySegments: [
      ["Q", "P"],
      ["O", "P"],
    ],
  },
  {
    id: "cone",
    name: "원뿔",
    description: "꼭짓점에서 밑면으로 이어지는 곡면을 살펴보세요.",
    category: "기본 도형",
    primitives: [new Cone("cone", new Vec3(0, 1.5, 0), down, 3, 1.3)],
    objects: [{ id: "cone", name: "원뿔", kind: "곡면 · 밑면 1개" }],
    halfHeight: 2.6,
    annotations: [
      { text: "A", point: new Vec3(0, 1.5, 0), dx: 8, dy: -10 },
      { text: "O", point: new Vec3(0, -1.5, 0), dx: -10, dy: 16 },
      { text: "P", point: new Vec3(1.3, -1.5, 0), dx: 10, dy: 14 },
    ],
    auxiliarySegments: [
      ["A", "O"],
      ["O", "P"],
    ],
  },
  {
    id: "cube",
    name: "정육면체",
    description: "면마다 다른 밝기로 입체의 방향을 읽어보세요.",
    category: "기본 도형",
    primitives: [
      new BoxAabb("cube", new Vec3(-1.2, -1.2, -1.2), new Vec3(1.2, 1.2, 1.2)),
    ],
    objects: [{ id: "cube", name: "정육면체", kind: "면 6개 · 모서리 12개" }],
    halfHeight: 2.65,
    annotations: [
      { text: "A", point: new Vec3(-1.2, 1.2, 1.2), dx: -10, dy: -8 },
      { text: "B", point: new Vec3(1.2, 1.2, 1.2), dx: 10, dy: -8 },
      { text: "C", point: new Vec3(1.2, 1.2, -1.2), dx: 10, dy: -8 },
      { text: "D", point: new Vec3(-1.2, 1.2, -1.2), dx: -10, dy: -10 },
      { text: "E", point: new Vec3(-1.2, -1.2, 1.2), dx: -10, dy: 17 },
      { text: "F", point: new Vec3(1.2, -1.2, 1.2), dx: 10, dy: 17 },
      { text: "G", point: new Vec3(1.2, -1.2, -1.2), dx: 10, dy: 17 },
      { text: "H", point: new Vec3(-1.2, -1.2, -1.2), dx: -10, dy: 17 },
    ],
  },
  {
    id: "octahedron",
    name: "정팔면체",
    description: "여덟 삼각형 면과 가려진 모서리를 살펴보세요.",
    category: "기본 도형",
    primitives: [octahedron()],
    objects: [
      { id: "octahedron", name: "정팔면체", kind: "면 8개 · 모서리 12개" },
    ],
    halfHeight: 2.6,
    annotations: [
      { text: "A", point: new Vec3(0, 1.65, 0), dx: 8, dy: -10 },
      { text: "B", point: new Vec3(1.65, 0, 0), dx: 10, dy: 14 },
      { text: "C", point: new Vec3(0, 0, 1.65), dx: -10, dy: 14 },
      { text: "D", point: new Vec3(-1.65, 0, 0), dx: -10, dy: -8 },
      { text: "E", point: new Vec3(0, 0, -1.65), dx: 10, dy: -8 },
      { text: "F", point: new Vec3(0, -1.65, 0), dx: 8, dy: 18 },
    ],
  },
  {
    id: "sphere-sphere",
    name: "구 × 구",
    description: "두 구가 만나는 원과 앞뒤 관계를 확인하세요.",
    category: "겹침 도형",
    primitives: [
      new Sphere("sphere-left", new Vec3(-0.7, 0, 0), 1.35),
      new Sphere("sphere-right", new Vec3(0.7, 0.15, 0), 1.35),
    ],
    objects: [
      { id: "sphere-left", name: "왼쪽 구", kind: "곡면" },
      { id: "sphere-right", name: "오른쪽 구", kind: "곡면" },
    ],
    halfHeight: 2.65,
  },
  {
    id: "cone-sphere",
    name: "원뿔 × 구",
    description: "서로 다른 곡면이 만나는 경계를 찾아보세요.",
    category: "겹침 도형",
    primitives: [
      new Cone("cone", new Vec3(0.25, 1.7, 0), down, 3.4, 1.45),
      new Sphere("sphere", new Vec3(-0.45, -0.25, 0.15), 1.2),
    ],
    objects: [
      { id: "cone", name: "원뿔", kind: "곡면 · 밑면 1개" },
      { id: "sphere", name: "구", kind: "곡면" },
    ],
    halfHeight: 2.8,
  },
];

export const DEFAULT_PLAYGROUND_PRESET = PLAYGROUND_PRESETS[0]!;
