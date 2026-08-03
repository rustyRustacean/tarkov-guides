"use client";

import { useEffect } from "react";

import type { PersistenceAdapter } from "./types";
import type { StoreApi, UseBoundStore } from "zustand";

/** Debounce window between a store change and the next localStorage write. */
const DEBOUNCE_MS = 500;

export interface UseStorePersistenceSyncOptions<
  TState extends { hydrate: (snapshot: TSnapshot) => void },
  TSnapshot,
> {
  store: UseBoundStore<StoreApi<TState>>;
  /** The always-on Tier 1 backend (from `createLocalStorageAdapter`). */
  adapter: PersistenceAdapter<TSnapshot>;
  serialize: (state: TState) => TSnapshot;
  deserialize: (parsed: unknown) => TSnapshot | null;
  /**
   * The localStorage key `adapter` writes under - required to enable the
   * cross-tab `storage` listener below; every current caller passes one
   * (both features persist to localStorage), but it's kept optional so a
   * future non-localStorage-backed caller isn't forced into cross-tab logic
   * that wouldn't apply to it.
   */
  storageKey?: string;
  /**
   * Additional backend(s) to also write to on every flush (e.g.
   * progress-tracker's FSA folder tier) - reuses this same debounce/flush
   * cadence rather than a second timer. Pass a stable (module-level or
   * memoized) array reference - a fresh inline literal on every render
   * would re-run this hook's effect on every render too, since it's a
   * dependency below.
   */
  extraWriters?: readonly PersistenceAdapter<TSnapshot>[];
}

/**
 * Keeps localStorage (and any `extraWriters`) in sync with a Zustand store:
 * writes are debounced on every change, plus flushed immediately on
 * `visibilitychange`(hidden)/`pagehide`/`beforeunload` as a crash-resilience
 * safety net. Generalized from `progress-tracker`'s own hook (pre-production
 * audit, `CODE_AUDIT.md` finding 8) - the stronger of the two
 * near-duplicate versions that existed before this: `maps`'s copy lacked
 * both the FSA-tier support (now `extraWriters`) and, more importantly, the
 * cross-tab `storage` listener below, so the exact two-tabs-overwrite-each-
 * other data-loss bug this hook prevents was still live for Maps until this
 * consolidation.
 *
 * Cross-tab counterpart: without the `storage` listener, two tabs open on
 * the same profile could silently lose data - Tab A completes a change and
 * writes it, Tab B (still holding pre-change state in memory) closes
 * shortly after, and its `beforeunload` flush serializes ITS stale snapshot
 * and overwrites Tab A's newer write wholesale, with no warning. The
 * browser's `storage` event fires in every OTHER tab (never the tab that
 * made the change) whenever `storageKey` actually changes, so re-hydrating
 * from it here means a tab is never more than one event behind the last
 * real write, from any tab - by the time Tab B would flush its own stale
 * state, it isn't stale anymore.
 *
 * `applyingRemoteChange` breaks the obvious feedback loop this would
 * otherwise create: naively hydrating from a `storage` event is itself a
 * store change, which would otherwise schedule this same hook's OWN
 * debounced write right back out - re-triggering a `storage` event in every
 * OTHER tab (including the one that just wrote), cascading indefinitely. A
 * content-equality check wouldn't reliably break this either, since
 * `serialize` typically stamps a fresh `exportedAt` on every write, so the
 * round-tripped content is never byte-identical to what was just received.
 *
 * Only handles the `storage` event's counterpart for a change that happens
 * WHILE already mounted - the INITIAL load is still
 * `useHydrateFromLocalStorage`'s one-shot job.
 */
export function useStorePersistenceSync<
  TState extends { hydrate: (snapshot: TSnapshot) => void },
  TSnapshot,
>(options: UseStorePersistenceSyncOptions<TState, TSnapshot>): void {
  const { store, adapter, serialize, deserialize, storageKey, extraWriters } = options;

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let applyingRemoteChange = false;

    function flush(): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      const snapshot = serialize(store.getState());
      void adapter.write(snapshot);
      for (const writer of extraWriters ?? []) {
        void writer.write(snapshot);
      }
    }

    const unsubscribe = store.subscribe(() => {
      if (applyingRemoteChange) return;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    });

    function handleStorage(event: StorageEvent): void {
      if (event.key !== storageKey || event.newValue === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.newValue);
      } catch {
        return;
      }
      const snapshot = deserialize(parsed);
      if (snapshot === null) return;
      applyingRemoteChange = true;
      try {
        store.getState().hydrate(snapshot);
      } finally {
        applyingRemoteChange = false;
      }
    }
    if (storageKey !== undefined) window.addEventListener("storage", handleStorage);

    function handleVisibilityChange(): void {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      unsubscribe();
      if (storageKey !== undefined) window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [store, adapter, serialize, deserialize, storageKey, extraWriters]);
}
