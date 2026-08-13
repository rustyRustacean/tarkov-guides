"use client";

/**
 * A minimal hand-rolled IndexedDB wrapper, used only to persist the linked
 * backup folder's `FileSystemDirectoryHandle` across sessions (handles are
 * structured-cloneable but can't go in `localStorage`, which is
 * string-only). Ported in spirit from legacy's `idbOpen`/`idbGet`/`idbPut`/
 * `idbDel`: ~35 lines of vanilla `indexedDB`, no library, matching this
 * project's hand-roll-over-dependency precedent.
 */
const DB_NAME = "tarkovguides-fsa";
const DB_VERSION = 1;
const STORE_NAME = "handles";

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

/** Reads a value by key. Resolves `undefined` if the key isn't present. */
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.addEventListener("success", () => {
      db.close();
      resolve(request.result as T | undefined);
    });
    request.addEventListener("error", () => {
      db.close();
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/** Stores a value under the given key, overwriting any existing entry. */
export async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
    request.addEventListener("success", () => {
      db.close();
      resolve();
    });
    request.addEventListener("error", () => {
      db.close();
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

/** Removes a key. No-op if the key isn't present. */
export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
    request.addEventListener("success", () => {
      db.close();
      resolve();
    });
    request.addEventListener("error", () => {
      db.close();
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}
