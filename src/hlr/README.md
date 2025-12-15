# HLR/HCR (Hidden Line Removal / Hidden Curve Removal) Design Notes

This directory contains logic for determining **which segments are visible (HLR/HCR)**,
not for "drawing" 3D curves to 2D, but for **splitting Bezier curves only at visibility transition points**.

Related files:
- `visibilityCuts.ts`: Finds "visibility transition t" on cubic
- `splitByVisibility.ts`: Splits cubic at transition t and returns `{ bez, visible }` pieces

## 1) Core idea: point-wise visibility + curve splitting

Instead of "the entire curve is visible/not visible",
we repeatedly determine whether **a specific point P(t) on the curve is visible from the camera**.

1. Sample multiple t values on the cubic
2. If `visible(t_i)` and `visible(t_{i+1})` differ, assume there's a transition point in that interval
3. Refine that interval via bisection to find `t*`
4. Split the cubic at `t*` (de Casteljau)

Advantages of this approach:
- Can accurately represent **partial dashed lines** even for "long curves" like silhouettes/arcs/intersections
- Maintains curve quality (Bezier) while **only segmenting visible portions**

## 2) visibleAtPoint: raycast-based visibility determination

`Scene.visibleAtPoint(P)` basically does the following:

- Perspective: Cast a ray from camera position O toward P
  - If there's a hit up to "slightly before" P (`tMax = |OP| - eps`), P is occluded
- Orthographic (not currently used in web): Parallel ray in viewDir direction

### 2.1) Why `tMax = targetDist - eps`?

When P is exactly on some surface, raycasting often hits "itself" again.
Such self-hits are **numerical errors**, not occlusion,
so we check only "slightly before" the target point, not including it.

### 2.2) Why only mitigate self-hits near intersection curves

Points on intersection curves (curves that are the intersection of two surfaces) belong to both primitive surfaces simultaneously.
When a hit occurs "very close to the intersection curve" in the visibility ray,
it's mostly noise from intersection/tangent/float errors.

Conversely, when "distant self-surfaces" block the ray, it's real self-occlusion
and should not be ignored.

So currently:
- Only when hit.point is sufficiently close to worldPoint (snap)
- And only when the hit comes from a primitive participating in the intersection
  - Treat as "noise hit" and mark as visible

> This design is a compromise to reduce cases where "solid lines flip to dashed at intersections"  
> while maintaining true self-occlusion (where self-surfaces occlude).

## 3) Sampling/epsilon parameter guide

`visibilityCuts.ts` / `splitByVisibility.ts` parameters:
- `samples`: Number of samples. Increasing stabilizes transition detection but slows down
- `refineIters`: Bisection iterations. Too large increases cost↑, too small causes cuts to wobble
- `epsVisible`: Internal eps scale in visibleAtPoint (affects scene scale)
- `cutEps`: Transition point deduplication/boundary filter
- `minSegLenSq`: Remove overly short pieces (noise prevention)

Recommended direction:
- For "short and complex" curves, it's safer to increase `samples` and `minSegLenSq`
- For cases like intersections where "fitting errors" may exist, tune `epsVisible` and snap criteria

## 4) Extension tips

This approach requires almost no changes to HLR when adding primitives.
When creating new curves (silhouettes/intersections/edges),
just express them as cubics and pass them to `splitCubicByVisibility*`.



