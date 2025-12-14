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
};

export function piecesToSvg(pieces: StyledPiece[], camera: Camera, opts: SvgRenderOptions): string {
  const style = { ...defaultStyle, ...(opts.style ?? {}) };
  const { width, height } = opts;
  const background = opts.background ?? true;

  const paths: string[] = [];
  for (const piece of pieces) {
    const d = cubic3ToSvgPathD(piece, camera, width, height);
    const stroke = piece.visible ? style.strokeVisible : style.strokeHidden;
    const strokeWidth = piece.visible ? style.strokeWidthVisible : style.strokeWidthHidden;
    const extra = piece.visible
      ? ""
      : ` stroke-dasharray="${style.dashArrayHidden}" opacity="${style.opacityHidden}"`;
    const path =
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${style.lineCap}"` +
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

function cubic3ToSvgPathD(piece: StyledPiece, camera: Camera, width: number, height: number): string {
  const p0 = camera.projectToSvg(piece.bez.p0, width, height);
  const p1 = camera.projectToSvg(piece.bez.p1, width, height);
  const p2 = camera.projectToSvg(piece.bez.p2, width, height);
  const p3 = camera.projectToSvg(piece.bez.p3, width, height);
  return `M ${fmt(p0.x)} ${fmt(p0.y)} C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "0";
}


