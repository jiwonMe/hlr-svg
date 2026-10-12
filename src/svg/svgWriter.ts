import type { Camera } from "../camera/camera.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";
import {
  evalCubic3,
  splitCubic3,
  type CubicBezier3,
} from "../curves/cubicBezier3.js";

export type SvgStyle = {
  strokeVisible: string;
  strokeHidden: string;
  strokeWidthVisible: number;
  strokeWidthHidden: number;
  dashArrayHidden: string;
  opacityHidden: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
};

export type SvgRenderOptions = {
  width: number;
  height: number;
  style?: Partial<SvgStyle>;
  background?: boolean; // default: true (white rect)
};

const defaultStyle: SvgStyle = {
  strokeVisible: "black",
  strokeHidden: "black",
  strokeWidthVisible: 1.5,
  strokeWidthHidden: 1.5,
  dashArrayHidden: "3 3",
  opacityHidden: 0.5,
  lineCap: "butt",
  lineJoin: "round",
};

export type ProjectedSvgPath = { d: string; visible: boolean };

/** Camera-dependent work can be reused when only line styling changes. */
export function projectPiecesToSvgPaths(
  pieces: StyledPiece[],
  camera: Camera,
  width: number,
  height: number,
): ProjectedSvgPath[] {
  return chainPieces(pieces, 1e-6).map((chain) => ({
    d: chainToSvgPathD(chain, camera, width, height),
    visible: chain[0]?.visible ?? true,
  }));
}

export function piecesToSvg(
  pieces: StyledPiece[],
  camera: Camera,
  opts: SvgRenderOptions,
): string {
  return projectedPathsToSvg(
    projectPiecesToSvgPaths(pieces, camera, opts.width, opts.height),
    opts,
  );
}

export function projectedPathsToSvg(
  projected: readonly ProjectedSvgPath[],
  opts: SvgRenderOptions,
): string {
  const style = { ...defaultStyle, ...(opts.style ?? {}) };
  const { width, height } = opts;
  const background = opts.background ?? true;

  const paths: string[] = [];
  // Use slightly larger epsilon to connect pieces that may have minor numerical differences
  for (const { d, visible } of projected) {
    const stroke = visible ? style.strokeVisible : style.strokeHidden;
    const strokeWidth = visible
      ? style.strokeWidthVisible
      : style.strokeWidthHidden;
    const extra = visible
      ? ""
      : ` stroke-dasharray="${style.dashArrayHidden}" opacity="${style.opacityHidden}"`;
    const path =
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}"` +
      `${extra} />`;
    paths.push(path);
  }

  const bg = background
    ? `<rect width="100%" height="100%" fill="white" />`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    bg +
    paths.join("") +
    `</svg>`
  );
}

function chainToSvgPathD(
  chain: StyledPiece[],
  camera: Camera,
  width: number,
  height: number,
): string {
  const first = chain[0]!;
  const p0 = camera.projectToSvg(first.bez.p0, width, height);
  let d = `M ${fmt(p0.x)} ${fmt(p0.y)}`;
  for (const piece of chain) {
    d += projectedCubicCommands(piece.bez, camera, width, height);
  }
  return d;
}

// Perspective projection produces a rational curve. Subdivision keeps the SVG
// polynomial approximation aligned with the projected surface (in screen pixels).
function projectedCubicCommands(
  bez: CubicBezier3,
  camera: Camera,
  width: number,
  height: number,
  depth = 0,
): string {
  const points = [bez.p0, bez.p1, bez.p2, bez.p3].map((p) =>
    camera.projectToSvg(p, width, height),
  );
  if (camera.kind === "perspective" && depth < 12) {
    let error = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const u = 1 - t;
      const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      let x = 0,
        y = 0;
      for (let i = 0; i < 4; i++) {
        x += weights[i]! * points[i]!.x;
        y += weights[i]! * points[i]!.y;
      }
      const exact = camera.projectToSvg(evalCubic3(bez, t), width, height);
      error = Math.max(error, Math.hypot(x - exact.x, y - exact.y));
    }
    if (error > 0.2) {
      const halves = splitCubic3(bez, 0.5);
      return (
        projectedCubicCommands(halves.left, camera, width, height, depth + 1) +
        projectedCubicCommands(halves.right, camera, width, height, depth + 1)
      );
    }
  }
  const [, p1, p2, p3] = points;
  return ` C ${fmt(p1!.x)} ${fmt(p1!.y)} ${fmt(p2!.x)} ${fmt(p2!.y)} ${fmt(p3!.x)} ${fmt(p3!.y)}`;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "0";
}

function chainPieces(
  pieces: StyledPiece[],
  connectEpsSq: number,
): StyledPiece[][] {
  const out: StyledPiece[][] = [];
  let cur: StyledPiece[] = [];

  const canAppend = (a: StyledPiece, b: StyledPiece) => {
    if (a.visible !== b.visible) return false;
    const dx = a.bez.p3.x - b.bez.p0.x;
    const dy = a.bez.p3.y - b.bez.p0.y;
    const dz = a.bez.p3.z - b.bez.p0.z;
    return dx * dx + dy * dy + dz * dz <= connectEpsSq;
  };

  for (const p of pieces) {
    const prev = cur[cur.length - 1];
    if (!prev) {
      cur = [p];
      continue;
    }
    if (canAppend(prev, p)) {
      cur.push(p);
    } else {
      out.push(cur);
      cur = [p];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
