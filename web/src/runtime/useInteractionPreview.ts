import { useEffect, useState } from "react";

export function useInteractionPreview(
  active: boolean,
  settleMs = 140,
  pulse = 0,
): boolean {
  const [previewing, setPreviewing] = useState(active);

  useEffect(() => {
    if (active) {
      setPreviewing(true);
      return;
    }

    if (pulse > 0) {
      setPreviewing(true);
    }

    const timeout = window.setTimeout(() => {
      setPreviewing(false);
    }, settleMs);
    return () => window.clearTimeout(timeout);
  }, [active, settleMs, pulse]);

  return previewing;
}
