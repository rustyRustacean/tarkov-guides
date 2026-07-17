"use client";

import { useEffect } from "react";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

/**
 * Loads persisted progress from localStorage once on mount and hydrates
 * the store with it - a no-op if nothing was ever persisted (first visit).
 * Deliberately separate from {@link usePersistenceSync} (which handles the
 * write side): hydration is a one-shot action, not an ongoing sync.
 */
export function useHydrateOnMount(): void {
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromLocalStorage(): Promise<void> {
      const snapshot = await localStorageAdapter.read();
      if (cancelled || snapshot === null) return;
      useProgressTrackerStore.getState().hydrate(snapshot);
    }
    void hydrateFromLocalStorage();

    return () => {
      cancelled = true;
    };
  }, []);
}
