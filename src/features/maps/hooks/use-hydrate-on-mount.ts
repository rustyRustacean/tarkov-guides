"use client";

import { useEffect } from "react";

import { useHydrateFromLocalStorage } from "@/shared/lib/persistence/use-hydrate-from-local-storage";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

/**
 * Loads persisted Maps state from localStorage once on mount and hydrates
 * the store with it, via the shared `useHydrateFromLocalStorage` hook (a
 * no-op if nothing was ever persisted). Also restores session-scoped
 * per-map variant selections and the task-links preference from
 * `sessionStorage` in a separate mount effect, kept out of the durable
 * snapshot and out of the store's initial state so SSR and the client's
 * first render match. This is Maps' own extra concern since it's the only
 * feature that needs it.
 */
export function useMapsHydrateOnMount(): void {
  useEffect(() => {
    // Synchronous and client-only: safe to read `sessionStorage` here, after
    // mount, without risking a hydration mismatch.
    useMapsStore.getState().restoreSessionMapVariants();
    useMapsStore.getState().restoreSessionTaskLinks();
  }, []);

  useHydrateFromLocalStorage(useMapsStore, localStorageAdapter);
}
