import type { Camera } from "../camera/camera.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";

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

export function piecesToSvg(pieces: StyledPiece[], camera: Camera, opts: SvgRenderOptions): string {
  const style = { ...defaultStyle, ...(opts.style ?? {}) };
  const { width, height } = opts;
  const background = opts.background ?? true;

  const paths: string[] = [];
  // Use slightly larger epsilon to connect pieces that may have minor numerical differences
  for (const chain of chainPieces(pieces, 1e-6)) {
    const d = chainToSvgPathD(chain, camera, width, height);
    const visible = chain[0]?.visible ?? true;
    const stroke = visible ? style.strokeVisible : style.strokeHidden;
    const strokeWidth = visible ? style.strokeWidthVisible : style.strokeWidthHidden;
    const extra = visible
      ? ""
      : ` stroke-dasharray="${style.dashArrayHidden}" opacity="${style.opacityHidden}"`;
    const path =
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}"` +
      `${extra} />`;
    paths.push(path);
  }

  const bg = background ? `<rect width="100%" height="100%" fill="white" />` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    bg +
    paths.join("") +
    `</svg>`
  );
}

function chainToSvgPathD(chain: StyledPiece[], camera: Camera, width: number, height: number): string {
  const first = chain[0]!;
  const p0 = camera.projectToSvg(first.bez.p0, width, height);
  let d = `M ${fmt(p0.x)} ${fmt(p0.y)}`;
  for (const piece of chain) {
    const p1 = camera.projectToSvg(piece.bez.p1, width, height);
    const p2 = camera.projectToSvg(piece.bez.p2, width, height);
    const p3 = camera.projectToSvg(piece.bez.p3, width, height);
    d += ` C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
  }
  return d;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "0";
}

function chainPieces(pieces: StyledPiece[], connectEpsSq: number): StyledPiece[][] {
  const out: StyledPiece[][] = [];
  let cur: StyledPiece[] = [];

  const canAppend = (a: StyledPiece, b: StyledPiece) => {
    if (a.visible !== b.visible) return false;
    const dx = a.bez.p3.x - b.bez.p0.x;
    const dy = a.bez.p3.y - b.bez.p0.y;
    const dz = a.bez.p3.z - b.bez.p0.z;
    return (dx * dx + dy * dy + dz * dz) <= connectEpsSq;
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


