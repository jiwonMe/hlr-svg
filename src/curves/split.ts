import type { Vec3 } from "../math/vec3.js";
import { evalCubic3, splitCubic3, type CubicBezier3 } from "./cubicBezier3.js";

/** The part of a cubic between parameters t0 < t1, as its own cubic. */
export function subCubic3(
  b: CubicBezier3,
  t0: number,
  t1: number,
): CubicBezier3 {
  if (t0 <= 0 && t1 >= 1) return b;
  const left = t1 >= 1 ? b : splitCubic3(b, t1).left;
  if (t0 <= 0) return left;
  return splitCubic3(left, t0 / t1).right;
}

/**
 * The pieces of a cubic where `keep` holds. Samples locate each change and
 * bisection refines it, so pieces end where the predicate actually flips.
 */
export function splitCubicWhere(
  b: CubicBezier3,
  keep: (p: Vec3) => boolean,
  samples = 24,
  refineSteps = 14,
): CubicBezier3[] {
  const flags: boolean[] = [];
  for (let i = 0; i <= samples; i++)
    flags.push(keep(evalCubic3(b, i / samples)));
  if (flags.every(Boolean)) return [b];
  if (!flags.some(Boolean)) return [];

  // Bisect a change and return the end that lies on the kept side.
  const edge = (lo: number, hi: number, loValue: boolean) => {
    for (let i = 0; i < refineSteps; i++) {
      const mid = (lo + hi) / 2;
      if (keep(evalCubic3(b, mid)) === loValue) lo = mid;
      else hi = mid;
    }
    return loValue ? lo : hi;
  };

  const pieces: CubicBezier3[] = [];
  let start: number | null = flags[0] ? 0 : null;
  for (let i = 1; i <= samples; i++) {
    if (flags[i] === flags[i - 1]) continue;
    const t = edge((i - 1) / samples, i / samples, flags[i - 1]!);
    if (flags[i - 1]) {
      if (start !== null && t - start > 1e-4)
        pieces.push(subCubic3(b, start, t));
      start = null;
    } else start = t;
  }
  if (start !== null && 1 - start > 1e-4) pieces.push(subCubic3(b, start, 1));
  return pieces;
}
