"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";

import { useToastStore } from "./toast-store";

/**
 * Renders the currently active toast (if any) plus the Radix viewport that
 * hosts it. Mount this exactly once, near the root of the app (see
 * `src/app/providers.tsx`); trigger toasts from anywhere via the `toast()`
 * function in `toast-store.ts`, not by rendering this component again.
 */
export function Toaster() {
  const activeToast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {activeToast && (
        <ToastPrimitive.Root
          key={activeToast.id}
          duration={activeToast.durationMs}
          onOpenChange={(open) => {
            if (!open) {
              dismiss();
            }
          }}
          className="bg-popover text-popover-foreground border-border grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border p-4 shadow-lg"
        >
          <ToastPrimitive.Description className="text-sm">
            {activeToast.message}
          </ToastPrimitive.Description>
          {activeToast.action && (
            <ToastPrimitive.Action
              altText={activeToast.action.label}
              onClick={activeToast.action.onClick}
              className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
            >
              {activeToast.action.label}
            </ToastPrimitive.Action>
          )}
        </ToastPrimitive.Root>
      )}
      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
