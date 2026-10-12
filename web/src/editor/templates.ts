import {
  DEFAULT_SETTINGS,
  type EditorDoc,
  type EditorObject,
  type RenderSettings,
} from "./model";
import type { Tuple3 } from "./math";

// Omit must distribute over the union to keep each kind's own fields.
type DraftOf<T> = T extends unknown ? Omit<T, "hidden" | "name"> : never;
type Draft = DraftOf<EditorObject> & { name?: string };

function doc(
  title: string,
  drafts: Draft[],
  settings: Partial<RenderSettings> = {},
): EditorDoc {
  return {
    version: 1,
    title,
    objects: drafts.map(
      (draft) =>
        ({
          hidden: false,
          name: draft.name ?? (draft.label || draft.id),
          ...draft,
        }) as EditorObject,
    ),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

function point(id: string, label: string, position: Tuple3): Draft {
  return { id, kind: "point", label, name: `점 ${label}`, position };
}

function segment(id: string, from: string, to: string, arrow = false): Draft {
  return {
    id,
    kind: "segment",
    label: "",
    from,
    to,
    arrow,
    name: `선분 ${id}`,
  };
}

export type Template = {
  id: string;
  name: string;
  description: string;
  create: () => EditorDoc;
};

export const TEMPLATES: readonly Template[] = [
  {
    id: "sphere-plane",
    name: "구와 평면",
    description: "평면에 잘린 구와 단면의 원",
    create: () =>
      doc("구와 평면", [
        {
          id: "sphere",
          kind: "sphere",
          label: "S",
          name: "구 S",
          position: [0, 1.2, 0],
          radius: 2,
        },
        {
          id: "alpha",
          kind: "plane",
          label: "α",
          name: "평면 α",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          width: 6.4,
          depth: 6.4,
        },
        point("O", "O", [0, 1.2, 0]),
      ]),
  },
  {
    id: "cube-section",
    name: "정육면체의 단면",
    description: "정육면체 ABCD–EFGH와 단면 BDE",
    create: () =>
      doc(
        "정육면체의 단면",
        [
          {
            id: "cube",
            kind: "box",
            label: "",
            name: "정육면체",
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            size: [2, 2, 2],
          },
          point("A", "A", [-1, 2, 1]),
          point("B", "B", [1, 2, 1]),
          point("C", "C", [1, 2, -1]),
          point("D", "D", [-1, 2, -1]),
          point("E", "E", [-1, 0, 1]),
          point("F", "F", [1, 0, 1]),
          point("G", "G", [1, 0, -1]),
          point("H", "H", [-1, 0, -1]),
          segment("BD", "B", "D"),
          segment("DE", "D", "E"),
          segment("EB", "E", "B"),
        ],
        { pointDots: false },
      ),
  },
  {
    id: "coordinate-plane",
    name: "좌표공간과 평면 ABC",
    description: "평면 뒤로 지나는 좌표축이 점선이 됩니다",
    // 수학의 (x, y, z)를 y가 위인 장면 좌표 (y, z, x)로 옮겼습니다.
    create: () =>
      doc(
        "좌표공간과 평면 ABC",
        [
          point("O", "O", [0, 0, 0]),
          point("A", "A", [0, 0, 2]),
          point("B", "B", [2, 0, 0]),
          point("C", "C", [0, 2, 0]),
          point("H", "H", [2 / 3, 2 / 3, 2 / 3]),
          point("x", "x", [0, 0, 3.2]),
          point("y", "y", [3.2, 0, 0]),
          point("z", "z", [0, 3.1, 0]),
          {
            id: "ABC",
            kind: "face",
            label: "",
            name: "평면 ABC",
            points: ["A", "B", "C"],
          },
          segment("Ox", "O", "x", true),
          segment("Oy", "O", "y", true),
          segment("Oz", "O", "z", true),
          segment("OH", "O", "H"),
        ],
        { pointDots: false, grid: false },
      ),
  },
  {
    id: "cylinder-plane",
    name: "원기둥과 45° 평면",
    description: "평면이 원기둥을 자르는 타원",
    create: () =>
      doc("원기둥과 45° 평면", [
        {
          id: "cylinder",
          kind: "cylinder",
          label: "",
          name: "원기둥",
          position: [0, 3, 0],
          rotation: [0, 0, 0],
          radius: 2,
          height: 6,
        },
        {
          id: "alpha",
          kind: "plane",
          label: "α",
          name: "평면 α",
          position: [0, 3, 0],
          rotation: [45, 0, 0],
          width: 6.3,
          depth: 6.5,
        },
      ]),
  },
  {
    id: "tangent-spheres",
    name: "구에 접하는 세 구",
    description: "평면 α 위의 네 구와 세로 평면 β",
    create: () => {
      const ring = Math.sqrt(12);
      const step = 2 * Math.asin(1 / ring);
      const middle = (5 * Math.PI) / 6;
      const at = (angle: number): Tuple3 => [
        ring * Math.cos(angle),
        1,
        ring * Math.sin(angle),
      ];
      const o1 = at(middle + step);
      const o2 = at(middle);
      const mid: Tuple3 = [(o1[0] + o2[0]) / 2, 2.6, (o1[2] + o2[2]) / 2];
      // β is vertical and contains the centres of S₁ and S₂.
      const yaw = (-Math.atan2(o2[2] - o1[2], o2[0] - o1[0]) * 180) / Math.PI;
      return doc("구에 접하는 세 구", [
        {
          id: "S",
          kind: "sphere",
          label: "S",
          name: "구 S",
          position: [0, 3, 0],
          radius: 3,
        },
        {
          id: "S1",
          kind: "sphere",
          label: "S₁",
          name: "구 S₁",
          position: o1,
          radius: 1,
        },
        {
          id: "S2",
          kind: "sphere",
          label: "S₂",
          name: "구 S₂",
          position: o2,
          radius: 1,
        },
        {
          id: "S3",
          kind: "sphere",
          label: "S₃",
          name: "구 S₃",
          position: at(middle - step),
          radius: 1,
        },
        {
          id: "alpha",
          kind: "plane",
          label: "α",
          name: "평면 α",
          position: [-1.2, 0, 0],
          rotation: [0, 0, 0],
          width: 14,
          depth: 12,
        },
        {
          id: "beta",
          kind: "plane",
          label: "β",
          name: "평면 β",
          position: mid,
          rotation: [90, yaw, 0],
          width: 7,
          depth: 5.2,
        },
      ]);
    },
  },
  {
    id: "cone-sphere",
    name: "원뿔과 구",
    description: "서로 다른 곡면이 만나는 교선",
    create: () =>
      doc("원뿔과 구", [
        {
          id: "cone",
          kind: "cone",
          label: "",
          name: "원뿔",
          position: [0.25, 1.7, 0],
          rotation: [0, 0, 0],
          radius: 1.45,
          height: 3.4,
        },
        {
          id: "sphere",
          kind: "sphere",
          label: "",
          name: "구",
          position: [-0.45, 1.45, 0.15],
          radius: 1.2,
        },
      ]),
  },
  {
    id: "empty",
    name: "빈 장면",
    description: "도형 없이 시작합니다",
    create: () => doc("제목 없는 장면", []),
  },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0]!;
