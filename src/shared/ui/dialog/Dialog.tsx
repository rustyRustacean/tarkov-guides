"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../lib/cn";

import type { ComponentProps, HTMLAttributes } from "react";

/**
 * Modal dialog, built on Radix's `Dialog` primitive: focus trap, `Escape`/
 * overlay-click dismissal, and background scroll lock all come free. This
 * is the explicit replacement for the legacy sites' modals, which were
 * built from raw (sometimes-unescaped) `innerHTML` string templates with
 * no focus management at all.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** The dialog's floating panel - contains the overlay, content, and a default close button. */
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      {/* No animation library is used here by design (see migration plan
          Phase 2 §4) - Radix unmounts DialogContent on close by default, so
          a real exit transition would need `forceMount` plus a dedicated
          animation lib to manage the unmount lifecycle. Kept intentionally
          simple: instant show/hide, correct focus/scroll-lock behavior. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "bg-card border-border fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:outline-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Top section of a `DialogContent` - typically holds `DialogTitle` and `DialogDescription`. */
export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

/** Bottom section of a `DialogContent` - typically holds action buttons. */
export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

/** A dialog's heading. Required for accessibility - Radix wires this to `aria-labelledby` automatically. */
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

/** Supporting text under a `DialogTitle`. Wired to `aria-describedby` automatically by Radix. */
export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
