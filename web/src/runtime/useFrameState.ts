import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";

export type FrameStateControl<T> = {
  schedule: (update: SetStateAction<T>) => void;
  flush: () => void;
  reset: (update: SetStateAction<T>) => void;
  current: () => T;
};

/** Keep every input delta, but submit only the latest state per display frame. */
export function useFrameState<T>(initial: T): [T, FrameStateControl<T>] {
  const [value, setValue] = useState(initial);
  const latest = useRef(value);
  const frame = useRef<number | null>(null);

  const apply = useCallback((update: SetStateAction<T>) => {
    const next =
      typeof update === "function"
        ? (update as (previous: T) => T)(latest.current)
        : update;
    if (Object.is(next, latest.current)) return false;
    latest.current = next;
    return true;
  }, []);

  const flush = useCallback(() => {
    if (frame.current === null) return;
    cancelAnimationFrame(frame.current);
    frame.current = null;
    setValue(latest.current);
  }, []);

  const schedule = useCallback(
    (update: SetStateAction<T>) => {
      if (!apply(update)) return;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setValue(latest.current);
      });
    },
    [apply],
  );

  const reset = useCallback(
    (update: SetStateAction<T>) => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      apply(update);
      setValue(latest.current);
    },
    [apply],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  const control = useMemo(
    () => ({ schedule, flush, reset, current: () => latest.current }),
    [schedule, flush, reset],
  );
  return [value, control];
}
