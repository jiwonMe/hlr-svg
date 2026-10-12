import type { Camera } from "@hlr/camera/camera.js";
import type { Vec3 } from "@hlr/math/vec3.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Disk } from "@hlr/scene/primitives/disk.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import { TriangleMesh } from "@hlr/scene/primitives/triangleMesh.js";
import type { BuiltScene } from "./build";
import { formatNumber, type Tuple3 } from "./math";
import type { EditorDoc } from "./model";

const n = (value: number) => formatNumber(value, 4);
const v3 = (v: Vec3 | Tuple3) =>
  "x" in v
    ? `new Vec3(${n(v.x)}, ${n(v.y)}, ${n(v.z)})`
    : `new Vec3(${n(v[0])}, ${n(v[1])}, ${n(v[2])})`;
const str = (text: string) => JSON.stringify(text);

/** TypeScript that redraws the current scene and view with the public API. */
export function generateCode(
  doc: EditorDoc,
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
): string {
  const used = new Set(["Camera", "Scene", "SvgRenderer", "Vec3"]);
  const lines = scene.built.map(({ primitive: p }) => {
    if (p instanceof Sphere) {
      used.add("Sphere");
      return `new Sphere(${str(p.id)}, ${v3(p.center)}, ${n(p.radius)})`;
    }
    if (p instanceof Cylinder) {
      used.add("Cylinder");
      return `new Cylinder(${str(p.id)}, ${v3(p.base)}, ${v3(p.axis)}, ${n(p.height)}, ${n(p.radius)}, "both")`;
    }
    if (p instanceof Cone) {
      used.add("Cone");
      return `new Cone(${str(p.id)}, ${v3(p.apex)}, ${v3(p.axis)}, ${n(p.height)}, ${n(p.baseRadius)}, "base")`;
    }
    if (p instanceof BoxAabb) {
      used.add("BoxAabb");
      return `new BoxAabb(${str(p.id)}, ${v3(p.min)}, ${v3(p.max)})`;
    }
    if (p instanceof PlaneRect) {
      used.add("PlaneRect");
      return `new PlaneRect(${str(p.id)}, ${v3(p.center)}, ${v3(p.normal)}, ${v3(p.u)}, ${n(p.halfWidth)}, ${n(p.halfHeight)})`;
    }
    if (p instanceof Disk) {
      used.add("Disk");
      return `new Disk(${str(p.id)}, ${v3(p.center)}, ${v3(p.normal)}, ${n(p.radius)})`;
    }
    if (p instanceof TriangleMesh) {
      used.add("TriangleMesh");
      const vertices = p.vertices.map(v3).join(",\n      ");
      const triangles = p.triangles.map((t) => `[${t.join(", ")}]`).join(", ");
      return `new TriangleMesh(${str(p.id)}, [\n      ${vertices},\n    ], [${triangles}])`;
    }
    return `// ${str(p.id)}`;
  });
  if (scene.segments.length) used.add("lineToCubic3");

  const { settings } = doc;
  const hiddenStyle =
    settings.hiddenLines === "removed"
      ? `opacityHidden: 0,`
      : settings.hiddenLines === "solid"
        ? `dashArrayHidden: "none",\n    opacityHidden: 1,`
        : `dashArrayHidden: "3.2 2.6",\n    opacityHidden: 0.9,`;
  const view =
    camera.kind === "orthographic"
      ? `kind: "orthographic",\n  halfHeight: ${n(camera.halfHeight!)},`
      : `kind: "perspective",\n  fovYRad: ${n(camera.fovYRad!)},`;

  const curves = scene.segments.length
    ? `\n// 점을 잇는 선분도 같은 숨은선 판정을 거칩니다.\nconst curves = [\n${scene.segments
        .map((s) => `  lineToCubic3(${v3(s.from)}, ${v3(s.to)}),`)
        .join("\n")}\n];\n`
    : "";

  return `import {\n  ${[...used].sort().join(",\n  ")},\n} from "hlr";

// ${doc.title} — HLR SVG 도형 작업실에서 내보낸 코드
const width = ${Math.round(width)};
const height = ${Math.round(height)};

const scene = new Scene([
${lines.map((line) => `  ${line},`).join("\n")}
]);
${curves}
const camera = Camera.from({
  ${view}
  position: ${v3(camera.position)},
  target: ${v3(camera.target)},
  up: ${v3(camera.up)},
  aspect: width / height,
  near: ${n(camera.near)},
  far: ${n(camera.far)},
});

const renderer = new SvgRenderer({
  width,
  height,
  include: { intersections: ${settings.intersections} },
  style: {
    strokeWidthVisible: ${n(settings.strokeWidth)},
    strokeWidthHidden: ${n(Math.max(0.75, settings.strokeWidth * 0.78))},
    ${hiddenStyle}
  },
});

// 점 이름과 화살표는 작업실이 따로 덧그립니다. SVG 저장으로 함께 받을 수 있습니다.
const svg = renderer.render(scene, camera${scene.segments.length ? ", { curves }" : ""});
console.log(svg);
`;
}
