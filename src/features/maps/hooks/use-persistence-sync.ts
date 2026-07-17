"use client";

import { useEffect } from "react";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { serializeSnapshot } from "../persistence/serialize";
import { useMapsStore } from "../store";

/** Debounce window between a store change and the next localStorage write - matches Progress Tracker's own cadence. */
const DEBOUNCE_MS = 500;

/**
 * Keeps localStorage in sync with `useMapsStore`: writes are debounced on
 * every change, plus flushed immediately on `visibilitychange`(hidden)/
 * `pagehide`/`beforeunload` as a crash-resilience safety net. Mirrors
 * `src/features/progress-tracker/hooks/use-persistence-sync.ts` exactly,
 * minus the FSA-folder tier (not part of this feature's scope).
 */
export function useMapsPersistenceSync(): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function flush(): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      const snapshot = serializeSnapshot(useMapsStore.getState());
      void localStorageAdapter.write(snapshot);
    }

    const unsubscribe = useMapsStore.subscribe(() => {
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
