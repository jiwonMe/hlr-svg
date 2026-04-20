import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import type { GpuPreviewFrame } from "../core/gpuPreview.js";
import { GpuPreviewRenderer } from "./GpuPreviewRenderer.js";

export type GpuPreviewCanvasHandle = {
  getFrame: () => GpuPreviewFrame | null;
  getRenderer: () => GpuPreviewRenderer | null;
};

export type GpuPreviewCanvasProps = {
  frame: GpuPreviewFrame;
  className?: string;
  canvasClassName?: string;
  style?: React.CSSProperties;
  onReady?: (renderer: GpuPreviewRenderer) => void;
};

export const GpuPreviewCanvas = forwardRef<
  GpuPreviewCanvasHandle,
  GpuPreviewCanvasProps
>(function GpuPreviewCanvas(
  { frame, className, canvasClassName, style, onReady },
  forwardedRef,
): React.ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GpuPreviewRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new GpuPreviewRenderer({ container: host });
    rendererRef.current = renderer;

    void renderer.init().then(() => {
      if (rendererRef.current !== renderer) return;
      const canvas = renderer.getCanvasElement();
      if (canvas && canvasClassName) {
        canvas.className = canvasClassName;
      }
      onReady?.(renderer);
    });

    return () => {
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
      renderer.destroy();
    };
  }, [canvasClassName, onReady]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    void renderer.renderFrame(frame);
  }, [frame]);

  useImperativeHandle(
    forwardedRef,
    (): GpuPreviewCanvasHandle => ({
      getFrame: () => rendererRef.current?.getFrame() ?? null,
      getRenderer: () => rendererRef.current,
    }),
    [],
  );

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
});
