# Performance Notes (Profiling & HLR Optimizations)

This document describes the profiling hooks and the recent optimization work focused on HLR (Hidden Line Removal) visibility splitting.

## Summary

The main bottleneck was **visibility splitting** (`render.visibilitySplit`), dominated by repeated `Scene.visibleAtPoint()` calls, which in turn repeatedly ran `Scene.raycastClosest()` and `primitive.intersect()` across primitives.

We added a lightweight profiler, surfaced it in the web demo, and introduced a **two-stage visibility sampling** option (`coarseSamples`) to reduce the number of expensive visibility/raycast queries.

## Profiling: What Was Added

### Core profiler utility

File: `src/core/profiler.ts`

- `createProfiler()` creates an in-memory profiler that supports:
  - **counters** (`inc(name)`)
  - **timers** (`begin(name)` / `end(name)`)
  - a stable time source (`performance.now()` when available)
- `formatProfileReport(report)` returns a readable multi-line string.

Exported via `src/index.ts`.

### Instrumentation points

File: `src/scene/scene.ts`

- `Scene.visibleAtPoint()`:
  - `counts.visibleAtPoint.calls`
  - `ms.visibleAtPoint.ms`
- `Scene.raycastClosest()`:
  - `counts.raycastClosest.calls`
  - `ms.raycastClosest.ms`
  - `counts.primitive.intersect.calls` (one per primitive intersection attempt)

File: `src/core/svgRenderer.ts`

`SvgRenderer.render()` wraps major phases:

- `render.total`
- `render.curvesFromPrimitives`
- `render.intersections`
- `render.visibilitySplit`
- `render.svgWrite`

### Web demo: Profile toggle

File: `web/src/Viewer.tsx`

- Added a **Profile** button per case card.
- When enabled, it uses `renderCaseToSvgStringProfiled()` and shows:
  - an on-card report
  - a console log: `[hlr-svg profile] <caseName> ...`

## How to Use Profiling

### Run the web demo

```bash
npm run build
npm run web:dev
```

### Read the report

Typical high-signal fields:

- `render.visibilitySplit`:
  - time spent splitting curves into visible/hidden segments (HLR/HCR).
- `visibleAtPoint.calls`:
  - number of visibility queries (this drives runtime).
- `primitive.intersect.calls`:
  - how many primitive-ray intersection checks ran in total.

If `render.visibilitySplit` dominates and `visibleAtPoint.calls` is high, your best wins are usually:
1) **reduce visibility query count**, then
2) reduce work inside each query (broad-phase acceleration like BVH), then
3) consider WASM/Rust (prefer batching).

## HLR Optimization: Removing Per-Piece Raycasts

Files:

- `src/hlr/visibilityCuts.ts`
- `src/hlr/splitByVisibility.ts`

We refactored visibility-cut computation to expose segment visibility directly:

- `findVisibilityCutsOnCubicWithVisibility(...)` returns:
  - `cuts: number[]` (sorted visibility transition parameters)
  - `segmentVisible: boolean[]` (length `cuts.length + 1`)

Then `splitCubicByVisibilityWithIgnore(...)` uses `segmentVisible[i]` for each produced segment, instead of recomputing visibility per segment.

Note: In practice, overall speedups were dominated by sample-count changes (see below), because the bulk of calls comes from sampling (`samples`) itself.

## HLR Optimization: Two-Stage Sampling (`coarseSamples`)

File: `src/hlr/visibilityCuts.ts`

### Motivation

Even after removing per-piece visibility checks, the majority of `visibleAtPoint()` calls were coming from the fixed-resolution sampling loop:

- For each cubic, the algorithm samples `samples + 1` points to detect transitions.

### Approach

We added `VisibilityParams.coarseSamples?: number`:

- If `coarseSamples >= 2`:
  1) Run a cheap coarse sampling pass at `coarseSamples`.
  2) If no visibility transitions are detected, **skip the expensive full `samples` pass** and treat the cubic as constant visibility.
  3) If transitions exist, proceed with the normal high-resolution pass (`samples`) and bisection refinement.

### Tradeoff

`coarseSamples` can miss extremely thin visibility changes smaller than a coarse step.

Recommended:

- `0`: maximum fidelity (disabled)
- `48 / 64 / 96`: “fast mode” presets depending on how much you can trade fidelity for speed

## Web UI: Coarse preset slider (0/48/64/96)

Files:

- `src/demo/renderCase.ts`
- `web/src/Viewer.tsx`

Changes:

- `renderCaseToSvgString()` now accepts `opts.hlr?: Partial<HlrParams>`.
- The web demo adds a per-case `coarse` slider with presets:
  - `0, 48, 64, 96`
  and passes `{ hlr: { coarseSamples } }` into the renderer.

This enables case-by-case speed/quality comparisons.

## Notes / Next Steps (If Needed)

If HLR is still the bottleneck after reducing query count:

- **Broad-phase acceleration** (BVH / grid) in `Scene.raycastClosest()` can reduce `primitive.intersect.calls`.
- Consider **batch-oriented WASM** if moving to Rust:
  - Avoid calling into WASM per point (`visibleAtPoint` per sample).
  - Prefer batching entire curve visibility splitting inside WASM and returning compact arrays.


