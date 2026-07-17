"use client";

import { useCallback } from "react";

import { useViewTransitionsSupport } from "./use-view-transitions-support";

/**
 * Wraps `document.startViewTransition` for a smoother client-side page
 * transition, falling back to calling the callback synchronously (still a
 * normal navigation, just without the transition animation) when the API
 * is unsupported or throws. Purely a progressive enhancement.
 */
export function useViewTransition() {
  const isSupported = useViewTransitionsSupport();

  const startViewTransition = useCallback(
    (callback: () => void | Promise<void>) => {
      if (!isSupported) {
        void callback();
        return;
      }
      try {
        document.startViewTransition(callback);
      } catch (error) {
        console.warn("View transition failed; falling back to a plain navigation.", error);
        void callback();
      }
    },
    [isSupported],
  );

  return { startViewTransition };
}
