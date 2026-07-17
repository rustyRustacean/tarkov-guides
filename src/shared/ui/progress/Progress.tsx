import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "../lib/cn";

import type { ComponentProps } from "react";

export interface ProgressProps extends ComponentProps<typeof ProgressPrimitive.Root> {
  value: number;
  max?: number;
}

/**
 * A determinate progress bar. Built on Radix's `Progress` primitive for
 * correct `role="progressbar"`/`aria-valuenow`/`aria-valuemax` wiring -
 * not worth hand-rolling.
 */
export function Progress({ className, value, max = 100, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      className={cn("bg-secondary relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="bg-primary h-full w-full flex-1 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${String(100 - (100 * value) / max)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
