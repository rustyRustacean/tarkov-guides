"use client";

import { useEffect } from "react";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

/**
 * Loads persisted Maps state from localStorage once on mount and hydrates
 * the store with it - a no-op if nothing was ever persisted (first visit).
 * Mirrors `src/features/progress-tracker/hooks/use-hydrate-on-mount.ts`.
 */
export function useMapsHydrateOnMount(): void {
  useEffect(() => {
    let cancelled = false;

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
