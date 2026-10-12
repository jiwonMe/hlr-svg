# Rendering performance — 2026-10-13

The optimized working tree reduces surface-buffer median CPU time by **2.20–5.18× at 720×520** and **2.14–4.98× at 320×231** against commit `42da7e5`. The 12 corresponding surface fixtures have identical ownership, Float32 depth and Float32 normals, byte for byte. The 144 checked lighting/selection combinations also produce identical RGBA bytes.

The small sphere–sphere orbit case does **not** improve: its median changes from 0.262 to 0.280 ms in orthographic projection and from 0.263 to 0.267 ms in perspective. Relighting results are mixed. These measurements describe CPU function calls, not browser frame rates.

## Method and runtime

- Baseline: actual built archive of commit `42da7e5dcba0aac2b12c068ea8b1ebfbd5c65141`; candidate: the uncommitted optimized working tree based on that commit.
- Both use the same `bench/render-performance.mjs` script, Node.js **v24.19.0**, V8 **13.6.233.17-node.51**, macOS **26.6.2** (build **25G83**), arm64. The CPU model was unavailable to the sandbox. Runs were sequential on the same host; CPU frequency and operating-system scheduling were not pinned.
- Six warm-up calls precede each metric. There are 24 measured calls per metric except surface720, which has 12. Median is the sorted sample at `floor(n / 2)`; p95 is at `min(n - 1, floor(n × 0.95))`. With 12 samples, the reported surface720 p95 is the largest observed call. Outliers are retained.
- Three two-object scenes are tested in orthographic and perspective projection. Fixtures and camera parameters are defined in the benchmark script; both use near 0.05, far 100, and aspect 720/520. The 320×231 buffer keeps that same camera aspect.
- `stationary` repeats the same camera. `orbit` cycles 24 camera poses separated by 0.013 radians. `style` changes visible stroke width at a fixed pose. Stationary/style results include warm geometry-cache reuse and should not be interpreted as cold-render costs.
- Surface measurements build fresh buffers. Lighting reuses a 720×520 buffer, varies light azimuth by 15 degrees, uses elevation 45 degrees and ambient 0.3, and has no selected object.

## HLR / SVG generation

All cells are **baseline median / p95 → candidate median / p95**, in milliseconds.

| Scene | Projection | Stationary | Orbit | Style |
| --- | --- | ---: | ---: | ---: |
| sphere-cylinder | orthographic | 7.761 / 8.817 → 0.012 / 0.038 | 7.519 / 8.534 → 1.747 / 2.044 | 7.885 / 8.503 → 0.012 / 0.014 |
| sphere-cylinder | perspective | 7.655 / 8.623 → 0.012 / 0.013 | 7.921 / 8.254 → 1.663 / 1.824 | 7.640 / 8.582 → 0.012 / 0.022 |
| cone-sphere | orthographic | 7.188 / 8.553 → 0.010 / 0.013 | 6.942 / 7.541 → 1.315 / 1.532 | 6.896 / 7.732 → 0.010 / 0.010 |
| cone-sphere | perspective | 6.947 / 7.617 → 0.010 / 0.044 | 7.025 / 8.011 → 1.404 / 1.537 | 7.016 / 7.714 → 0.011 / 0.019 |
| sphere-sphere | orthographic | 0.294 / 0.357 → 0.006 / 0.007 | 0.262 / 0.308 → 0.280 / 0.381 | 0.257 / 0.282 → 0.005 / 0.006 |
| sphere-sphere | perspective | 0.286 / 0.327 → 0.006 / 0.010 | 0.263 / 0.320 → 0.267 / 0.366 | 0.244 / 0.368 → 0.006 / 0.008 |

Curved-pair orbit medians improve by 4.30–5.28×. Sphere–sphere orbit medians are 6.9% and 1.5% slower, respectively; its p95 also increases from 0.308 to 0.381 ms and 0.320 to 0.366 ms. The absolute costs are small, and this run establishes no orbit gain for that scene.

## Surface buffers and cached lighting

All cells are **baseline median / p95 → candidate median / p95**, in milliseconds.

