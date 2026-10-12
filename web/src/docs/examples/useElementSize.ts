import React, { useEffect, useState } from "react";

export type ElementSize = {
  width: number;
  height: number;
};

export function useElementSize<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      const width = Math.max(0, Math.floor(box.width));
      const height = Math.max(0, Math.floor(box.height));
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
