# curves (3D Cubic Bezier / Silhouettes / Arcs) Design Notes

This directory contains core utilities to satisfy the rule that "output must always be SVG cubic(C)".

Related files:
- `cubicBezier3.ts`: 3D cubic Bezier evaluation/splitting (de Casteljau)
- `builders.ts`: Builders that construct line segments/circles/silhouettes, etc. as cubic Bezier curves

## 1) Why unify everything as cubic(C)?

In SVG paths, `C` has the highest expressiveness (can represent both curves and lines),
and **cubic splitting (de Casteljau)** is stable when "splitting only visible segments" in HLR.

- Lines: Can represent lines as cubics by placing `p1, p2` along the line direction
- Circles/arcs: Can approximate 1/4 circle (90°) with one cubic (typically 4 for full circle)

## 2) CubicBezier3: de Casteljau evaluation/splitting

`cubicBezier3.ts` has two core functions:

### 2.1) eval(t)

For 3D control points `p0,p1,p2,p3`,
computes `P(t)` using de Casteljau (iterative lerp).

### 2.2) split(t)

Reuses intermediate points from the same de Casteljau process
to split one cubic into two: `[0..t]` (left) and `[t..1]` (right).

HLR repeatedly calls this split at transition points t* to create "partial dashed lines".

## 3) Circle/arc → cubic conversion (basic tool)

Typical method to represent one circle as 4 cubics:
- For 90° arc cubic approximation
  - kappa = 4/3 * tan(π/8) ≈ 0.5522847498
is used.

In this repo, 3D circles (center+normal+radius) are
unfolded to 2D basis (u,v) then lifted back to 3D to create cubics.

## 4) Silhouette curves

Silhouettes are curves corresponding to "visible/invisible boundaries",
one of the most important input curves in HLR.

### 4.1) Sphere silhouette

In perspective, a sphere's silhouette appears as a "circle" on screen,
and the center/radius vary with camera position (precisely, the cone tangency condition).

The code constructs the "exact perspective silhouette circle" and converts it to cubics.

### 4.2) Cylinder / Cone silhouette

For cylinders/cones, "generators" become silhouettes.

In perspective, calculating with only viewDir can have large errors,
so the geometry based on camera position and axis (or apex/axis)
is used to find the generator direction that becomes the silhouette.

> As a result, the silhouette curve itself is a "line segment cubic", but  
> with HLR (visibility splitting), **partial dashed lines** are accurately represented.

## 5) Practical tuning points

Even if silhouettes are "geometrically accurate", they can wobble in HLR.
Common causes:
- Raycast eps too small, causing frequent self-hits
- Sampling too coarse, missing transition points

Solutions are usually:
- Adjust eps strategy (snap/targetDist-eps) from `src/hlr/README.md`
- Increase `samples/refineIters`