| Scene | Projection | 720×520 surface | 320×231 surface | Cached lighting |
| --- | --- | ---: | ---: | ---: |
| sphere-cylinder | orthographic | 48.589 / 49.623 → 9.384 / 19.789 | 9.804 / 10.159 → 1.969 / 2.144 | 0.644 / 0.712 → 0.693 / 0.765 |
| sphere-cylinder | perspective | 60.985 / 61.673 → 16.276 / 23.813 | 12.212 / 13.011 → 3.362 / 3.622 | 0.654 / 0.860 → 0.717 / 0.801 |
| cone-sphere | orthographic | 45.782 / 46.577 → 12.769 / 18.656 | 8.992 / 9.452 → 2.582 / 2.750 | 0.678 / 0.906 → 0.688 / 0.834 |
| cone-sphere | perspective | 50.877 / 52.705 → 20.523 / 22.237 | 10.036 / 10.896 → 3.997 / 4.394 | 0.640 / 0.807 → 0.629 / 0.824 |
| sphere-sphere | orthographic | 27.209 / 28.237 → 9.409 / 9.944 | 5.233 / 5.733 → 1.921 / 2.062 | 0.683 / 0.810 → 0.684 / 0.746 |
| sphere-sphere | perspective | 33.120 / 33.814 → 15.085 / 16.142 | 6.567 / 7.045 → 3.063 / 3.442 | 0.743 / 0.853 → 0.704 / 0.801 |

All six surface medians improve, while the perspective cone–sphere case remains the slowest at 20.523 ms for 720×520. Lighting takes 0.629–0.717 ms. Compared with the original baseline, two sphere–cylinder lighting medians increase from 0.644/0.654 to 0.693/0.717 ms; cone–sphere orthographic and sphere–sphere orthographic are nearly unchanged, and the remaining two decrease. The optimization therefore does not establish a general relighting speedup.

## Accuracy and compatibility checks

The actual baseline archive and candidate were loaded independently, and each constructed its own instances of the three benchmark scenes. At both resolutions and both projections (**12 fixtures**), differing owner/depth/normal bytes were **0**, with maximum numeric differences **0**. Across two light azimuths, two ambient values and three selections (none, first object, missing object), all **144 RGBA comparisons** had **0 differing bytes**. This is fixture equivalence, not a proof for every possible input.

`node --test test/surface-rendering.test.mjs test/surface-kernels.test.mjs` passes **30/30 tests**. These compare optimized results against an independent pixel-by-pixel oracle using public `camera.screenToRay` and primitive `intersect` methods. Coverage includes near/far clipping, interior and cap hits, tangencies, nearest ownership when objects intersect, reversed object order, coincident first-owner ties, unit normals, holes/disconnected clipping regions, and lighting/selection bytes.

Compatibility regressions cover custom camera instance/prototype overrides; primitive subclasses and instance/prototype intersection overrides; mutated non-unit axes and non-orthonormal plane frames; mutable camera position/forward and inconsistent projection/inverse matrices; custom primitive call ordering and shared ray identity; and built-in triangle-mesh fallback. Native acceleration uses guarded built-in methods, while custom implementations retain the original pixel-first traversal. Camera consistency failures disable projected bounds. Mutable invalid frames use the public primitive intersection path without bounds.

Object clip paths remain regions traced from the pixel ownership buffer. Their boundary precision is set by buffer resolution; these results do not imply analytically exact vector contours. Full-project checks and browser interaction/export checks are separate from this CPU benchmark.

## What changes the cost

Prepared scalar primitive kernels and scalar camera rays remove repeated matrix-unprojection objects and most per-hit allocations. Conservative screen bounds reduce unnecessary casts. Dense overlapping native perspective scenes generate each candidate pixel ray once and write its winner once; sparse and disjoint scenes keep bounded per-primitive traversal. The dense branch avoids the extra Float64 closest-distance image. A trial 9.4 MB ray cache at 720×520 was removed because its measured benefit did not justify the allocation. Relighting continues to reuse cached normals and ownership, and fixed geometry can reuse HLR/intersection results.

## Production asset snapshot

The final production build, including the new sphere/plane example, reports an entry JavaScript chunk of **184.19 kB** (**60.51 kB gzip**), compared with the earlier baseline entry of approximately **344 kB**. It measures one entry chunk; asynchronous chunks, CSS, fonts and total downloaded bytes are excluded. Code splitting moves code into other chunks, so this should not be presented as a 46% reduction in total application bytes or as a runtime/FPS improvement. `pnpm check` and all **104** library tests pass with the new example included.

## Reproduce

Build each checkout independently, then point the same script at the baseline checkout. Use the same Node version and run sequentially on an otherwise idle host:

```sh
pnpm build
node bench/render-performance.mjs > candidate.json
node bench/render-performance.mjs /path/to/built-42da7e5-checkout > baseline.json
node --test test/surface-rendering.test.mjs test/surface-kernels.test.mjs
```

The checked-in `bench/results/2026-10-13.json` records baseline and candidate medians/p95s, derived ratios, runtime/method metadata and the accuracy comparison. The script measures synchronous library calls only: React scheduling, canvas encoding, SVG export/clipping generation, browser layout, GPU work and network transfer are excluded. A single local microbenchmark run cannot establish end-to-end frame rate or cross-device performance.
