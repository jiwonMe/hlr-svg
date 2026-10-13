# Recipes

Scenes for figures that come up again and again, and fixes for the problems you are likely to meet. Every JSON block here renders as it is (the test suite checks that), so copy one and change it.

## Polyhedra: a square pyramid

There is no pyramid or prism primitive. Build any flat-faced solid as an inline `mesh`: list its corners, then its faces as triangles (split a quadrilateral into two). Edges between faces that meet at more than 30° are drawn; the diagonal that splits a flat face is not.

```json
{
  "title": "Square pyramid O-ABCD",
  "width": 560,
  "height": 480,
  "camera": { "azimuth": 30, "elevation": 18 },
  "objects": [
    {
      "type": "mesh",
      "id": "pyramid",
      "vertices": [
        [-1, 0, -1],
        [1, 0, -1],
        [1, 0, 1],
        [-1, 0, 1],
        [0, 1.6, 0]
      ],
      "triangles": [
        [0, 1, 2],
        [0, 2, 3],
        [0, 4, 1],
        [1, 4, 2],
        [2, 4, 3],
        [3, 4, 0]
      ]
    }
  ],
  "lines": [{ "from": [0, 1.6, 0], "to": [0, 0, 0] }],
  "points": [
    { "at": [0, 1.6, 0], "label": "O", "offset": [0, -14], "on": ["pyramid"] },
    { "at": [-1, 0, 1], "label": "A", "offset": [-12, 10], "on": ["pyramid"] },
    { "at": [1, 0, 1], "label": "B", "offset": [10, 12], "on": ["pyramid"] },
    { "at": [1, 0, -1], "label": "C", "offset": [12, 0], "on": ["pyramid"] },
    { "at": [-1, 0, -1], "label": "D", "offset": [-12, -6], "on": ["pyramid"] },
    { "at": [0, 0, 0], "label": "H", "offset": [10, 8], "on": ["pyramid"] }
  ]
}
```

The height OH runs inside the solid, so it comes out dashed by itself. A triangular prism is the same idea with six vertices and eight triangles.

## A solid inside another: inscribed sphere

Solids are opaque, so anything inside another solid is drawn entirely dashed. That is what a textbook shows for an inscribed sphere.

```json
{
  "title": "Sphere inscribed in a cube",
  "width": 520,
  "height": 480,
  "camera": { "azimuth": 35, "elevation": 22 },
  "objects": [
    { "type": "box", "id": "cube", "center": [0, 0, 0], "size": [2, 2, 2] },
    { "type": "sphere", "id": "ball", "center": [0, 0, 0], "radius": 1 }
  ],
  "points": [{ "at": [0, 0, 0], "label": "O", "on": ["cube", "ball"] }]
}
```

The six small crosses mark where the sphere touches the faces: the library marks every exact tangency between a sphere and a flat face (a plane, disk or box face). To leave them out, make the sphere a hair smaller, `"radius": 0.999999`.

To show the inner solid in solid lines, make the outer one open instead: use `plane`s for some faces, or a `cylinder` with `"caps": "none"`.

## Tangent spheres on a floor

```json
{
  "title": "Two tangent spheres on a plane",
  "width": 640,
  "height": 400,
  "camera": { "azimuth": 15, "elevation": 20 },
  "objects": [
    { "type": "sphere", "id": "big", "center": [-0.6, 1, 0], "radius": 1 },
    {
      "type": "sphere",
      "id": "small",
      "center": [0.814, 0.5, 0],
      "radius": 0.5
    },
    {
      "type": "plane",
      "id": "floor",
      "center": [0, 0, 0],
      "normal": [0, 1, 0],
      "width": 4.4,
      "height": 3
    }
  ],
  "lines": [{ "from": [-0.6, 1, 0], "to": [0.814, 0.5, 0] }],
  "points": [
    { "at": [-0.6, 1, 0], "label": "P", "on": ["big"] },
    { "at": [0.814, 0.5, 0], "label": "Q", "on": ["small"] }
  ]
}
```

For two spheres to touch, the distance between the centres must equal the sum of the radii, and each sphere resting on the floor needs `center.y = radius`. Work the numbers out before rendering. Here the centres differ by 0.5 in height, so for `|PQ| = 1 + 0.5` they are √(1.5² − 0.5²) = √2 ≈ 1.414 apart across the floor.

## A section of a cube

Draw a cut through a solid as a closed polyline lying on its faces, with `on` so the faces do not hide it. Each corner of the section must lie on an edge of the solid.

