import { useEffect, useRef, useState } from "react";

/** Animate directly in one state update per frame, and pause hidden pages. */
export function useRafLoop(
  enabled: boolean,
  callback: (elapsedSeconds: number) => void,
): void {
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let frame: number | null = null;
    let previous: number | null = null;
    const loop = (timestamp: number) => {
      const elapsed =
        previous === null ? 1 / 60 : (timestamp - previous) / 1000;
      previous = timestamp;
      latestCallback.current(Math.min(0.1, elapsed));
      frame = requestAnimationFrame(loop);
    };
    const resume = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = null;
      if (!document.hidden) frame = requestAnimationFrame(loop);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled]);
}

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
