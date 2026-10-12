import React, { useRef, useState } from "react";
import { clamp } from "../runtime/orbit";
import { formatNumber } from "./math";

/**
 * A numeric input whose label scrubs the value: drag left or right, hold
 * Shift for ×10 or Alt for ×0.1. Arrow keys step, Enter commits.
 */
export function NumberField({
  label,
  value,
  step = 0.1,
  min = -Infinity,
  max = Infinity,
  unit,
  digits = 3,
  title,
  onBegin,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  digits?: number;
  title?: string;
  /** Called once before a scrub so the whole drag is a single undo step. */
  onBegin?: () => void;
  onChange: (value: number, transient: boolean) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const scrub = useRef<{ id: number; x: number; start: number } | null>(null);
  const bound = (v: number) => clamp(min, v, max);

  const commit = (text: string) => {
    const parsed = Number.parseFloat(text);
    setDraft(null);
    if (Number.isFinite(parsed) && parsed !== value)
      onChange(bound(parsed), false);
  };

  return (
    <label className="ed-num" title={title}>
      <span
        className="ed-num-label"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          onBegin?.();
          scrub.current = {
            id: event.pointerId,
            x: event.clientX,
            start: value,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const s = scrub.current;
          if (!s || s.id !== event.pointerId) return;
          const scale = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
          const steps = Math.round((event.clientX - s.x) / 4);
          onChange(bound(s.start + steps * step * scale), true);
        }}
        onPointerUp={(event) => {
          if (scrub.current?.id !== event.pointerId) return;
          scrub.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        {label}
      </span>
      <input
        value={draft ?? formatNumber(value, digits)}
        inputMode="decimal"
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(draft ?? String(value));
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const scale = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
            const sign = event.key === "ArrowUp" ? 1 : -1;
            setDraft(null);
            onChange(bound(value + sign * step * scale), false);
          }
        }}
      />
      {unit && <span className="ed-num-unit">{unit}</span>}
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ed-toggle">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        className="ed-switch"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg seg-sm" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
