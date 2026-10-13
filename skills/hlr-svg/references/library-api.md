# The `hlr` library API

Use the library itself when the figure lives in code: a page that re-renders as the user turns the camera, a build step that writes many figures, or anything that needs more than the JSON scene offers. Full documentation: <https://hlr.js.org> (one-file version for LLMs: <https://hlr.js.org/llms-full.txt>).

```sh
npm install hlr     # or pnpm add hlr
```

Inside this skill the same API is available without installing anything, as `scripts/hlr.mjs`:

```js
import {
  Scene,
  Camera,
  SvgRenderer,
  Sphere,
  Vec3,
} from "<skill-dir>/scripts/hlr.mjs";
```

## Minimal program

```ts
import { Camera, Scene, Sphere, PlaneRect, SvgRenderer, Vec3 } from "hlr";

const scene = new Scene();
scene.add(new Sphere("ball", new Vec3(0, 0, 0), 1));
scene.add(
  new PlaneRect(
    "cut",
    new Vec3(0, 0.4, 0),
    new Vec3(0, 1, 0),
    new Vec3(1, 0, 0),
    1.6,
    1.2,
  ),
);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(3, 2, 4),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 1.6,
  aspect: 4 / 3,
  near: 0.1,
  far: 100,
});

const renderer = new SvgRenderer({ width: 640, height: 480 });
const svg = renderer.render(scene, camera);
```

Keep one `SvgRenderer` and call `render` again for each frame: it caches intersection curves across camera moves and projected paths across style changes.

## Primitives

All take an `id` first; ids must be unique in a scene.

| Constructor                                                       | Notes                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `new Sphere(id, center, radius)`                                  |                                                                                                    |
| `new Cylinder(id, base, axis, height, radius, caps = "both")`     | `caps`: `"both"` or `"none"`. `axis` is normalised.                                                |
| `new Cone(id, apex, axis, height, baseRadius, cap = "base")`      | `axis` points from the apex to the base. `cap`: `"base"` or `"none"`.                              |
| `new BoxAabb(id, min, max)`                                       | Axis-aligned box.                                                                                  |
| `new OrientedBox(id, center, halfSize, axisX, axisY)`             | Rotated box; `halfSize` along the local axes.                                                      |
| `new PlaneRect(id, center, normal, uHint, halfWidth, halfHeight)` | Finite two-sided rectangle. Note: half sizes.                                                      |
| `new Disk(id, center, normal, radius)`                            |                                                                                                    |
| `new Csg(id, "union" \| "subtract" \| "intersect", a, b)`         | `a`, `b`: Sphere, Cylinder, Cone, BoxAabb, OrientedBox or Csg.                                     |
| `new TriangleMesh(id, vertices, triangles)`                       | `triangles`: `[i, j, k]` index triples.                                                            |
| `parseObj(data)`, `parseStl(data)`                                | `data`: string, `ArrayBuffer` or `Uint8Array` (not a path). Return `{ meshes, bounds, warnings }`. |

`Vec3` has static helpers: `Vec3.add`, `sub`, `mulScalar`, `dot`, `cross`, `len`, `normalize`, `distance`.

## Camera

```ts
Camera.from({
  kind: "perspective",
  position,
  target,
  up,
  fovYRad,
  aspect,
  near,
  far,
});
Camera.from({
  kind: "orthographic",
  position,
  target,
  up,
  halfHeight,
  aspect,
  near,
  far,
});
```

`camera.projectToSvg(point, width, height)` returns `{ x, y, z }` in SVG pixels, which is how to place labels.

## `SvgRenderer`

```ts
new SvgRenderer({
  width,
  height,
  background: true, // white rect
  style: {
    strokeVisible: "black",
    strokeHidden: "black",
    strokeWidthVisible: 1.5,
    strokeWidthHidden: 1.5,
    dashArrayHidden: "3 3",
    opacityHidden: 0.5,
    lineCap: "butt",
    lineJoin: "round",
  },
  include: {
    silhouettes,
    rims,
    borders,
    boxEdges,
    meshEdges,
    csg,
    intersections,
  }, // all true
  hlr: { samples: 192, refineIters: 22 },
  intersections: { angularSamples: 160 },
  mesh: { creaseAngleDeg: 30 },
});

renderer.render(scene, camera, {
  curves: [lineToCubic3(a, b), ...circleToCubics3({ center, normal, radius })],
  ownedCurves: [{ bez, ignorePrimitiveIds: ["ball"] }], // curves lying on those surfaces
});
```

`render` returns the SVG as a string. User `curves` take part in hidden-line removal; `ownedCurves` do too, except that hits on the listed primitives at the curve itself do not hide it.

## Point visibility

```ts
const hidden = !scene.toRaycastScene(camera).visibleAtPoint(point, {
  eps: 1e-4,
  ignorePrimitiveIds: ["ball"],
});
```

## Shaded surfaces

`buildSurfaceBuffer`, `shadeSurfaceBuffer`, `buildSurfaceClipPaths` and `lightDirectionFromAngles` add Lambert-shaded fills under the lines for a browser page. See the "Surface lighting API" section of the README at <https://github.com/jiwonMe/hlr-svg>.
