"use client";

import { useEffect } from "react";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

/**
 * Loads persisted Maps state from localStorage once on mount and hydrates
 * the store with it - a no-op if nothing was ever persisted (first visit).
 * Also restores the session-scoped per-map variant selections from
 * `sessionStorage` (kept out of the durable snapshot, and out of the store's
 * initial state so SSR and the client's first render match). Mirrors
 * `src/features/progress-tracker/hooks/use-hydrate-on-mount.ts`.
 */
export function useMapsHydrateOnMount(): void {
  useEffect(() => {
    let cancelled = false;

    // Synchronous and client-only - safe to read `sessionStorage` here (after
    // mount) where it can't cause a hydration mismatch, unlike the store's
    // initial state.
    useMapsStore.getState().restoreSessionMapVariants();

    async function hydrateFromLocalStorage(): Promise<void> {
      const snapshot = await localStorageAdapter.read();
      if (cancelled || snapshot === null) return;
      useMapsStore.getState().hydrate(snapshot);
    }
    void hydrateFromLocalStorage();

    return () => {
      cancelled = true;
    };
  }, []);
}
