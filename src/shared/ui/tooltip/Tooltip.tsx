"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "../lib/cn";

import type { ComponentProps } from "react";

/**
 * Tooltip, built on Radix's `Tooltip` primitive. Requires a single
 * `TooltipProvider` mounted once near the root of the app (see
 * `src/app/providers.tsx`) - do not mount a new one per tooltip instance.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** The floating tooltip bubble shown when a `TooltipTrigger` is hovered/focused. */
export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground border-border z-50 rounded-md border px-3 py-1.5 text-xs shadow-md",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
