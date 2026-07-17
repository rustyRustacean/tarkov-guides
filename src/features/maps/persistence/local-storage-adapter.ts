import { deserializeSnapshot } from "./serialize";

import type { MapsPersistenceAdapter } from "./types";

/** Own namespace, independent of Progress Tracker's `.v1` key - matches this project's per-feature key convention. */
const STORAGE_KEY = "tarkovguides.maps.v1";

/**
 * The sole persistence backend for the Maps feature - matches
 * `src/features/progress-tracker/persistence/local-storage-adapter.ts`'s
 * shape exactly. Silently no-ops (rather than throwing) on write failure.
 */
export const localStorageAdapter: MapsPersistenceAdapter = {
  id: "local-storage",

  isAvailable() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  },

  write(snapshot) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("[maps] failed to write to localStorage", error);
    }
    return Promise.resolve();
  },

  read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return Promise.resolve(null);
      const parsed: unknown = JSON.parse(raw);
      return Promise.resolve(deserializeSnapshot(parsed));
    } catch (error) {
      console.warn("[maps] failed to read from localStorage", error);
      return Promise.resolve(null);
    }
  },
};
