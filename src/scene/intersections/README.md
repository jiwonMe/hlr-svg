# intersections (Intersection Curves) Design Notes

This directory contains modules for creating **intersection curves** that occur when different primitives overlap,
and outputting them as **cubic Bezier curves**.

Intersection curves are rendered as "solid/dashed lines" in combination with HLR/HCR.

Related files:
- `intersectionCurves.ts`: Intersection curve generation orchestration (scans all primitive pairs)
- `pairs.ts`: Surface×surface intersections (sphere/cylinder/cone combinations)
- `planeSurfaceCurves.ts`: Plane (PlaneRect/Disk) × surface intersections
- `capDisks.ts`: Derives caps (rims) as Disks and handles Disk×Disk (markers for coplanar cases)
- `diskPlaneRect.ts`: Disk (rim) × PlaneRect intersections
- `planeRectBoxAabb.ts`: PlaneRect × BoxAabb intersections
- `boxBoxAabb.ts`: BoxAabb × BoxAabb intersections (face×face approach)
- `bezierFit.ts`: polyline → cubic Bezier fitting (based on Schneider's algorithm)
- `math.ts`: Utilities for quadratic equations, axis basis, branch sorting, jump splitting, etc.

## 1) Why "OwnedIntersectionCubic3" is needed

Intersection curves typically exist **on the surfaces of the two intersecting primitives**.
When HLR raycasting checks intersection curve points,
"nearby hits" from the intersection's "participating primitives"
can be mistaken for occlusion, causing solid lines to become dashed.

To solve this, intersection curves are created not just as `CubicBezier3[]`, but also as:

```ts
{ bez: CubicBezier3; ignorePrimitiveIds: readonly string[] }
```

(`intersectionCurvesToOwnedCubics`).

In the HLR stage, this `ignorePrimitiveIds` is passed to `Scene.visibleAtPoint` to
**only mitigate "hits very close to the intersection curve"**.

> Ignoring entire primitives would also release true self-occlusion, so  
> it's important to use this together with the "nearby hit" condition. (See `src/hlr/README.md`)

## 2) Surface×surface intersections: angular parameterization + equation solving

Examples: Cylinder×Cylinder, Cylinder×Cone, Cone×Cone, etc.
One surface is parameterized by angle θ, and the other constraint is solved
to find the solution (height/length) for a given θ, sampling points this way.

Results are generated as polylines (point sequences):
- Intersection curves can have two branches, so branches are accumulated separately
- If there are discontinuities (jumps), runs are split (`splitRunsByJump`)

## 3) Plane×surface intersections

For planes like PlaneRect/Disk:
- Sphere: intersection is a circle (or a point)
- Cylinder/Cone: sample θ and determine height using the plane equation

For finite regions like Disk/PlaneRect:
- After sampling, clip to inside (region inclusion) to create runs
- Convert to cubics via fitting

## 4) Disk (rim) related

Caps (rims) of cylinders/cones are derived as Disks for intersection calculations.
This enables:
- Disk×Disk: clip the intersection line of two planes to each circle → line segments
- Coplanar Disk×Disk: find intersection points (0/1/2) and output as **markers (cross line segments)**

## 5) PlaneRect×BoxAabb, BoxAabb×BoxAabb

### 5.1) PlaneRect×BoxAabb

Intersect the box's 12 edges with the plane to collect intersection points.
Then:
- Sort points and connect them like a polygon (or line segments)
- Clip to PlaneRect's (u,v) bounds
- Output as line segment cubics

Since "box edges can be coplanar with the plane",
coplanar edges are clipped separately and output.

### 5.2) BoxAabb×BoxAabb

Convert each box to 6 face PlaneRects, then
compute all face×face (PlaneRect×PlaneRect) intersections.

Advantages:
- Simple implementation and high reusability (reuses PlaneRect×PlaneRect)
Disadvantages:
- Duplicate segments may occur, so deduplication may be needed later

## 6) polyline → cubic Bezier fitting

Since intersection curves are often obtained as point sequences,
for "dashed line representation" the final output must be
**cubic Bezier curves**, not line segments.

`bezierFit.ts` is based on Schneider's fitting algorithm:
- chord-length parameterization
- Estimate handle length (alpha) via least squares
- Improve error via Newton reparameterization
- Recursive splitting if error is large

To reduce practical issues (overshoot/jumping curves):
- Clamp handle length based on segment length
- Stabilize endpoint tangents by averaging multiple points

## 7) Tuning guide

If intersection curves are unstable or visibility is unstable, there are usually two causes:

- **Intersection curve sampling quality issues**: N (angular samples), denominator threshold, inside determination, etc.
- **Fitting error issues**: `maxError` is too large, causing leakage inside/outside the surface

Solutions are usually:
- Increase samples + strengthen jump splitting
- Reduce `maxError` to better follow the surface
- Tune HLR eps/snap (prevent nearby hit misinterpretation)



