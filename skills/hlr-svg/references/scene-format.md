# Scene format

`scripts/render.mjs` reads one JSON object. Every key is optional except `objects`, and unknown keys are an error, so a typo fails loudly instead of being ignored.

Vectors are `[x, y, z]` arrays. The world is **y-up**: the floor is the x–z plane. Lengths have no unit; the camera frames whatever you draw.

```sh
node scripts/render.mjs scene.json -o figure.svg     # write a file
node scripts/render.mjs scene.json > figure.svg      # or stdout
cat scene.json | node scripts/render.mjs - -o f.svg  # read stdin
node scripts/render.mjs scene.json --width 1200 --height 900 -o big.svg
```

Exit codes: `0` rendered, `1` bad scene or unreadable file (the message names the field), `2` bad command-line arguments. Mesh paths are resolved relative to the scene file (relative to the working directory when reading stdin).

## Top level

| Key                | Default                | Meaning                                                                                                                                                                                                                    |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | none                   | Written as the SVG `<title>`, for accessibility.                                                                                                                                                                           |
| `width`, `height`  | `800`, `600`           | Size of the SVG in pixels. Also sets the aspect ratio of the camera.                                                                                                                                                       |
| `camera`           | isometric, auto-framed | See [Camera](#camera).                                                                                                                                                                                                     |
| `objects`          | required               | List of solids and surfaces. See [Objects](#objects). May be empty if `lines` or `circles` draw something.                                                                                                                 |
| `lines`, `circles` | `[]`                   | Extra 3D curves that take part in hidden-line removal. See [Curves](#curves).                                                                                                                                              |
| `points`, `labels` | `[]`                   | Dots and text drawn over the lines. See [Points and labels](#points-and-labels).                                                                                                                                           |
| `style`            | see below              | Line style.                                                                                                                                                                                                                |
| `labelStyle`       | see below              | Text style for point labels and labels.                                                                                                                                                                                    |
| `hiddenLines`      | `true`                 | `false` removes the dashed hidden lines.                                                                                                                                                                                   |
| `background`       | `true`                 | `true` is a white rectangle, `false` is transparent, a string is a CSS colour (`"#fafaf7"`).                                                                                                                               |
| `include`          | all `true`             | Generated curves to keep: `silhouettes`, `rims`, `borders`, `boxEdges`, `meshEdges`, `csg`, `intersections`.                                                                                                               |
| `quality`          | `"normal"`             | `"draft"`, `"normal"` or `"high"`: how finely visibility and intersection curves are sampled. Try `"high"` if a dash starts or stops slightly off a crossing. Typical scenes render in well under a second at any setting. |

### `style`

| Key                  | Default                          |
| -------------------- | -------------------------------- |
| `strokeVisible`      | `"black"`                        |
| `strokeHidden`       | `"black"`                        |
| `strokeWidthVisible` | `1.5`                            |
| `strokeWidthHidden`  | `1.5`                            |
| `dashArrayHidden`    | `"3 3"`                          |
| `opacityHidden`      | `0.5`                            |
| `lineCap`            | `"butt"` (`"round"`, `"square"`) |
| `lineJoin`           | `"round"` (`"miter"`, `"bevel"`) |

### `labelStyle`

| Key          | Default                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `fontFamily` | `"'Times New Roman', Times, serif"`                                                                                                         |
| `fontSize`   | `16`                                                                                                                                        |
| `fontStyle`  | `"italic"` (use `"normal"` for words)                                                                                                       |
| `color`      | `style.strokeVisible`                                                                                                                       |
| `halo`       | `"white"`: a stroke behind the text so it stays readable over lines. `"none"` turns it off; match it to `background` when that is a colour. |

## Camera

The camera always looks at the scene from a **direction**. Give it in one of four ways; the first one present wins:

1. `position` and `target`: the camera stands at `position` and looks at `target`.
2. `direction`: a vector pointing from the scene towards the camera, such as `[1, 0.6, 2]`.
3. `azimuth` and `elevation` in degrees. Azimuth turns around the y axis, from the front (`0`, looking from +z) towards the right (`90`, looking from +x). Elevation lifts the camera above the floor (`90` looks straight down). If only one is given the other defaults to `azimuth: 45`, `elevation: 30`.
4. `view`: `"isometric"` (the default, direction `[1, 1, 1]`), `"front"` (+z), `"back"`, `"right"` (+x), `"left"`, `"top"` (+y) or `"bottom"`.

| Key          | Default                    | Meaning                                                                                                                  |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `projection` | `"orthographic"`           | Or `"perspective"`.                                                                                                      |
| `up`         | `[0, 1, 0]`                | Which way is up in the picture. When the camera looks straight along `up` (a top view), −z points up in the picture.     |
| `target`     | centre of the framed scene | The point at the middle of the picture.                                                                                  |
| `zoom`       | `1`                        | Greater than 1 enlarges the drawing in the automatic framing.                                                            |
| `margin`     | `1.12`                     | Space around the drawing in the automatic framing; `1` touches the edges.                                                |
| `halfHeight` | auto                       | Orthographic only: half the height of the picture in world units. Fixes the scale, for a set of figures that must match. |
| `fov`        | `35`                       | Perspective only: vertical field of view in degrees.                                                                     |
| `distance`   | auto                       | Perspective only: distance from `target` to the camera.                                                                  |

**Automatic framing.** Every object, curve, point and label position is projected onto the picture plane, and the camera is centred on and sized to their extent, so nothing is cut off and the drawing is centred. Labels are placed after framing: a long label at the very edge can still poke out, so raise `margin` if it does. To keep the scale identical across figures, set `halfHeight` (orthographic) or `distance` (perspective) yourself.

## Objects

Every object has a `type` and an optional `id` (a string, unique in the scene). Ids are used by `on` lists. Objects without an id get one such as `sphere-1`.

### `sphere`

| Key      | Default     |
| -------- | ----------- |
| `center` | `[0, 0, 0]` |
| `radius` | `1`         |

### `cylinder`

A finite cylinder from `base` along `axis`.

| Key      | Default     | Meaning                                            |
| -------- | ----------- | -------------------------------------------------- |
| `base`   | `[0, 0, 0]` | Centre of the bottom circle.                       |
| `axis`   | `[0, 1, 0]` | Direction from the bottom to the top (any length). |
| `height` | `1`         |                                                    |
| `radius` | `0.5`       |                                                    |
| `caps`   | `"both"`    | `"none"` (or `false`) for an open tube.            |

### `cone`

| Key      | Default      | Meaning                                   |
| -------- | ------------ | ----------------------------------------- |
| `apex`   | `[0, 1, 0]`  | The tip.                                  |
| `axis`   | `[0, -1, 0]` | Direction from the apex towards the base. |
| `height` | `1`          | Apex to base.                             |
| `radius` | `0.5`        | Base radius.                              |
| `cap`    | `"base"`     | `"none"` (or `false`) for an open cone.   |

A cone standing on the floor with its base centre at the origin: `"apex": [0, h, 0], "axis": [0, -1, 0], "height": h`.

### `box`

Either `min` and `max` corners, or `center` (default `[0, 0, 0]`) and `size` (default `[1, 1, 1]`, full lengths along x, y, z). Not both.

Add `axisX` and/or `axisY` to rotate the box: they are the directions of its local x and y edges (`axisY` is made perpendicular to `axisX`; local z follows by the right-hand rule). `size` is then measured along those axes. Example, a box turned 30° about y: `"axisX": [0.866, 0, -0.5]`.

### `plane`

A flat rectangle (two-sided, no thickness).

| Key      | Default                                                | Meaning                        |
| -------- | ------------------------------------------------------ | ------------------------------ |
| `center` | `[0, 0, 0]`                                            |                                |
| `normal` | `[0, 1, 0]`                                            | Facing direction.              |
| `u`      | `[1, 0, 0]` (or `[0, 0, 1]` when the normal is near x) | Direction of the `width` side. |
| `width`  | `2`                                                    |                                |
| `height` | `width`                                                | Along `normal × u`.            |

### `disk`

| Key      | Default     |
| -------- | ----------- |
| `center` | `[0, 0, 0]` |
| `normal` | `[0, 1, 0]` |
| `radius` | `1`         |

### `csg`

A boolean combination of two solids.

| Key      | Meaning                                                                        |
| -------- | ------------------------------------------------------------------------------ |
| `op`     | `"union"`, `"subtract"` (a minus b) or `"intersect"`. Required.                |
| `a`, `b` | Solid objects: `sphere`, `cylinder`, `cone`, `box` or another `csg`. Required. |

The operands are not drawn separately; only the combined solid is. Make the cutting solid a little longer than the part it cuts through, so the hole opens cleanly on both faces.

### `mesh`

A triangle mesh, drawn by its boundary edges, sharp creases (`> 30°`) and silhouette.

| Key                     | Meaning                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `file`                  | Path to an `.obj` or `.stl` file (ASCII or binary STL). Geometry only: materials and textures are ignored with a warning. |
| `format`                | `"obj"` or `"stl"` when the file name does not tell.                                                                      |
| `vertices`, `triangles` | Inline mesh instead of `file`: a list of `[x, y, z]` and a list of `[i, j, k]` vertex indices.                            |
| `scale`                 | Uniform scale, default `1`.                                                                                               |
| `translate`             | Offset applied after scaling, default `[0, 0, 0]`.                                                                        |

Meshes hide and are hidden like any solid, but intersection curves are only computed between the analytic objects (not meshes).

## Curves

`lines` and `circles` are drawn with the same hidden-line removal as the solids: their hidden parts are dashed.

### `lines`

Either `from` and `to`, or `points` (a polyline of two or more points, add `"closed": true` to return to the first).

### `circles`

| Key                  | Default     | Meaning                                                              |
| -------------------- | ----------- | -------------------------------------------------------------------- |
| `center`             | required    |                                                                      |
| `normal`             | `[0, 1, 0]` | The circle lies in the plane through `center` perpendicular to this. |
| `radius`             | required    |                                                                      |
| `startDeg`, `endDeg` | `0`, `360`  | Draw an arc instead of a full circle.                                |

### `on`

A curve lying exactly on a surface (an equator on a sphere, a line along a face of a box, a section drawn on a plane) is hidden by that very surface because of rounding. List the object ids it lies on: `"on": ["ball"]`. The curve is then only hidden by other objects, and by the far side of its own object.

## Points and labels

Points and labels are drawn on top of the lines, after framing.

### `points`

| Key      | Default    | Meaning                                                                                                                                                     |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`     | required   | Position.                                                                                                                                                   |
| `label`  | none       | Text drawn next to the dot.                                                                                                                                 |
| `offset` | `[8, -10]` | Label position relative to the dot, in pixels (y points down). The text is left-aligned when `dx > 0`, right-aligned when `dx < 0`, centred when `dx` is 0. |
| `radius` | `2.5`      | Dot radius in pixels.                                                                                                                                       |
| `on`     | `[]`       | Ids of objects the point lies on (or inside, like a centre). Without them, a point on a surface may count as hidden.                                        |

A visible point is a filled dot. A hidden one (behind a surface) is a hollow, faint dot, matching the dashed lines.

### `labels`

Text without a dot.

| Key      | Default                         |
| -------- | ------------------------------- |
| `at`     | required                        |
| `text`   | required                        |
| `offset` | `[0, 0]`                        |
| `anchor` | `"middle"` (`"start"`, `"end"`) |

## Output

A single `<svg>` with `width`, `height` and a matching `viewBox`, a background `<rect>` (unless `background` is `false`), one `<path>` per visible or hidden chain (hidden ones carry `stroke-dasharray` and `opacity`), and a `<g class="hlr-annotations">` with the points and labels. All curves are cubic Béziers, so the file scales cleanly and edits well in Illustrator, Inkscape or Figma.
