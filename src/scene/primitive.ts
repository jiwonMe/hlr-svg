import type { Hit, Ray } from "./ray.js";

export interface Primitive {
  readonly id: string;
  intersect(ray: Ray, tMin: number, tMax: number): Hit | null;
}


