"use client";

import { useHydrateFromLocalStorage } from "@/shared/lib/persistence/use-hydrate-from-local-storage";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

/**
 * Loads persisted progress from localStorage once on mount and hydrates the
 * store with it (a no-op on first visit, before anything's been persisted).
 * Separate from {@link usePersistenceSync}, which handles the write side:
 * hydration is one-shot, not an ongoing sync.
 */
export function useHydrateOnMount(): void {
  useHydrateFromLocalStorage(useProgressTrackerStore, localStorageAdapter);
}
