"use client";

import type { AsyncStorage } from "@tanstack/react-query-persist-client";

/**
 * Key the persisted React Query cache is stored under, in this module's
 * IndexedDB store. The same string was the cache's `localStorage` key before
 * the move to IndexedDB, so it doubles as the legacy key to scrub from
 * `localStorage` (see `removeLegacyLocalStorageQueryCache`).
 */
export const QUERY_CACHE_KEY = "tarkovguides.query-cache.v1";

/**
 * IndexedDB storage for the React Query persister (`providers.tsx`).
 *
 * The cache used to live in `localStorage`, but the serialized tarkov.dev
 * dataset is over 8M characters and Chromium rejects any single
 * `localStorage` value of 5M characters or more with `QuotaExceededError`.
 * The persister swallowed that error, so nothing was ever actually cached.
 * IndexedDB's quota is a share of free disk instead, comfortably above this.
 *
 * Values stay JSON strings (the persister's default serializer) rather than
 * structured-cloned objects: the persister's storage type is string-only,
 * and keeping JSON preserves the rule that nothing `Map`-shaped belongs in a
 * query result.
 *
 * Its own database, separate from `progress-tracker/persistence/idb.ts` and
 * `maps/persistence/custom-map-idb.ts`, matching their one-database-per-
 * concern split. Unlike those, the connection is kept open and reused, since
 * the persister writes on every (throttled) cache change.
 */
const DB_NAME = "tarkovguides-query-cache";
const DB_VERSION = 1;
const STORE_NAME = "entries";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(STORE_NAME);
    });
    request.addEventListener("success", () => {
      const db = request.result;
      // Another tab upgrading the schema, or the browser closing the
      // connection, invalidates this handle: drop it so the next call reopens.
      db.addEventListener("versionchange", () => {
        db.close();
        dbPromise = null;
      });
      db.addEventListener("close", () => {
        dbPromise = null;
      });
      resolve(db);
    });
    request.addEventListener("error", () => {
      dbPromise = null;
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
  return dbPromise;
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = operation(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/**
 * The `storage` for `createAsyncStoragePersister`. `getItem` resolves
 * `undefined` on any IndexedDB failure, so a broken or blocked store just
 * means a cold load from the network, never a crash. Write failures are left
 * to reject: the persister already catches them.
 */
export function createIdbQueryCacheStorage(): AsyncStorage {
  return {
    getItem: async (key) => {
      try {
        const value: unknown = await runRequest("readonly", (store) => store.get(key));
        return typeof value === "string" ? value : undefined;
      } catch {
        return undefined;
      }
    },
    setItem: (key, value) => runRequest("readwrite", (store) => store.put(value, key)),
    removeItem: async (key) => {
      await runRequest("readwrite", (store) => store.delete(key));
    },
  };
}

/** Deletes the persisted query cache. No-op if nothing is stored. */
export async function clearIdbQueryCache(): Promise<void> {
  await createIdbQueryCacheStorage().removeItem(QUERY_CACHE_KEY);
}

/**
 * Removes the pre-IndexedDB cache entry from `localStorage`. After the quota
 * failure it only ever held an empty client, but it's dead weight either way.
 * Never throws: storage may be disabled.
 */
export function removeLegacyLocalStorageQueryCache(): void {
  try {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    // Storage disabled or unavailable: nothing to remove.
  }
}
