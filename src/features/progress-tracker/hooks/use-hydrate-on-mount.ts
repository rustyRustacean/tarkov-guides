"use client";

import { useHydrateFromLocalStorage } from "@/shared/lib/persistence/use-hydrate-from-local-storage";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

/**
 * Loads persisted progress from localStorage once on mount and hydrates
 * the store with it - a no-op if nothing was ever persisted (first visit).
 * Deliberately separate from {@link usePersistenceSync} (which handles the
 * write side): hydration is a one-shot action, not an ongoing sync. Built
 * on the shared `useHydrateFromLocalStorage` hook (`CODE_AUDIT.md`
 * finding 8).
 */
export function useHydrateOnMount(): void {
  useHydrateFromLocalStorage(useProgressTrackerStore, localStorageAdapter);
}
