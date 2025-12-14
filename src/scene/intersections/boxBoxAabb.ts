import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { Vec3 } from "../../math/vec3.js";
import { BoxAabb } from "../primitives/boxAabb.js";
import { PlaneRect } from "../primitives/planeRect.js";
import { intersectPlaneRectPlaneRect } from "./pairsPlane.js";

export function intersectBoxAabbBoxAabb(a: BoxAabb, b: BoxAabb): CubicBezier3[] {
  const fa = boxFacesAsPlaneRects(a, "A");
  const fb = boxFacesAsPlaneRects(b, "B");

  const out: CubicBezier3[] = [];
  for (const pa of fa) {
    for (const pb of fb) {
      out.push(...intersectPlaneRectPlaneRect(pa, pb));
    }
  }
  return out;
}

function boxFacesAsPlaneRects(b: BoxAabb, tag: string): PlaneRect[] {
  const x0 = b.min.x, y0 = b.min.y, z0 = b.min.z;
  const x1 = b.max.x, y1 = b.max.y, z1 = b.max.z;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const hx = (x1 - x0) / 2;
  const hy = (y1 - y0) / 2;
  const hz = (z1 - z0) / 2;

  // 각 face는 PlaneRect로 모델링한다.
  // - x face: in-plane axes are (y,z)
  // - y face: in-plane axes are (x,z)
  // - z face: in-plane axes are (x,y)
  return [
    // +X
    new PlaneRect(`${b.id}:${tag}:face:+x`, new Vec3(x1, cy, cz), new Vec3(1, 0, 0), new Vec3(0, 0, 1), hz, hy),
    // -X
    new PlaneRect(`${b.id}:${tag}:face:-x`, new Vec3(x0, cy, cz), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), hz, hy),
    // +Y
    new PlaneRect(`${b.id}:${tag}:face:+y`, new Vec3(cx, y1, cz), new Vec3(0, 1, 0), new Vec3(1, 0, 0), hx, hz),
    // -Y
    new PlaneRect(`${b.id}:${tag}:face:-y`, new Vec3(cx, y0, cz), new Vec3(0, -1, 0), new Vec3(1, 0, 0), hx, hz),
    // +Z
    new PlaneRect(`${b.id}:${tag}:face:+z`, new Vec3(cx, cy, z1), new Vec3(0, 0, 1), new Vec3(1, 0, 0), hx, hy),
    // -Z
    new PlaneRect(`${b.id}:${tag}:face:-z`, new Vec3(cx, cy, z0), new Vec3(0, 0, -1), new Vec3(1, 0, 0), hx, hy),
  ];
}


