"use client";

import { useSyncExternalStore } from "react";

/** Matches legacy's exact `_phoneMQ` breakpoint (`routing.js`) - the same width the map screen switches from a 3-column desktop layout to a full-bleed map with a bottom-sheet sidebar. */
const QUERY = "(max-width: 640px)";

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
 * Reactively reads whether the viewport is at or below the map screen's
 * mobile breakpoint, updating live on resize/rotation - structurally
 * identical to `src/shared/lib/use-prefers-reduced-motion.ts`.
 * `getServerSnapshot` defaults to `false` (desktop layout) for the same
 * "safe direction" reasoning that hook documents - a server-rendered pass
 * assumes desktop, correcting to mobile immediately post-hydration if the
 * viewport is actually narrow.
 */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
