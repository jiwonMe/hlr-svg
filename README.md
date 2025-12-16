# hlr-svg

A TypeScript library for rendering 3D curves as SVG with Hidden Line Removal (HLR) / Hidden Curve Removal (HCR) support. All curves are output as cubic Bezier curves, enabling accurate representation of visible and hidden line segments.

## Features

- **HLR/HCR**: Automatically determines which curve segments are visible and renders them as solid/dashed lines
- **Multiple Primitives**: Supports Sphere, Cylinder, Cone, BoxAabb, PlaneRect, and Disk
- **Intersection Curves**: Computes intersection curves between overlapping primitives
- **Silhouette Generation**: Automatically generates silhouette curves for curved surfaces
- **three.js-style API**: Familiar API design similar to three.js
- **SVG Output**: All curves are output as SVG cubic Bezier paths

## Installation

```bash
npm install
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
- `intersections`: Intersection curves between overlapping primitives

### HLR Parameters

Fine-tune visibility detection:

```typescript
renderer.render(scene, camera, {
  hlr: {
    samples: 192,        // Number of samples for visibility detection
    refineIters: 22,     // Bisection refinement iterations
    epsVisible: 2e-4,    // Epsilon for visibility raycasting
    cutEps: 1e-6,        // Epsilon for transition point deduplication
    minSegLenSq: 1e-6,   // Minimum segment length squared
  },
});
```

### Custom Curves

Add your own curves to the scene:

```typescript
import { lineToCubic3 } from "hlr-svg";

const customCurve = lineToCubic3(
  new Vec3(0, 0, 0),
  new Vec3(1, 1, 1)
);

renderer.render(scene, camera, {
  curves: [customCurve],
});
```

## Build & Development

### Build

```bash
npm run build
```

### Run Demo

```bash
# Build first
npm run build

# Run single demo case
npm run demo

# Run all demo cases
npm run demo:all
```

### Web Demo

```bash
# Development server
npm run web:dev

# Build for production
npm run web:build

# Preview production build
npm run web:preview
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
