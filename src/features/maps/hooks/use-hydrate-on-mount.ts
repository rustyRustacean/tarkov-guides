"use client";

import { useEffect } from "react";

import { useHydrateFromLocalStorage } from "@/shared/lib/persistence/use-hydrate-from-local-storage";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

/**
 * Loads persisted Maps state from localStorage once on mount and hydrates
 * the store with it - a no-op if nothing was ever persisted (first visit),
 * via the shared `useHydrateFromLocalStorage` hook (`CODE_AUDIT.md`
 * finding 8). Also restores the session-scoped per-map variant selections
 * from `sessionStorage` in its own separate mount effect (kept out of the
 * durable snapshot, and out of the store's initial state so SSR and the
 * client's first render match) - this is Maps' own extra concern, not part
 * of the shared hook, since it's the only feature that needs it.
 */
export function useMapsHydrateOnMount(): void {
  useEffect(() => {
    // Synchronous and client-only - safe to read `sessionStorage` here (after
    // mount) where it can't cause a hydration mismatch, unlike the store's
    // initial state.
    useMapsStore.getState().restoreSessionMapVariants();
  }, []);

  useHydrateFromLocalStorage(useMapsStore, localStorageAdapter);
}
