---
name: hlr-svg
description: Render clean black-and-white line drawings of 3D solids as SVG with hidden-line removal, where visible edges are solid and hidden edges are dashed (or left out). Describe the scene as JSON (spheres, cylinders, cones, boxes, planes, disks, boolean solids such as drilled blocks, OBJ/STL meshes, plus lines, circles, points and labels) and one Node command writes the SVG. Use this whenever someone wants a textbook, exam or worksheet geometry figure, a solid-geometry diagram (cube with diagonals, sphere cut by a plane, cone and cylinder intersection, inscribed or tangent spheres), a technical or patent-style line drawing, a 3D sketch for docs or slides, or any SVG of 3D shapes with dashed hidden lines, even if they never say "hidden line removal". No npm install needed.
---

# hlr-svg

This skill draws 3D solids as line art the way a geometry textbook does: outlines, rims, edges and the curves where solids meet, with the parts behind other surfaces dashed. The visibility is computed exactly by the [hlr](https://github.com/jiwonMe/hlr-svg) library, which is bundled in `scripts/hlr.mjs`; you never guess what is hidden.

You write a JSON scene and run one command. It needs Node.js 20 or later and nothing else.

```sh
node <skill-dir>/scripts/render.mjs scene.json -o figure.svg
```

`<skill-dir>` is the folder this file is in. The command prints one summary line to stderr, for example `wrote figure.svg: 640x480, 2 objects, 6 visible / 6 hidden paths (orthographic, halfHeight 1.668)`. It exits 1 with a message naming the bad field (`objects[0].radius: must be greater than 0, got -1`) when the scene is wrong. Fix that field and run it again.

## When to use it

- Solid geometry: a cube or prism with labelled vertices and a space diagonal, a sphere cut by a plane, a cone inscribed in a cylinder, tangent spheres, a section through a solid.
- Mechanical sketches: a block with a drilled hole (`csg` subtract), pipes meeting at an angle, a part from an OBJ/STL file.
- Any figure where the reader must see what is behind what, in a style that prints well in black and white.

Do not use it for shaded or coloured renders, charts or flat 2D diagrams. It draws lines only.

## Workflow

1. **Pick the figure.** Decide the solids, which point of view shows the idea, and which points need labels.
2. **Write the scene.** Start from the closest file in `examples/` and change it. The full format is in `references/scene-format.md`.
3. **Render.** `node <skill-dir>/scripts/render.mjs scene.json -o figure.svg`.
4. **Look at it.** Read the SVG back, or rasterise it if you can (for example `google-chrome --headless --screenshot=figure.png --window-size=800,600 figure.svg`, or `rsvg-convert figure.svg -o figure.png`) and view the PNG. Check that labels do not sit on lines and that the view shows the hidden parts you meant to show.
5. **Adjust** the camera (`azimuth`, `elevation`), label `offset`s or style, and render again.

## The scene in brief

The world is y-up. Units are whatever you like; the camera frames the scene automatically.

```json
{
  "title": "A sphere cut by a horizontal plane",
  "width": 640,
  "height": 480,
  "camera": { "azimuth": 30, "elevation": 20 },
  "objects": [
    { "type": "sphere", "id": "ball", "center": [0, 0, 0], "radius": 1 },
    {
      "type": "plane",
      "id": "cut",
      "center": [0, 0.4, 0],
      "normal": [0, 1, 0],
      "width": 3.2,
      "height": 2.4
    }
  ],
  "lines": [{ "from": [0, 0, 0], "to": [0, 0.4, 0] }],
  "points": [
    { "at": [0, 0, 0], "label": "O", "on": ["ball"] },
    { "at": [0, 0.4, 0], "label": "O′", "on": ["cut"] }
  ]
}
```

| Key                | What it holds                                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objects`          | Solids and surfaces: `sphere`, `cylinder`, `cone`, `box` (axis-aligned, or rotated with `axisX`/`axisY`), `plane` (a rectangle), `disk`, `csg` (`union`, `subtract`, `intersect` of two solids), `mesh` (OBJ/STL `file`, or inline `vertices` and `triangles`). Give each an `id` when something refers to it. |
| `camera`           | `view` (`isometric`, `front`, `top`, ...), or `azimuth`/`elevation` in degrees, or `direction`, or `position` + `target`. `projection` is `orthographic` (default, best for textbook figures) or `perspective` (`fov`). `zoom` and `margin` scale the automatic framing.                                       |
| `lines`, `circles` | Extra curves, such as a diagonal, an axis, a radius or a great circle. They are hidden behind solids like everything else. A curve that lies on a surface needs `"on": ["<id>"]`, or the surface it lies on will hide it.                                                                                      |
| `points`, `labels` | Dots and text drawn on top. A point is drawn hollow and faint when it is hidden; give `"on": ["<id>"]` for points on or inside that object's surface. `offset: [dx, dy]` moves a label in pixels.                                                                                                              |
| `style`            | `strokeVisible`, `strokeHidden`, `strokeWidthVisible`, `strokeWidthHidden`, `dashArrayHidden`, `opacityHidden`, `lineCap`, `lineJoin`.                                                                                                                                                                         |
| `hiddenLines`      | `false` drops the dashed lines entirely.                                                                                                                                                                                                                                                                       |
| `include`          | Turn off generated curves: `silhouettes`, `rims`, `borders`, `boxEdges`, `meshEdges`, `csg`, `intersections`.                                                                                                                                                                                                  |
| `quality`          | `draft`, `normal` (default) or `high`.                                                                                                                                                                                                                                                                         |

## Examples

Each file in `examples/` renders as it is:

- `examples/cube-diagonal.json`: cube ABCD-EFGH with all eight vertices labelled and the space diagonal AG dashed through the inside.
- `examples/sphere-plane.json`: a sphere cut by a plane, the section circle, centres O and O′.
- `examples/cylinder-cone.json`: a cone pierced through a cylinder; the intersection curves are found automatically.
- `examples/drilled-block.json`: a box minus a cylinder (`csg`), in perspective with a custom line style.
- `examples/orbit-ring.json`: a sphere with its equator (a circle `on` the sphere) and a tilted ring around it.

## Rules that keep figures clean

- **Orthographic for geometry, perspective for objects.** Textbook figures keep parallel edges parallel. Use perspective only for something that should look like a physical object.
- **Show the hidden part you care about.** Turn the camera until the edge or curve that matters is dashed but not lying on top of another line. `azimuth` 20–40 and `elevation` 15–30 suit most solids. A pure `front` or `top` view hides depth and makes edges coincide.
- **Curves on surfaces need `on`.** A circle drawn on a sphere, a line along a face or a point on a surface is hidden by that surface unless its id is listed in `on`.
- **Let the solids make the lines.** Do not redraw outlines, rims or box edges with `lines`; they are generated, and doubled lines look heavier. Intersections between solids appear by themselves.
- **Labels sit beside their point.** Use `offset` to move a label away from the lines that meet there, outward from the figure.
- **Keep one style per set of figures**, with the same `width`, `height`, stroke widths and dash pattern.

## Using the library directly

For an interactive page or a build step in a TypeScript or JavaScript project, use the library instead of the CLI: `npm install hlr`, then `new SvgRenderer({ width, height }).render(scene, camera)`. `references/library-api.md` lists the API, and `scripts/render.mjs` is a worked example of building scenes and cameras with it.

## References

- `references/scene-format.md`: every key of the scene JSON with its default, and the camera framing rules.
- `references/recipes.md`: ready-made scenes for common textbook figures (prism, pyramid, inscribed sphere, sections, tangent spheres, coordinate axes) and fixes for common problems.
- `references/library-api.md`: the TypeScript API of the `hlr` package, for use in code.
