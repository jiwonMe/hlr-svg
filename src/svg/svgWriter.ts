import type { Camera } from "../camera/camera.js";
import type { StyledPiece } from "../hlr/splitByVisibility.js";
import {
  snapshotToSvg,
  styledPiecesToSnapshot,
  type LineStyle,
  type RenderSnapshot,
} from "../core/renderSnapshot.js";

export type SvgStyle = LineStyle;

export type SvgRenderOptions = {
  width: number;
  height: number;
  style?: Partial<SvgStyle>;
  background?: boolean;
};

export function piecesToSvg(
  pieces: StyledPiece[],
  camera: Camera,
  opts: SvgRenderOptions,
): string {
  return snapshotToSvg(styledPiecesToSnapshot(pieces, camera, opts));
}

export { snapshotToSvg, type RenderSnapshot };
