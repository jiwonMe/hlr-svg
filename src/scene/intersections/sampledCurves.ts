import type { CubicBezier3 } from "../../curves/cubicBezier3.js";
import { evalCubic3 } from "../../curves/cubicBezier3.js";
import { lineToCubic3 } from "../../curves/builders.js";
import { Vec3 } from "../../math/vec3.js";
import { fitPolylineToCubics } from "./bezierFit.js";
import { quadraticTrigRoots, solveQuadratic } from "./math.js";

export type AngularQuadratic = { a: number; b: number; c: number };

type TraceOptions = {
  samples: number;
  maxParameter: number;
  equation: (theta: number) => AngularQuadratic;
  pointAt: (theta: number, parameter: number) => Vec3;
  inside: (point: Vec3) => boolean;
  boundaryEquations?: readonly ((theta: number) => number)[];
  surfaceError: (point: Vec3) => number;
  tolerance: number;
  useBezierFit: boolean;
};

/**
 * Trace quadratic roots only over intervals where their topology is constant.
 * Root births and finite-surface boundaries are solved before sampling: a small
 * intersection can therefore survive even when it lies between angular samples.
 */
export function traceQuadraticIntersection(
  options: TraceOptions,
): CubicBezier3[] {
  const { equation, maxParameter, tolerance } = options;
  if (!(maxParameter > 0)) return [];
  const tau = 2 * Math.PI;
  const criticalEquations = [
    (theta: number) => {
      const { a, b, c } = equation(theta);
      return b * b - 4 * a * c;
    },
    (theta: number) => equation(theta).a,
    (theta: number) => equation(theta).c,
    (theta: number) => {
      const { a, b, c } = equation(theta);
      return a * maxParameter * maxParameter + b * maxParameter + c;
    },
    ...(options.boundaryEquations ?? []),
  ];
  const eventCandidates = [
    { theta: 0, doubleRoot: false },
    ...criticalEquations.flatMap((valueAt, index) =>
      quadraticTrigRoots(valueAt).map((theta) => ({
        theta,
        doubleRoot: index === 0,
      })),
    ),
    { theta: tau, doubleRoot: false },
  ].sort((a, b) => a.theta - b.theta);
  const events: { theta: number; doubleRoot: boolean }[] = [];
  for (const candidate of eventCandidates) {
    const previous = events[events.length - 1];
    if (!previous || candidate.theta - previous.theta > 1e-12)
      events.push(candidate);
    else if (candidate.doubleRoot) {
      previous.doubleRoot = true;
      if (previous.theta !== 0) previous.theta = candidate.theta;
    }
  }
  if (events[events.length - 1]!.theta < tau)
    events.push({ theta: tau, doubleRoot: false });

  // Solve in a dimensionless parameter to keep coefficient tolerances invariant
  // under uniform changes to the scale of the scene.
  const rootsAt = (theta: number) => {
    const { a, b, c } = equation(theta);
    return solveQuadratic(
      a * maxParameter * maxParameter,
      b * maxParameter,
      c,
    ).map((root) => root * maxParameter);
  };
  const parameterEps = maxParameter * 1e-8;
  const validPoint = (
    theta: number,
    parameter: number | undefined,
  ): Vec3 | null => {
    if (
      parameter == null ||
      parameter < -parameterEps ||
      parameter > maxParameter + parameterEps
    )
      return null;
    const point = options.pointAt(
      theta,
      Math.max(0, Math.min(maxParameter, parameter)),
    );
    return options.inside(point) ? point : null;
  };
  const out: CubicBezier3[] = [];
  const angularStep = tau / Math.max(32, Math.floor(options.samples));

  for (let interval = 1; interval < events.length; interval++) {
    const leftEvent = events[interval - 1]!;
    const rightEvent = events[interval]!;
    const left = leftEvent.theta;
    const right = rightEvent.theta;
    const middle = (left + right) / 2;
    const middleRoots = rootsAt(middle);
    for (let branch = 0; branch < middleRoots.length; branch++) {
      if (!validPoint(middle, middleRoots[branch])) continue;

      const interiorPoint = (theta: number) =>
        validPoint(theta, rootsAt(theta)[branch]);
      const boundaryPoint = (
        theta: number,
        nearTheta: number,
        doubleRoot: boolean,
      ) => {
        const reference = rootsAt(nearTheta)[branch];
        if (reference == null) return null;
        const { a, b, c } = equation(theta);
        const an = a * maxParameter * maxParameter;
        const bn = b * maxParameter;
        const coefficientScale = Math.max(
          Math.abs(an),
          Math.abs(bn),
          Math.abs(c),
        );
        const discriminant = bn * bn - 4 * an * c;
        // Critical angles are accurate to floating-point precision, but a tiny
        // positive residual in C can otherwise erase a root born at parameter 0.
        // Snap only an event's double root, never ordinary interior samples.
        const candidates =
          doubleRoot &&
          Math.abs(an) > coefficientScale * 1e-14 &&
          Math.abs(discriminant) <= coefficientScale * coefficientScale * 1e-11
            ? [(-bn * maxParameter) / (2 * an)]
            : rootsAt(theta);
        const closest = candidates.reduce<number | undefined>(
          (best, root) =>
            best == null ||
            Math.abs(root - reference) < Math.abs(best - reference)
              ? root
              : best,
          undefined,
        );
        return validPoint(theta, closest);
      };
      const p0 = boundaryPoint(
        left,
        left + (right - left) * 1e-6,
        leftEvent.doubleRoot,
      );
      const p3 = boundaryPoint(
        right,
        right - (right - left) * 1e-6,
        rightEvent.doubleRoot,
      );
      if (!p0 || !p3) continue;

      const points: Vec3[] = [p0];
      const refine = (
        a: number,
        pa: Vec3,
        b: number,
        pb: Vec3,
        depth: number,
      ) => {
        const theta = (a + b) / 2;
        const pm = interiorPoint(theta);
        if (!pm) return false;
        const chordMiddle = Vec3.mulScalar(Vec3.add(pa, pb), 0.5);
        if (depth < 24 && Vec3.distance(pm, chordMiddle) > tolerance * 0.25) {
          if (!refine(a, pa, theta, pm, depth + 1)) return false;
          return refine(theta, pm, b, pb, depth + 1);
        }
        if (
          Vec3.distanceSq(points[points.length - 1]!, pb) >
          tolerance * tolerance * 1e-8
        )
          points.push(pb);
        return true;
      };

      const segments = Math.max(1, Math.ceil((right - left) / angularStep));
      let previousTheta = left;
      let previousPoint = p0;
      let complete = true;
      for (let segment = 1; segment <= segments; segment++) {
        const theta = left + ((right - left) * segment) / segments;
        const point = segment === segments ? p3 : interiorPoint(theta);
        if (!point || !refine(previousTheta, previousPoint, theta, point, 0)) {
          complete = false;
          break;
        }
        previousTheta = theta;
        previousPoint = point;
      }
      if (!complete || points.length < 2) continue;

      if (!options.useBezierFit) {
        out.push(...lineCubics(points));
        continue;
      }
      const fitted = fitPolylineToCubics(points, {
        maxError: tolerance * 0.25,
        parameterization: "chordLength",
        reparamIters: 1,
        // Endpoint proximity does not imply a closed intersection. In particular,
        // an open two-point run must not be collapsed to a single point.
        closeEps: 0,
        minAlpha: tolerance * 0.01,
      });
      for (const cubic of fitted) {
        let valid = true;
        for (let sample = 0; sample <= 16; sample++) {
          const point = evalCubic3(cubic, sample / 16);
          if (
            options.surfaceError(point) > tolerance ||
            !options.inside(point)
          ) {
            valid = false;
            break;
          }
        }
        if (valid) out.push(cubic);
        else {
          // A fit may overshoot between its input samples. Replace only that
          // section with its adaptively refined polyline, preserving topology.
          const start = points.indexOf(cubic.p0);
          const end = points.indexOf(cubic.p3, start + 1);
          if (start >= 0 && end > start)
            out.push(...lineCubics(points.slice(start, end + 1)));
        }
      }
    }
  }
  return out;
}

function lineCubics(points: readonly Vec3[]): CubicBezier3[] {
  return points
    .slice(1)
    .map((point, index) => lineToCubic3(points[index]!, point));
}
