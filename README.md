# hlr-svg

A TypeScript library for rendering 3D curves as SVG with Hidden Line Removal (HLR) / Hidden Curve Removal (HCR) support. All curves are output as cubic Bezier curves, enabling accurate representation of visible and hidden line segments.

## Features

- **HLR/HCR**: Automatically determines which curve segments are visible and renders them as solid/dashed lines
- **Multiple Primitives**: Supports Sphere, Cylinder, Cone, BoxAabb, PlaneRect, and Disk
- **Triangle Mesh Import**: Parse OBJ/STL into `TriangleMesh` and render SVG feature lines with HLR
- **Intersection Curves**: Computes intersection curves between overlapping primitives
- **Silhouette Generation**: Automatically generates silhouette curves for curved surfaces
- **three.js-style API**: Familiar API design similar to three.js
- **SVG Output**: All curves are output as SVG cubic Bezier paths

## Tooling

- **Package manager**: `pnpm 10.33.0`
- **Node runtime**: `20.x`
- **Primary validation**: `pnpm check`

## Local Development

```bash
corepack enable
nvm use 20
pnpm install
```

## Quick Start

```typescript
import { Scene, Camera, SvgRenderer, Sphere, Vec3 } from "hlr-svg";

// Create a scene with primitives
const scene = new Scene();
scene.add(new Sphere("sphere1", new Vec3(0, 0, 0), 1));

// Create a camera
const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(3, 2, 4),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  fovYRad: Math.PI / 4,
  aspect: 16 / 9,
  near: 0.1,
  far: 100,
});

// Render to SVG
const renderer = new SvgRenderer({
  width: 800,
  height: 600,
});

const svg = renderer.render(scene, camera);
console.log(svg);
```

## Supported Primitives

- **Sphere**: `new Sphere(id, center, radius)`
- **Cylinder**: `new Cylinder(id, base, axis, height, radius, caps)`
- **Cone**: `new Cone(id, apex, axis, height, baseRadius, caps)`
- **BoxAabb**: `new BoxAabb(id, min, max)`
- **PlaneRect**: `new PlaneRect(id, center, normal, u, halfWidth, halfHeight)`
- **Disk**: `new Disk(id, center, normal, radius)`
- **TriangleMesh**: `new TriangleMesh(id, vertices, triangles)`

## API Overview

### Scene

```typescript
const scene = new Scene();
scene.add(new Sphere("s1", center, radius));
scene.add(new Cylinder("c1", base, axis, height, radius, "both"));
```

### Camera

```typescript
const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(x, y, z),
  target: new Vec3(x, y, z),
  up: new Vec3(0, 1, 0),
  fovYRad: Math.PI / 4,
  aspect: 16 / 9,
  near: 0.1,
  far: 100,
});
```

### SvgRenderer

```typescript
const renderer = new SvgRenderer({
  width: 800,
  height: 600,
  background: true,
  style: {
    strokeWidthVisible: 2,
    strokeWidthHidden: 1.5,
    dashArrayHidden: "4 4",
  },
  include: {
    silhouettes: true,
    rims: true,
    borders: true,
    boxEdges: true,
    intersections: true,
  },
});

const svg = renderer.render(scene, camera);
```

## Rendering Options

### Include Options

Control which curves are automatically generated:

- `silhouettes`: Silhouette curves for spheres, cylinders, and cones
- `rims`: Rim circles for cylinders and cones
- `borders`: Border outlines for PlaneRect
- `boxEdges`: All 12 edges for BoxAabb
- `meshEdges`: Feature edges for TriangleMesh (boundary / crease / silhouette)
- `intersections`: Intersection curves between overlapping primitives

### HLR Parameters

Fine-tune visibility detection:

```typescript
renderer.render(scene, camera, {
  hlr: {
    samples: 192, // Number of samples for visibility detection
    refineIters: 22, // Bisection refinement iterations
    epsVisible: 2e-4, // Epsilon for visibility raycasting
    cutEps: 1e-6, // Epsilon for transition point deduplication
    minSegLenSq: 1e-6, // Minimum segment length squared
  },
});
```

### Custom Curves

Add your own curves to the scene:

```typescript
import { lineToCubic3 } from "hlr-svg";

const customCurve = lineToCubic3(new Vec3(0, 0, 0), new Vec3(1, 1, 1));

renderer.render(scene, camera, {
  curves: [customCurve],
});
```

## OBJ/STL Import

You can import geometry-only OBJ/STL data and send it through the same SVG HLR pipeline:

```typescript
import {
  Camera,
  Scene,
  SvgRenderer,
  Vec3,
  parseObj,
} from "hlr-svg";

const bytes = await fetch("/models/example.obj").then((res) =>
  res.arrayBuffer(),
);
const imported = parseObj(bytes);

const scene = new Scene(imported.meshes);
const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(4, 3, 5),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  fovYRad: (50 * Math.PI) / 180,
  aspect: 16 / 9,
  near: 0.1,
  far: 100,
});

const renderer = new SvgRenderer({
  width: 960,
  height: 540,
  include: {
    intersections: false,
    meshEdges: true,
  },
  mesh: {
    creaseAngleDeg: 30,
  },
});

const svg = renderer.render(scene, camera);
```

### OBJ/STL v1 Limitations

- Geometry only: `MTL`, materials, textures, UVs, and `glTF/GLB` are out of scope.
- OBJ supports `v`, `vn`, `f`, `o`, `g`, and comments.
- `mtllib`, `usemtl`, `vt`, `l`, `p`, and `curv` are ignored with warnings.
- Triangle meshes participate in raycast/HLR, but analytic intersection curves still apply only to the built-in analytic primitives.
- The parser API accepts in-memory data (`string`, `ArrayBuffer`, `Uint8Array`), not file paths.

## Build & Development

### Build

```bash
pnpm build
```

### Run Demo

```bash
# Run the full validation stack first
pnpm check

# Run single demo case
pnpm demo

# Run all demo cases
pnpm demo:all
```

### Web Demo

```bash
# Development server (no library prebuild required)
pnpm dev

# Build for production
pnpm web:build

# Preview production build
pnpm web:preview
```

### Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
pnpm check
pnpm clean
```

## Architecture

The library is organized into several key modules:

- **`core/`**: User-facing API (Scene, SvgRenderer)
- **`scene/`**: Internal scene representation and raycasting
- **`curves/`**: Cubic Bezier utilities and curve builders
- **`hlr/`**: Hidden line removal logic
- **`intersections/`**: Intersection curve computation
- **`svg/`**: SVG output generation

For detailed design notes, see:

- [`src/curves/README.md`](src/curves/README.md) - Curve generation and Bezier utilities
- [`src/hlr/README.md`](src/hlr/README.md) - HLR/HCR implementation
- [`src/scene/intersections/README.md`](src/scene/intersections/README.md) - Intersection curve computation

## License

MIT License - see [LICENSE](LICENSE) file for details.
