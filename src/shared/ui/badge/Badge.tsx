import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

import type { HTMLAttributes } from "react";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground border",
        amber: "bg-status-amber-soft text-status-amber",
        teal: "bg-status-teal-soft text-status-teal",
        green: "bg-status-green-soft text-status-green",
        red: "bg-status-red-soft text-status-red",
        kappa: "bg-status-kappa-soft text-status-kappa",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * A small status/label pill. The `amber`/`teal`/`green`/`red`/`kappa`
 * variants use the game-domain status color tokens (see `globals.css`'s
 * Layer 2): reach for these for task/hideout/Kappa state, not the generic
 * `default`/`secondary`/`destructive` variants.
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
