import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const lib = await import(pathToFileURL(resolve(root, "dist/index.js")).href);
const {
  Camera,
  Vec3,
  Sphere,
  Cylinder,
  Cone,
  Scene,
  SvgRenderer,
  buildSurfaceBuffer,
  shadeSurfaceBuffer,
  lightDirectionFromAngles,
} = lib;
const presets = [
  [
    "sphere-cylinder",
    [
      new Sphere("sphere", new Vec3(0.45, 0.1, 0), 1.35),
      new Cylinder(
        "cylinder",
        new Vec3(-0.3, -1.7, 0),
        new Vec3(0, 1, 0),
        3.4,
        0.82,
      ),
    ],
  ],
  [
    "cone-sphere",
    [
      new Cone("cone", new Vec3(0.25, 1.7, 0), new Vec3(0, -1, 0), 3.4, 1.45),
      new Sphere("sphere", new Vec3(-0.45, -0.25, 0.15), 1.2),
    ],
  ],
  [
    "sphere-sphere",
    [
      new Sphere("left", new Vec3(-0.7, 0, 0), 1.35),
      new Sphere("right", new Vec3(0.7, 0.15, 0), 1.35),
    ],
  ],
];
function camera(kind, angle = 0) {
  return Camera.from({
    kind,
    position: new Vec3(
      Math.sin(Math.PI / 4 + angle) * 6.94,
      4.9075,
      Math.cos(Math.PI / 4 + angle) * 6.94,
    ),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    halfHeight: 2.65,
    fovYRad: 2 * Math.atan(2.65 / 8.5),
    aspect: 720 / 520,
    near: 0.05,
    far: 100,
  });
}
function measure(run, count = 24) {
  for (let i = 0; i < 6; i++) run(i);
  const times = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    run(i);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    medianMs: +times[Math.floor(times.length / 2)].toFixed(3),
    p95Ms:
      +times[
        Math.min(times.length - 1, Math.floor(times.length * 0.95))
      ].toFixed(3),
  };
}
const rows = [];
for (const [name, primitives] of presets)
  for (const kind of ["orthographic", "perspective"]) {
    const view = camera(kind),
      scene = new Scene(primitives);
    const renderer = new SvgRenderer({
      width: 720,
      height: 520,
      background: false,
      hlr: { samples: 112, coarseSamples: 0, refineIters: 18 },
      intersections: { angularSamples: 112 },
    });
    const cameras = Array.from({ length: 24 }, (_, i) =>
      camera(kind, i * 0.013),
    );
    const stationary = measure(() => renderer.render(scene, view));
    const orbit = measure((i) => renderer.render(scene, cameras[i % 24]));
    const style = measure((i) =>
      renderer.render(scene, view, {
        style: { strokeWidthVisible: 1 + i * 0.03 },
      }),
    );
    const high = measure(
      () => buildSurfaceBuffer(primitives, view, { width: 720, height: 520 }),
      12,
    );
    const drag = measure(
      () => buildSurfaceBuffer(primitives, view, { width: 320, height: 231 }),
      24,
    );
    const buffer = buildSurfaceBuffer(primitives, view, {
      width: 720,
      height: 520,
    });
    const light = measure((i) =>
      shadeSurfaceBuffer(buffer, {
        lightDirection: lightDirectionFromAngles(i * 15, 45),
        ambient: 0.3,
      }),
    );
    rows.push({
      name,
      kind,
      stationary,
      orbit,
      style,
      surface720: high,
      surface320: drag,
      lighting: light,
    });
  }
console.log(JSON.stringify({ node: process.version, rows }, null, 2));
