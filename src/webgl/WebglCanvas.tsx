import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import type { RenderSnapshot } from "../core/renderSnapshot.js";
import { WebglRenderer } from "./WebglRenderer.js";

export type WebglCanvasHandle = {
  exportSvg: () => string | null;
  getSnapshot: () => RenderSnapshot | null;
  getRenderer: () => WebglRenderer | null;
};

export type WebglCanvasProps = {
  snapshot: RenderSnapshot;
  className?: string;
  canvasClassName?: string;
  style?: React.CSSProperties;
  onReady?: (renderer: WebglRenderer) => void;
};

export const WebglCanvas = forwardRef<WebglCanvasHandle, WebglCanvasProps>(
  function WebglCanvas(
    { snapshot, className, canvasClassName, style, onReady },
    forwardedRef,
  ): React.ReactElement {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<WebglRenderer | null>(null);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const renderer = new WebglRenderer({ container: host });
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
      void renderer.renderSnapshot(snapshot);
    }, [snapshot]);

    useImperativeHandle(
      forwardedRef,
      (): WebglCanvasHandle => ({
        exportSvg: () => rendererRef.current?.exportSvg() ?? null,
        getSnapshot: () => rendererRef.current?.getSnapshot() ?? null,
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
  },
);
