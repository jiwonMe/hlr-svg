import React, { forwardRef, useEffect, useState } from "react";

import type { GpuPreviewFrame } from "@hlr/core/gpuPreview.js";
import type {
  GpuPreviewCanvasHandle,
  GpuPreviewCanvasProps,
} from "@hlr/webgl/index.js";

type HostModule = typeof import("@hlr/webgl/index.js");

export type GpuPreviewCanvasHostProps = Omit<GpuPreviewCanvasProps, "frame"> & {
  frame: GpuPreviewFrame;
};

export const GpuPreviewCanvasHost = forwardRef<
  GpuPreviewCanvasHandle,
  GpuPreviewCanvasHostProps
>(function GpuPreviewCanvasHost(props, forwardedRef): React.ReactElement {
  const [mod, setMod] = useState<HostModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@hlr/webgl/index.js").then((next) => {
      if (!cancelled) setMod(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mod) {
    return (
      <div
        className={props.className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: props.frame.background ? "#ffffff" : "transparent",
          ...props.style,
        }}
      />
    );
  }

  const Canvas = mod.GpuPreviewCanvas;
  return <Canvas ref={forwardedRef} {...props} />;
});
