import React, { forwardRef, useEffect, useState } from "react";

import type { RenderSnapshot } from "@hlr/core/renderSnapshot.js";
import type {
  WebglCanvasHandle,
  WebglCanvasProps,
} from "@hlr/webgl/index.js";

type HostModule = typeof import("@hlr/webgl/index.js");

export type WebglCanvasHostProps = Omit<WebglCanvasProps, "snapshot"> & {
  snapshot: RenderSnapshot;
};

export const WebglCanvasHost = forwardRef<
  WebglCanvasHandle,
  WebglCanvasHostProps
>(function WebglCanvasHost(props, forwardedRef): React.ReactElement {
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
          background: props.snapshot.background ? "#ffffff" : "transparent",
          ...props.style,
        }}
      />
    );
  }

  const Canvas = mod.WebglCanvas;
  return <Canvas ref={forwardedRef} {...props} />;
});
