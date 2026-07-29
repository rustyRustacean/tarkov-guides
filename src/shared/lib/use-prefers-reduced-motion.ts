"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => {
    mql.removeEventListener("change", callback);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reads the OS-level `prefers-reduced-motion` setting reactively, updating
 * live if the user changes it mid-session (unlike
 * {@link "@/shared/ui/transition-link/use-view-transitions-support"}'s
 * one-shot capability check, this preference can genuinely change while the
 * page is open). `getServerSnapshot` defaults to `false` (motion allowed) -
 * the safe direction for a decorative animation: a server-rendered pass
 * briefly assumes motion is fine, and the client corrects to a static frame
 * immediately post-hydration if reduced motion is actually on, rather than
 * risking a flash of an unnecessarily-static hero for the common case.
 *
 * Originally `features/home/hooks/use-prefers-reduced-motion.ts` - promoted
 * here once the PvP guide's `VideoCompareSlider` became a second real
 * consumer (its intro reveal animation), per this project's "only genuinely
 * cross-feature primitives belong outside a feature folder" convention
 * (`CODING_STANDARDS.md`).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
