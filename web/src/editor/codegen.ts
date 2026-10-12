import type { Camera } from "@hlr/camera/camera.js";
import type { Vec3 } from "@hlr/math/vec3.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { BoxAabb } from "@hlr/scene/primitives/boxAabb.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Csg } from "@hlr/scene/primitives/csg.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Disk } from "@hlr/scene/primitives/disk.js";
import { OrientedBox } from "@hlr/scene/primitives/orientedBox.js";
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

const RESERVED = new Set([
  "Camera",
  "Scene",
  "SvgRenderer",
  "Vec3",
  "Sphere",
  "Cylinder",
  "Cone",
  "BoxAabb",
  "OrientedBox",
  "Csg",
  "PlaneRect",
  "Disk",
  "TriangleMesh",
  "lineToCubic3",
  "circleToCubics3",
  "intersectionCurvesToOwnedCubics",
  "scene",
  "camera",
  "renderer",
  "svg",
  "width",
  "height",
  "curves",
  "ownedCurves",
  "sections",
  "break",
  "case",
  "class",
  "const",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "for",
  "function",
  "if",
  "import",
  "in",
  "let",
  "new",
  "return",
  "switch",
  "this",
  "var",
  "while",
]);

/** TypeScript that redraws the current scene and view with the public API. */
export function generateCode(
  doc: EditorDoc,
  scene: BuiltScene,
  camera: Camera,
  width: number,
  height: number,
): string {
  const used = new Set(["Camera", "Scene", "SvgRenderer", "Vec3"]);
  const names = new Map<Primitive, string>();
  const taken = new Set<string>();
  const declarations: string[] = [];

  const variable = (p: Primitive) => {
    let base = p.id
      .replace(/[^A-Za-z0-9_$]+(.)?/g, (_, c: string | undefined) =>
        c ? c.toUpperCase() : "",
      )
      .replace(/^[^A-Za-z_$]/, (c) => `shape${c}`);
    if (!base || RESERVED.has(base))
      base = `shape${base.charAt(0).toUpperCase()}${base.slice(1)}`;
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
    taken.add(name);
    return name;
  };

  const construct = (p: Primitive): string => {
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
    if (p instanceof OrientedBox) {
      used.add("OrientedBox");
      return `new OrientedBox(${str(p.id)}, ${v3(p.center)}, ${v3(p.halfSize)}, ${v3(p.axes[0])}, ${v3(p.axes[1])})`;
    }
    if (p instanceof Csg) {
      used.add("Csg");
      return `new Csg(${str(p.id)}, ${str(p.operation)}, ${declare(p.a)}, ${declare(p.b)})`;
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
      const vertices = p.vertices.map(v3).join(",\n  ");
      const triangles = p.triangles.map((t) => `[${t.join(", ")}]`).join(", ");
      return `new TriangleMesh(${str(p.id)}, [\n  ${vertices},\n], [${triangles}])`;
    }
    return "undefined";
  };

  /** Declares a primitive (operands first) and returns its variable name. */
  function declare(p: Primitive): string {
    const known = names.get(p);
    if (known) return known;
    const expression = construct(p);
    const name = variable(p);
    names.set(p, name);
    declarations.push(`const ${name} = ${expression};`);
    return name;
  }

  const occluders = scene.built.map((item) => declare(item.primitive));
  const occluderLines = declarations.splice(0);
  const clear = scene.clear.map((item) => item.primitive);
  for (const p of clear) declare(p);
  const clearLines = declarations.splice(0);

  // Segments and the outlines of clear surfaces share the hidden-line test.
  const line = (a: Vec3 | Tuple3, b: Vec3 | Tuple3) => {
    used.add("lineToCubic3");
    return `lineToCubic3(${v3(a)}, ${v3(b)})`;
  };
  const curveLines: string[] = [];
  for (const segment of scene.segments) {
    const object = doc.objects.find((o) => o.id === segment.id);
    const note =
      segment.line === "dashed"
        ? " // 작업실에서는 늘 점선"
        : segment.line === "solid"
          ? " // 작업실에서는 늘 실선"
          : "";
    curveLines.push(
      `${line(segment.from, segment.to)},${note || (object?.label ? ` // ${object.label}` : "")}`,
    );
  }
  for (const p of clear) {
    const name = names.get(p)!;
    if (p instanceof PlaneRect) {
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(
        ([a, b]): Tuple3 => [
          p.center.x + p.u.x * a! * p.halfWidth + p.v.x * b! * p.halfHeight,
          p.center.y + p.u.y * a! * p.halfWidth + p.v.y * b! * p.halfHeight,
          p.center.z + p.u.z * a! * p.halfWidth + p.v.z * b! * p.halfHeight,
        ],
      );
      curveLines.push(
        `// ${name}의 테두리`,
        ...corners.map((c, i) => `${line(c, corners[(i + 1) % 4]!)},`),
      );
    } else if (p instanceof Disk) {
      used.add("circleToCubics3");
      curveLines.push(
        `...circleToCubics3({ center: ${v3(p.center)}, normal: ${v3(p.normal)}, radius: ${n(p.radius)} }),`,
      );
    } else if (p instanceof TriangleMesh) {
      curveLines.push(
        `// ${name}의 테두리`,
        ...p.vertices.map(
          (v, i) => `${line(v, p.vertices[(i + 1) % p.vertices.length]!)},`,
        ),
      );
    }
  }

  // Where clear surfaces cut solids or meet other surfaces; the renderer
  // already finds these lines between shapes that are in the scene.
  const ownedLines: string[] = [];
  const surfaces = [...scene.built.map((i) => i.primitive), ...clear].filter(
    (p): p is PlaneRect | Disk => p instanceof PlaneRect || p instanceof Disk,
  );
  const clearSet = new Set<Primitive>(clear);
  const owned = (a: Primitive, b: Primitive) => {
    used.add("intersectionCurvesToOwnedCubics");
    ownedLines.push(
      `...intersectionCurvesToOwnedCubics([${names.get(a)}, ${names.get(b)}], { angularSamples: 160 }),`,
    );
  };
  for (let i = 0; i < surfaces.length; i++)
    for (let j = i + 1; j < surfaces.length; j++)
      if (clearSet.has(surfaces[i]!) || clearSet.has(surfaces[j]!))
        owned(surfaces[i]!, surfaces[j]!);
  const solids = scene.built
    .map((item) => item.primitive)
    .filter(
      (p) =>
        !(p instanceof PlaneRect) &&
        !(p instanceof Disk) &&
        !(p instanceof TriangleMesh),
    );
  for (const p of clear)
    if (p instanceof PlaneRect || p instanceof Disk)
      for (const solid of solids) owned(p, solid);

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
  const renderOptions = [
    curveLines.length ? "curves" : "",
    ownedLines.length && settings.intersections ? "ownedCurves" : "",
  ].filter(Boolean);

  return `import {\n  ${[...used].sort().join(",\n  ")},\n} from "hlr";

// ${doc.title} — HLR SVG 도형 작업실에서 내보낸 코드
const width = ${Math.round(width)};
const height = ${Math.round(height)};

${occluderLines.join("\n")}

const scene = new Scene([${occluders.join(", ")}]);
${
  clearLines.length
    ? `\n// 투명한 면: 아무것도 가리지 않으므로 Scene 밖에 두고 선만 그립니다.\n${clearLines.join("\n")}\n`
    : ""
}${
  curveLines.length
    ? `\n// 선분과 투명한 면의 테두리도 같은 숨은선 판정을 거칩니다.\nconst curves = [\n${curveLines.map((l) => `  ${l}`).join("\n")}\n];\n`
    : ""
}${
  ownedLines.length && settings.intersections
    ? `\n// 면 위에 놓인 선: 투명한 면이 자르는 자리와 평면끼리 만나는 선.\nconst ownedCurves = [\n${ownedLines.map((l) => `  ${l}`).join("\n")}\n];\n`
    : ""
}
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

// 라벨, 점, 화살촉, 각 표시는 작업실이 따로 덧그립니다. SVG 저장으로 함께 받을 수 있습니다.
const svg = renderer.render(scene, camera${renderOptions.length ? `, { ${renderOptions.join(", ")} }` : ""});
console.log(svg);
`;
}
