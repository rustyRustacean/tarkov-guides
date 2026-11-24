"use client";

import { useState } from "react";

import { cn } from "@/shared/ui/lib/cn";

import { INPUT_CLASS } from "./event-ui";

/**
 * A number input that keeps whatever is typed (a lone "-", "1.", an empty
 * box) while reporting only valid, in-range numbers. A plain controlled
 * `type="number"` input fights the user there: the half-typed value isn't a
 * number yet, so it snaps back. Re-seeds from `value` when the parent's
 * value changes to something the draft doesn't already show.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  integer = false,
  className,
  ...aria
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [seed, setSeed] = useState(value);
  if (seed !== value) {
    // The parent moved on (another editor, a reset): show its value unless
    // the draft already means the same number.
    setSeed(value);
    if (Number(draft) !== value) setDraft(String(value));
  }

  return (
    <input
      {...aria}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      className={cn(INPUT_CLASS, "no-spinner tabular-nums", className)}
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = Number(text);
        if (text.trim() === "" || !Number.isFinite(parsed)) return;
        if (parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) return;
        setSeed(parsed);
        onChange(parsed);
      }}
      onBlur={() => {
        setDraft(String(value));
      }}
    />
  );
}
