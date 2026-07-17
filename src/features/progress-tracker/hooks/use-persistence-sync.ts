"use client";

import { useEffect } from "react";

import { fsaFolderAdapter } from "../persistence/fsa-folder-adapter";
import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { serializeSnapshot } from "../persistence/serialize";
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
 * Only handles hydrate-on-mount's counterpart (writing) - the initial load
 * from localStorage happens once via `useHydrateOnMount`, mounted alongside
 * this hook in `src/app/providers.tsx` (not here), since hydration is a
 * one-shot action rather than an ongoing sync.
 */
export function usePersistenceSync(): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

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
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    });

    function handleVisibilityChange(): void {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);
}
