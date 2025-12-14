import { useEffect, useRef, useState } from "react";

export function useRafTick(enabled: boolean): number {
  const [tick, setTick] = useState(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const loop = () => {
      setTick((x) => (x + 1) | 0);
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [enabled]);

  return tick;
}


