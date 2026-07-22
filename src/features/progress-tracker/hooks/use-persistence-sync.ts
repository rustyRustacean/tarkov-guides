"use client";

import { useEffect } from "react";

import { fsaFolderAdapter } from "../persistence/fsa-folder-adapter";
import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { deserializeSnapshot, serializeSnapshot } from "../persistence/serialize";
import { useProgressTrackerStore } from "../store";

/** Debounce window between a store change and the next localStorage write. */
const DEBOUNCE_MS = 500;

/**
 * Keeps localStorage (Tier 1) - and, when linked, the FSA folder (Tier 2,
 * `fsa-folder-adapter.ts`) - in sync with the store: writes are debounced
 * on every change, plus flushed immediately on `visibilitychange`(hidden)/
 * `pagehide`/`beforeunload` as a safety net - this is deliberately a
 * STRONGER guarantee than legacy's `persistence.js`, which (despite its own
 * comments claiming otherwise) has no debounce timer at all and relies
 * purely on the hide/unload events, risking more data loss on a hard crash
 * between saves.
 *
 * Also the cross-tab counterpart: without this, two tabs open on the same
 * profile could silently lose data - Tab A completes a quest and writes it,
 * Tab B (still holding pre-completion state in memory) closes shortly
 * after, and its `beforeunload` flush above serializes ITS stale snapshot
 * and overwrites Tab A's newer write wholesale, with no warning. The
 * browser's `storage` event fires in every OTHER tab (never the tab that
 * made the change) whenever this key actually changes, so re-hydrating from
 * it here means a tab is never more than one event behind the last real
 * write, from any tab - by the time Tab B would flush its own stale state,
 * it isn't stale anymore.
 *
 * `applyingRemoteChange` breaks the obvious feedback loop this would
 * otherwise create: naively hydrating from a `storage` event is itself a
 * store change, which would otherwise schedule this same hook's OWN
 * debounced write right back out - re-triggering a `storage` event in every
 * OTHER tab (including the one that just wrote), cascading indefinitely.
 * A content-equality check wouldn't reliably break this either, since
 * `serializeSnapshot` stamps a fresh `exportedAt` on every write, so the
 * round-tripped content is never byte-identical to what was just received.
 * Kept in this one hook (not a separate hook) specifically so both sides of
 * this coordination share one closure variable rather than needing a
 * cross-module flag.
 *
 * Only handles hydrate-on-mount's counterpart for the INITIAL load -
 * `useHydrateOnMount` (mounted alongside this hook in `src/app/providers.tsx`)
 * still owns that one-shot action on first mount; this hook's `storage`
 * listener only ever reacts to a change that happens WHILE already mounted.
 */
export function usePersistenceSync(): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let applyingRemoteChange = false;

    function flush(): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      const snapshot = serializeSnapshot(useProgressTrackerStore.getState());
      void localStorageAdapter.write(snapshot);
      // Tier 2 - no-ops internally if no folder is linked. Reuses this same
      // debounce/flush cadence rather than a second timer (matches legacy's
      // own folder-write timing, see `fsa-folder-adapter.ts`'s doc comment).
      void fsaFolderAdapter.write(snapshot);
    }

    const unsubscribe = useProgressTrackerStore.subscribe(() => {
      if (applyingRemoteChange) return;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    });

    function handleStorage(event: StorageEvent): void {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.newValue);
      } catch {
        return;
      }
      const snapshot = deserializeSnapshot(parsed);
      if (snapshot === null) return;
      applyingRemoteChange = true;
      try {
        useProgressTrackerStore.getState().hydrate(snapshot);
      } finally {
        applyingRemoteChange = false;
      }
    }
    window.addEventListener("storage", handleStorage);

    function handleVisibilityChange(): void {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);
}
