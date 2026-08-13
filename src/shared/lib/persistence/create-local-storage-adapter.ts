import type { PersistenceAdapter } from "./types";

/**
 * Builds the always-on, Tier 1 localStorage backend every store-backed
 * feature in this app uses. Generalized from `progress-tracker`/`maps`'s
 * two byte-for-byte identical hand-rolled adapters. Silently no-ops
 * (rather than throwing) on write failure (e.g. quota exceeded, private
 * browsing), matching legacy `persistence.js`'s own defensive `try/catch`
 * around `localStorage.setItem`.
 *
 * @param key - The localStorage key this snapshot is written under.
 * @param label - Short feature name for the console warning prefix (e.g.
 *   `"progress-tracker"`, `"maps"`), purely diagnostic.
 * @param deserialize - Validates/narrows a `JSON.parse`d value into
 *   `TSnapshot`, or `null` if it doesn't look like a real snapshot (e.g. a
 *   schema-version mismatch, a corrupted write). Each feature owns its own
 *   validation logic (`serialize.ts`), not shared here.
 */
export function createLocalStorageAdapter<TSnapshot>(
  key: string,
  label: string,
  deserialize: (parsed: unknown) => TSnapshot | null,
): PersistenceAdapter<TSnapshot> & { readonly id: "local-storage" } {
  return {
    id: "local-storage",

    isAvailable() {
      return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    },

    write(snapshot) {
      try {
        window.localStorage.setItem(key, JSON.stringify(snapshot));
      } catch (error) {
        console.warn(`[${label}] failed to write to localStorage`, error);
      }
      return Promise.resolve();
    },

    read() {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return Promise.resolve(null);
        const parsed: unknown = JSON.parse(raw);
        return Promise.resolve(deserialize(parsed));
      } catch (error) {
        console.warn(`[${label}] failed to read from localStorage`, error);
        return Promise.resolve(null);
      }
    },
  };
}
