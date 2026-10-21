import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMPANION_PROFILE_MAP_KEY } from "@/features/companion/companion-config";

import { STORAGE_KEY } from "./local-storage-adapter";

import type * as ClearAllModule from "./clear-all";
import type * as QueryCacheStorageModule from "@/shared/lib/persistence/idb-query-cache-storage";

let clearAll: typeof ClearAllModule;
let queryCacheStorage: typeof QueryCacheStorageModule;

beforeEach(async () => {
  // Fresh in-memory database per test, and fresh modules so the query cache
  // storage's cached connection points at it.
  globalThis.indexedDB = new IDBFactory();
  window.localStorage.clear();
  vi.resetModules();
  queryCacheStorage = await import("@/shared/lib/persistence/idb-query-cache-storage");
  clearAll = await import("./clear-all");
});

describe("clearStoredProgress", () => {
  it("removes tracker progress and the companion profile map from localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{}");
    window.localStorage.setItem(COMPANION_PROFILE_MAP_KEY, "{}");
    clearAll.clearStoredProgress();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(COMPANION_PROFILE_MAP_KEY)).toBeNull();
  });

  it("also drops the persisted game-data cache from IndexedDB", async () => {
    const storage = queryCacheStorage.createIdbQueryCacheStorage();
    await storage.setItem(queryCacheStorage.QUERY_CACHE_KEY, "cached");
    clearAll.clearStoredProgress();
    await vi.waitFor(async () => {
      await expect(storage.getItem(queryCacheStorage.QUERY_CACHE_KEY)).resolves.toBeUndefined();
    });
  });
});
