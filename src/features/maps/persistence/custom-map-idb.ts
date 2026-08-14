"use client";

/**
 * Minimal hand-rolled IndexedDB wrapper for custom map image bytes. Kept
 * separate from `progress-tracker/persistence/idb.ts` on purpose: Maps
 * already keeps its whole persistence layer independent of Progress
 * Tracker's, and legacy's `mapsConfig.js` kept the same split.
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
