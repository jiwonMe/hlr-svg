export const EPS = 1e-9;

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function almostEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

export function dedupeSorted(nums: number[], eps = 1e-7): number[] {
  if (nums.length === 0) return [];
  const out: number[] = [nums[0]!];
  for (let i = 1; i < nums.length; i++) {
    const v = nums[i]!;
    if (Math.abs(v - out[out.length - 1]!) > eps) out.push(v);
  }
  return out;
}


