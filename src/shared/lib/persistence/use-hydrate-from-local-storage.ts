"use client";

import { useEffect } from "react";

import type { PersistenceAdapter } from "./types";
import type { StoreApi, UseBoundStore } from "zustand";

/**
 * Loads a persisted snapshot from `adapter` once on mount and hydrates
 * `store` with it, a no-op if nothing was ever persisted (first visit).
 * Generalized from `progress-tracker`/`maps`'s two near-identical
 * `useHydrateOnMount` hooks. Deliberately separate from the write-side
 * sync hook (`use-store-persistence-sync.ts`): hydration is a one-shot
 * action, not an ongoing sync.
 *
 * Maps' own version additionally restores session-scoped map-variant
 * selections from `sessionStorage`, kept as that feature's own extra
 * mount-time effect (`useMapsHydrateOnMount`) rather than a parameter here,
 * since it's the only current caller with a second concern.
 */
export function useHydrateFromLocalStorage<
  TState extends { hydrate: (snapshot: TSnapshot) => void },
  TSnapshot,
>(store: UseBoundStore<StoreApi<TState>>, adapter: PersistenceAdapter<TSnapshot>): void {
  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const snapshot = await adapter.read();
      if (cancelled || snapshot === null) return;
      store.getState().hydrate(snapshot);
    }
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [store, adapter]);
}
