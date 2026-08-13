"use client";

import { Minus, Plus } from "lucide-react";

export interface QuantityStepperProps {
  value: number;
  /** Called with the new absolute value, already clamped to `min`/`max`. */
  onChange: (next: number) => void;
  /** Fired only by the +/- buttons, when a caller wants the delta rather than the total. Falls back to `onChange`. */
  onStep?: (delta: number) => void;
  min?: number;
  max?: number;
  /** Accessible name base, e.g. `"Have Salewa"`; the buttons become "Increase/Decrease {label}". */
  label: string;
  className?: string;
}

const BUTTON_CLASS =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-full w-6 shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35";

function clamp(value: number, min: number, max: number | undefined): number {
  if (!Number.isFinite(value)) return min;
  const floored = Math.floor(value);
  if (floored < min) return min;
  if (max !== undefined && floored > max) return max;
  return floored;
}

/**
 * A compact `[-] [n] [+]` number control.
 *
 * The middle stays a real `<input type="number">` rather than static text:
 * stepping from 0 to 40 for a "collect 40 screws" task with forty clicks is
 * nobody's idea of an improvement, so typing an amount outright has to keep
 * working. The buttons are for the common case of nudging by one.
 *
 * Sized to sit inline in a dense row (h-7, ~5rem wide). The segmented border
 * groups the three controls as one field so a row of them reads as a column of
 * values rather than a scattering of little buttons.
 *
 * Native number spinners are hidden via the `no-spinner` class in
 * `globals.css`: they're tiny, hover-only, and would sit right beside our own
 * +/- doing the same job.
 */
export function QuantityStepper({
  value,
  onChange,
  onStep,
  min = 0,
  max,
  label,
  className,
}: QuantityStepperProps) {
  function step(delta: number): void {
    const next = clamp(value + delta, min, max);
    if (next === value) return;
    if (onStep) {
      onStep(next - value);
      return;
    }
    onChange(next);
  }

  return (
    <div
      className={`border-border bg-background focus-within:ring-ring/50 inline-flex h-7 items-center overflow-hidden rounded-md border focus-within:ring-2 ${className ?? ""}`}
    >
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => {
          step(-1);
        }}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          onChange(clamp(Number.isNaN(parsed) ? min : parsed, min, max));
        }}
        // Selects the whole value on focus so typing replaces it rather than
        // appending to it: "5" after a click should mean 5, not 35.
        onFocus={(event) => {
          event.target.select();
        }}
        className="no-spinner border-border h-full w-9 min-w-0 border-x bg-transparent text-center text-xs tabular-nums outline-none"
      />
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={`Increase ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => {
          step(1);
        }}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
