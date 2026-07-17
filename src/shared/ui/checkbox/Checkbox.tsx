import { cn } from "../lib/cn";

import type { InputHTMLAttributes } from "react";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Themed checkbox: the native `<input>` is kept (full keyboard/a11y/label
 * association/testing-library behavior for free) but visually hidden behind
 * an `appearance-none` box, with a checkmark `<svg>` sibling toggled via the
 * `peer-checked` variant - reads off the same semantic tokens as `Button`/
 * `Badge` (`border`, `bg-primary`, `text-primary-foreground`), so it
 * reskins automatically across every site theme instead of falling back to
 * each browser's native checkbox chrome.
 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        type="checkbox"
        className={cn(
          "peer border-border bg-background checked:bg-primary checked:border-primary hover:border-input focus-visible:ring-ring h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="text-primary-foreground pointer-events-none absolute inset-0 hidden h-4 w-4 p-[3px] peer-checked:block"
      >
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
