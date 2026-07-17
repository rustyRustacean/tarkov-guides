"use client";

/**
 * A minimal hand-rolled IndexedDB wrapper for custom map image bytes -
 * ported in shape (not shared module) from `progress-tracker/persistence/
 * idb.ts`'s `idbGet`/`idbPut`/`idbDel`. Deliberately a separate DB/store
 * rather than a generalized version of that module: `idb.ts` is
 * single-purpose by its own doc comment (FSA folder handles only, hardcoded
 * DB/store name, not parameterized), and Maps already keeps its whole
 * persistence layer independent of Progress Tracker's (own `MapsSnapshot`,
 * own localStorage key) - this follows the same precedent rather than
 * generalizing a shipped, tested module to serve two unrelated data
 * domains. Legacy's own equivalent (`mapsConfig.js`'s `cmapDbOpen`/
 * `cmapIdbPut`/`cmapIdbGet`/`cmapIdbDel`) is likewise a wholly separate
 * IndexedDB (`odqum-custom-maps`) from its FS-handle one (`odqum-tarkov`).
 */
const DB_NAME = "tarkovguides-custom-maps";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(STORE_NAME);
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/** Reads a custom map's stored image data URL by its variant id. Resolves `undefined` if not present. */
export async function idbGetImage(key: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.addEventListener("success", () => {
      resolve(request.result as string | undefined);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/** Stores an image data URL under the given variant id, overwriting any existing entry. */
export async function idbPutImage(key: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(dataUrl, key);
    request.addEventListener("success", () => {
      resolve();
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/** Removes a variant's stored image. No-op if the key isn't present. */
export async function idbDelImage(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
    request.addEventListener("success", () => {
      resolve();
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}
