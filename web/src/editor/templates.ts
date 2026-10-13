import type { CsgOperation } from "@hlr/scene/primitives/csg.js";
import {
  DEFAULT_SETTINGS,
  withDefaults,
  type EditorDoc,
  type EditorObject,
  type PointConstraint,
  type RenderSettings,
} from "./model";
import type { Tuple3 } from "./math";

// Optional fields must stay per kind, so the helper distributes over the union.
type Loose<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>
  : never;
type Draft = Loose<
  EditorObject,
  "hidden" | "name" | "opaque" | "line" | "arrow" | "mark" | "showValue" | "arc"
>;

function doc(
  title: string,
  drafts: Draft[],
  settings: Partial<RenderSettings> = {},
): EditorDoc {
  return {
    version: 1,
    title,
    objects: drafts.map((draft) =>
      withDefaults({
        hidden: false,
        name: draft.name ?? (draft.label || draft.id),
        ...draft,
      } as EditorObject),
    ),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

function point(
  id: string,
  label: string,
  position: Tuple3,
  constraint?: PointConstraint,
): Draft {
  return {
    id,
    kind: "point",
    label,
    name: `점 ${label}`,
    position,
    ...(constraint ? { constraint } : {}),
  };
}

/** Corner `index` of a box: bits 0, 1 and 2 pick its +x, +y and +z side. */
function corner(of: string, index: number): PointConstraint {
  return { type: "anchor", of, key: `corner${index}` };
}

function segment(
  id: string,
  from: string,
  to: string,
  options: { arrow?: boolean; line?: "auto" | "dashed" | "solid" } = {},
): Draft {
  return { id, kind: "segment", label: "", from, to, name: `선분 ${id}`, ...options };
}

function face(id: string, points: string[], name = `면 ${id}`): Draft {
  return { id, kind: "face", label: "", name, points };
}

function angle(
  id: string,
  from: string,
  vertex: string,
  to: string,
  label = "",
): Draft {
  return { id, kind: "angle", label, from, vertex, to, radius: 0.36, name: `각 ${from}${vertex}${to}` };
}

function measure(id: string, from: string, to: string, label: string): Draft {
  return { id, kind: "measure", label, from, to, name: `길이 ${from}${to}` };
}

function boolean(
  id: string,
  name: string,
  op: CsgOperation,
  a: string,
  b: string,
): Draft {
  return { id, kind: "boolean", label: "", name, op, a, b };
}

export type Template = {
  id: string;
  name: string;
  description: string;
  create: () => EditorDoc;
};

const S3 = Math.sqrt(3);
const S6 = Math.sqrt(6);

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
        point("O", "O", [0, 1.2, 0], { type: "center", of: "sphere" }),
      ]),
  },
  {
    id: "sphere-two-planes",
    name: "구와 두 평면",
    description: "투명한 평면, 작도한 점, 직각과 길이 표시",
    create: () =>
      doc(
        "구와 두 평면",
        [
          {
            id: "S",
            kind: "sphere",
            label: "S",
            name: "구 S",
            position: [0, 1, 0],
            radius: 2,
          },
          {
            id: "alpha",
            kind: "plane",
            label: "α",
            name: "평면 α",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            width: 7,
            depth: 7,
          },
          {
            id: "beta",
            kind: "plane",
            label: "β",
            name: "평면 β",
            position: [0, 1.7, 0],
            rotation: [90, 0, 0],
            width: 6,
            depth: 3.4,
            opaque: false,
          },
          point("O", "O", [0, 1, 0], { type: "center", of: "S" }),
          point("H", "H", [0, 0, 0], { type: "foot", point: "O", onto: "alpha" }),
          point("A", "A", [S3, 0, 0], {
            type: "onSphere",
            sphere: "S",
            azimuth: 0,
            elevation: -30,
          }),
          segment("OH", "O", "H"),
          segment("HA", "H", "A"),
          segment("OA", "O", "A"),
          angle("OHA", "O", "H", "A"),
          angle("OAH", "O", "A", "H"),
          measure("mOH", "O", "H", "1"),
          measure("mHA", "H", "A", "√3"),
        ],
        { grid: false },
      ),
  },
  {
    id: "tetrahedron",
    name: "정사면체와 수선의 발",
    description: "면에 내린 수선, 중점, 이면각 θ",
    create: () =>
      doc(
        "정사면체와 수선의 발",
        [
          point("A", "A", [-1.5, 0, S3 / 2]),
          point("B", "B", [1.5, 0, S3 / 2]),
          point("C", "C", [0, 0, -S3]),
          point("D", "D", [0, S6, 0]),
          face("ABC", ["A", "B", "C"], "면 ABC"),
          face("DAB", ["D", "A", "B"], "면 DAB"),
          face("DBC", ["D", "B", "C"], "면 DBC"),
          face("DCA", ["D", "C", "A"], "면 DCA"),
          point("H", "H", [0, 0, 0], { type: "foot", point: "D", onto: "ABC" }),
          point("M", "M", [0, 0, S3 / 2], { type: "midpoint", a: "A", b: "B" }),
          segment("DH", "D", "H"),
          segment("DM", "D", "M"),
          segment("MH", "M", "H"),
          angle("theta", "D", "M", "H", "θ"),
          angle("DHM", "D", "H", "M"),
        ],
        { pointDots: false, grid: false },
      ),
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
          // Pinned to the cube's corners, so they follow it when it changes.
          point("A", "A", [-1, 2, 1], corner("cube", 6)),
          point("B", "B", [1, 2, 1], corner("cube", 7)),
          point("C", "C", [1, 2, -1], corner("cube", 3)),
          point("D", "D", [-1, 2, -1], corner("cube", 2)),
          point("E", "E", [-1, 0, 1], corner("cube", 4)),
          point("F", "F", [1, 0, 1], corner("cube", 5)),
          point("G", "G", [1, 0, -1], corner("cube", 1)),
          point("H", "H", [-1, 0, -1], corner("cube", 0)),
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
    description: "원점에서 평면에 내린 수선의 발 H",
    // 수학의 (x, y, z)를 y가 위인 장면 좌표 (y, z, x)로 옮겼습니다.
    create: () =>
      doc(
        "좌표공간과 평면 ABC",
        [
          point("O", "O", [0, 0, 0]),
          point("A", "A", [0, 0, 2]),
          point("B", "B", [2, 0, 0]),
          point("C", "C", [0, 2, 0]),
          point("x", "x", [0, 0, 3.2]),
          point("y", "y", [3.2, 0, 0]),
          point("z", "z", [0, 3.1, 0]),
          face("ABC", ["A", "B", "C"], "평면 ABC"),
          point("H", "H", [2 / 3, 2 / 3, 2 / 3], {
            type: "foot",
            point: "O",
            onto: "ABC",
          }),
          segment("Ox", "O", "x", { arrow: true }),
          segment("Oy", "O", "y", { arrow: true }),
          segment("Oz", "O", "z", { arrow: true }),
          segment("OH", "O", "H"),
          angle("OHA", "O", "H", "A"),
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
    id: "drilled-sphere",
    name: "구멍 뚫린 구",
    description: "불리언 빼기: 구 − 원기둥",
    create: () =>
      doc("구멍 뚫린 구", [
        {
          id: "ball",
          kind: "sphere",
          label: "",
          name: "구",
          position: [0, 1.6, 0],
          radius: 1.6,
        },
        {
          id: "drill",
          kind: "cylinder",
          label: "",
          name: "원기둥 구멍",
          position: [0, 1.6, 0],
          rotation: [0, 0, 0],
          radius: 0.62,
          height: 4,
        },
        boolean("drilled", "구멍 뚫린 구", "subtract", "ball", "drill"),
      ]),
  },
  {
    id: "notched-box",
    name: "모서리를 깎은 직육면체",
    description: "불리언 빼기: 직육면체 − 구",
    create: () =>
      doc("모서리를 깎은 직육면체", [
        {
          id: "block",
          kind: "box",
          label: "",
          name: "직육면체",
          position: [0, 1, 0],
          rotation: [0, 0, 0],
          size: [3, 2, 2.4],
        },
        {
          id: "bite",
          kind: "sphere",
          label: "",
          name: "깎을 구",
          position: [1.5, 2, 1.2],
          radius: 1.1,
        },
        boolean("notched", "깎은 직육면체", "subtract", "block", "bite"),
      ]),
  },
  {
    id: "steinmetz",
    name: "두 원기둥의 공통부분",
    description: "불리언 교집합: 직교하는 두 원기둥",
    create: () =>
      doc("두 원기둥의 공통부분", [
        {
          id: "along-x",
          kind: "cylinder",
          label: "",
          name: "x축 원기둥",
          position: [0, 1.2, 0],
          rotation: [0, 0, 90],
          radius: 1.2,
          height: 3.6,
        },
        {
          id: "along-z",
          kind: "cylinder",
          label: "",
          name: "z축 원기둥",
          position: [0, 1.2, 0],
          rotation: [90, 0, 0],
          radius: 1.2,
          height: 3.6,
        },
        boolean("common", "공통부분", "intersect", "along-x", "along-z"),
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
