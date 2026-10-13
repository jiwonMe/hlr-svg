import { anchorOf } from "./anchors";
import {
  add3,
  clean,
  cross3,
  dot3,
  frameOf,
  lerp3,
  normalize3,
  scale3,
  sub3,
  type Tuple3,
} from "./math";
import type { EditorObject, PointConstraint } from "./model";

/** A plane through `point` with unit `normal`. */
export type PlaneGeometry = { point: Tuple3; normal: Tuple3 };

/**
 * Positions of every point, following constraints in dependency order.
 * A constraint that cannot be evaluated (a cycle, parallel lines, a missing
 * object) falls back to the point's stored position.
 */
export function resolvePoints(objects: readonly EditorObject[]): Map<string, Tuple3> {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const resolved = new Map<string, Tuple3>();
  const visiting = new Set<string>();

  const point = (id: string): Tuple3 | null => {
    const known = resolved.get(id);
    if (known) return known;
    const object = byId.get(id);
    if (object?.kind !== "point") return null;
    if (visiting.has(id)) return object.position; // cycle: stop here
    visiting.add(id);
    const value = (object.constraint && evaluate(object.constraint)) || object.position;
    visiting.delete(id);
    resolved.set(id, value);
    return value;
  };

  const segmentEnds = (id: string): [Tuple3, Tuple3] | null => {
    const object = byId.get(id);
    if (object?.kind !== "segment") return null;
    const a = point(object.from);
    const b = point(object.to);
    return a && b ? [a, b] : null;
  };

  const planeOf = (id: string): PlaneGeometry | null => {
    const object = byId.get(id);
    if (object?.kind === "plane" || object?.kind === "disk")
      return { point: object.position, normal: frameOf(object.rotation).up };
    if (object?.kind === "face") {
      const corners = object.points.map(point).filter((p): p is Tuple3 => !!p);
      if (corners.length < 3) return null;
      const normal = normalize3(
        cross3(sub3(corners[1]!, corners[0]!), sub3(corners[2]!, corners[0]!)),
      );
      return normal[0] || normal[1] || normal[2] ? { point: corners[0]!, normal } : null;
    }
    return null;
  };

  const centerOf = (id: string): Tuple3 | null => {
    const object = byId.get(id);
    if (!object) return null;
    if ("position" in object) return object.position;
    if (object.kind === "segment") {
      const ends = segmentEnds(id);
      return ends ? lerp3(ends[0], ends[1], 0.5) : null;
    }
    if (object.kind === "face") {
      const corners = object.points.map(point).filter((p): p is Tuple3 => !!p);
      if (!corners.length) return null;
      return scale3(corners.reduce(add3), 1 / corners.length);
    }
    if (object.kind === "boolean") {
      const a = centerOf(object.a);
      const b = centerOf(object.b);
      return a && b ? lerp3(a, b, 0.5) : (a ?? b);
    }
    return null;
  };

  function evaluate(c: PointConstraint): Tuple3 | null {
    switch (c.type) {
      case "midpoint": {
        const a = point(c.a);
        const b = point(c.b);
        return a && b ? lerp3(a, b, 0.5) : null;
      }
      case "foot": {
        const p = point(c.point);
        if (!p) return null;
        const plane = planeOf(c.onto);
        if (plane) return footOnPlane(p, plane);
        const ends = segmentEnds(c.onto);
        return ends ? footOnLine(p, ends[0], ends[1]) : null;
      }
      case "intersection": {
        const ends = segmentEnds(c.line);
        const plane = planeOf(c.surface);
        return ends && plane ? linePlane(ends[0], ends[1], plane) : null;
      }
      case "onSegment": {
        const ends = segmentEnds(c.segment);
        return ends ? lerp3(ends[0], ends[1], Math.min(1, Math.max(0, c.t))) : null;
      }
      case "onSphere": {
        const sphere = byId.get(c.sphere);
        if (sphere?.kind !== "sphere") return null;
        return add3(sphere.position, scale3(sphereDirection(c.azimuth, c.elevation), sphere.radius));
      }
      case "onPlane": {
        const plane = byId.get(c.plane);
        if (plane?.kind !== "plane" && plane?.kind !== "disk") return null;
        const { right, forward } = frameOf(plane.rotation);
        return add3(plane.position, add3(scale3(right, c.u), scale3(forward, c.v)));
      }
      case "center":
        return centerOf(c.of);
      case "anchor": {
        const shape = byId.get(c.of);
        return (shape && anchorOf(shape, c.key)?.position) ?? null;
      }
    }
  }

  for (const object of objects) if (object.kind === "point") point(object.id);
  return resolved;
}

export function footOnPlane(p: Tuple3, plane: PlaneGeometry): Tuple3 {
  return sub3(p, scale3(plane.normal, dot3(sub3(p, plane.point), plane.normal)));
}

/** Foot on the infinite line through a and b. */
export function footOnLine(p: Tuple3, a: Tuple3, b: Tuple3): Tuple3 | null {
  const d = sub3(b, a);
  const len2 = dot3(d, d);
  if (len2 < 1e-18) return null;
  return add3(a, scale3(d, dot3(sub3(p, a), d) / len2));
}

/** Where the infinite line through a and b meets the plane, if it does. */
export function linePlane(a: Tuple3, b: Tuple3, plane: PlaneGeometry): Tuple3 | null {
  const d = sub3(b, a);
  const denom = dot3(d, plane.normal);
  if (Math.abs(denom) < 1e-12) return null;
  return add3(a, scale3(d, dot3(sub3(plane.point, a), plane.normal) / denom));
}

/** Unit direction for azimuth (about +Y, from +X toward +Z) and elevation, in degrees. */
export function sphereDirection(azimuth: number, elevation: number): Tuple3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
}

export function sphereAngles(direction: Tuple3): { azimuth: number; elevation: number } {
  const d = normalize3(direction);
  return {
    azimuth: clean((Math.atan2(d[2], d[0]) * 180) / Math.PI, 1e-9),
    elevation: clean((Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI, 1e-9),
  };
}

/** Angle at `vertex` between the rays toward `a` and `b`, in degrees. */
export function angleAt(vertex: Tuple3, a: Tuple3, b: Tuple3): number {
  const u = normalize3(sub3(a, vertex));
  const w = normalize3(sub3(b, vertex));
  return (Math.acos(Math.max(-1, Math.min(1, dot3(u, w)))) * 180) / Math.PI;
}

export const CONSTRAINT_NAMES: Record<PointConstraint["type"], string> = {
  midpoint: "중점",
  foot: "수선의 발",
  intersection: "교점",
  onSegment: "선분 위의 점",
  onSphere: "구 위의 점",
  onPlane: "평면 위의 점",
  center: "중심",
  anchor: "꼭짓점",
};

/** What a rule makes of its point, e.g. "밑면의 중심" or "원판 위의 점". */
export function constraintName(
  c: PointConstraint,
  byId: ReadonlyMap<string, EditorObject>,
): string {
  if (c.type === "anchor") {
    const shape = byId.get(c.of);
    return (shape && anchorOf(shape, c.key)?.name) ?? CONSTRAINT_NAMES.anchor;
  }
  if (c.type === "onPlane" && byId.get(c.plane)?.kind === "disk")
    return "원판 위의 점";
  return CONSTRAINT_NAMES[c.type];
}
