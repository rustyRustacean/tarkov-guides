"use client";

import { useSyncExternalStore } from "react";

// Browser capability never changes during a session, so there is nothing
// to subscribe to. This is a one-shot feature check exposed through
// `useSyncExternalStore` purely to get its safe SSR-snapshot handling
// (avoids a hydration mismatch, since `document` doesn't exist on the
// server) without the `useEffect` + `setState` pattern the naive version
// of this hook would use; see `ThemeProvider.tsx` for the same tradeoff.
function subscribe() {
  return () => undefined;
}

function getSnapshot(): boolean {
  return typeof document.startViewTransition === "function";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Feature-detects the View Transitions API (`document.startViewTransition`).
 * Returns `false` during the server-rendered pass and resolves to the real
 * value once mounted on the client: safe to use directly, no separate
 * "isLoaded" flag needed.
 */
export function useViewTransitionsSupport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
