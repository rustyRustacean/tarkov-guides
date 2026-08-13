"use client";

import { useRef } from "react";

import { cn } from "../lib/cn";

import type { KeyboardEvent } from "react";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Full-width, N-option segmented button: a generic replacement for a plain
 * native `<input type="radio">` row wherever the choice is small, fixed,
 * and worth seeing/switching at a glance. Visually matches the site's
 * existing `Tabs` primitive (`bg-muted` track, active option lifted onto
 * `bg-background` with `shadow-sm`) so it reads as the same design
 * language rather than a new one, just laid out `flex-1` instead of
 * content-sized so every option shares the full width equally.
 *
 * Hand-rolled WAI-ARIA `radiogroup` (roving tabindex; `ArrowLeft`/
 * `ArrowRight` wrap around, `Home`/`End` jump to the first/last option)
 * rather than Radix `Tabs` (there's no associated `TabsContent` pane here,
 * this selects a value, it doesn't switch a panel), and rather than
 * `@radix-ui/react-toggle-group`, matching this project's existing
 * hand-rolled-over-Radix convention for this kind of simple control (see
 * `Checkbox.tsx`, `FactionToggle.tsx`).
 *
 * Generic over `T extends string` rather than hardcoded to one call site's
 * union type: this is a plain reusable primitive, the same shape as
 * `Button`/`Badge`/`Checkbox`, not a one-off built for a single dialog.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  function selectIndex(index: number): void {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    buttonRefs.current[option.value]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const currentIndex = options.findIndex((option) => option.value === value);
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        selectIndex((currentIndex - 1 + options.length) % options.length);
        break;
      case "ArrowRight":
        event.preventDefault();
        selectIndex((currentIndex + 1) % options.length);
        break;
      case "Home":
        event.preventDefault();
        selectIndex(0);
        break;
      case "End":
        event.preventDefault();
        selectIndex(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "bg-muted text-muted-foreground flex w-full items-center rounded-lg p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[option.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "focus-visible:ring-ring flex h-7 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97]",
              active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
