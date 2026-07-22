import { deserializeSnapshot } from "./serialize";

import type { PersistenceAdapter } from "./types";

/**
 * New namespace (never legacy's `odqum.tarkov.state`) - matches Phase 2's
 * `.v1` localStorage-key convention. Exported so `use-persistence-sync.ts`'s
 * cross-tab `storage` event listener can filter to exactly this key without
 * a second, driftable copy of the string.
 */
export const STORAGE_KEY = "tarkovguides.progress-tracker.v1";

/**
 * Tier 1 of the three-tier backup architecture - always-on, the sole
 * source of truth for "what does the user see on next visit." Silently
 * no-ops (rather than throwing) on write failure (e.g. quota exceeded,
 * private browsing) - matches legacy `persistence.js`'s own defensive
 * `try/catch` around `localStorage.setItem`.
 */
export const localStorageAdapter: PersistenceAdapter = {
  id: "local-storage",

  isAvailable() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  },

  write(snapshot) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("[progress-tracker] failed to write to localStorage", error);
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
      console.warn("[progress-tracker] failed to read from localStorage", error);
      return Promise.resolve(null);
    }
  },
};