```json
{
  "title": "Section of a cube through three edge midpoints",
  "width": 520,
  "height": 480,
  "camera": { "azimuth": 35, "elevation": 24 },
  "objects": [
    { "type": "box", "id": "cube", "min": [0, 0, 0], "max": [2, 2, 2] }
  ],
  "lines": [
    {
      "points": [
        [2, 1, 2],
        [1, 2, 2],
        [2, 2, 1]
      ],
      "closed": true,
      "on": ["cube"]
    }
  ],
  "points": [
    { "at": [2, 1, 2], "label": "P", "offset": [10, 6], "on": ["cube"] },
    { "at": [1, 2, 2], "label": "Q", "offset": [-6, 14], "on": ["cube"] },
    { "at": [2, 2, 1], "label": "R", "offset": [10, -8], "on": ["cube"] }
  ]
}
```

## A plane cutting a cylinder

Where a `plane` crosses a solid, the intersection curve (here an ellipse) is computed for you.

```json
{
  "title": "An oblique plane cutting a cylinder",
  "width": 520,
  "height": 560,
  "camera": { "azimuth": 30, "elevation": 20 },
  "objects": [
    {
      "type": "cylinder",
      "id": "tube",
      "base": [0, 0, 0],
      "axis": [0, 1, 0],
      "height": 2.4,
      "radius": 0.8
    },
    {
      "type": "plane",
      "id": "cut",
      "center": [0, 1.2, 0],
      "normal": [0.5, 1, 0],
      "width": 2.6,
      "height": 2.2
    }
  ]
}
```

## Coordinate axes

Axes are `lines` with `labels` at their ends. They are hidden where they pass behind or through a solid, which reads correctly.

```json
{
  "title": "Unit sphere with coordinate axes",
  "width": 520,
  "height": 480,
  "camera": { "azimuth": 35, "elevation": 20 },
  "objects": [{ "type": "sphere", "id": "s", "radius": 1 }],
  "lines": [
    { "from": [0, 0, 0], "to": [1.8, 0, 0] },
    { "from": [0, 0, 0], "to": [0, 1.6, 0] },
    { "from": [0, 0, 0], "to": [0, 0, 1.8] }
  ],
  "labels": [
    { "at": [1.8, 0, 0], "text": "x", "offset": [10, 4] },
    { "at": [0, 1.6, 0], "text": "y", "offset": [0, -12] },
    { "at": [0, 0, 1.8], "text": "z", "offset": [-10, 8] }
  ],
  "points": [
    { "at": [0, 0, 0], "label": "O", "offset": [-12, 10], "on": ["s"] }
  ]
}
```

The world is y-up. For a z-up figure (common in maths), keep the solids in y-up coordinates and label the vertical axis `z`, or set `"up": [0, 0, 1]` in the camera and give a `direction` such as `[1.2, 1, 0.8]`.

## Matching a set of figures

Automatic framing scales each figure to fill its frame, so two figures of different solids end up at different scales. For a set:

- give every scene the same `width`, `height`, `style` and camera angles;
- set `"halfHeight"` (orthographic) to the same value in each, large enough for the biggest figure;
- set `"target"` to the point that should sit in the middle.

## Problems and fixes

| Symptom                                                                                   | Cause                                                                   | Fix                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A circle or line on a surface is dashed all the way, or flickers between solid and dashed | The surface it lies on hides it                                         | Add `"on": ["<surface id>"]`                                                                |
| A point on a surface is drawn hollow although it faces the camera                         | Same                                                                    | Add `"on": [...]` to the point                                                              |
| Two edges lie on top of each other                                                        | The view looks straight along a face                                    | Change `azimuth` or `elevation` by 10° or more; avoid `front`, `top` and `right` for solids |
| A label sits on a line                                                                    | Default offset points into the figure                                   | Set `offset` away from the lines, outward                                                   |
| The drawing is small with lots of empty space                                             | A large `plane` or a far `label` widens the frame                       | Shrink the plane, or set `zoom` / `halfHeight`                                              |
| The CSG hole does not open on a face                                                      | The cutter ends exactly on the face                                     | Make the cutting solid longer than the part                                                 |
| A curve is missing where two solids meet                                                  | Meshes do not get intersection curves                                   | Use analytic objects for solids whose intersection matters                                  |
| A small cross where a sphere rests on a plane or touches a box face                       | Exact tangencies are marked on purpose                                  | Keep it as the contact point, or shrink the sphere by a millionth of its radius             |
| Everything is dashed                                                                      | A large solid (often a `box` used as a floor) is in front of everything | Use a `plane` for a floor, or move the camera                                               |
