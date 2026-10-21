import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as StorageModule from "./idb-query-cache-storage";

let storageModule: typeof StorageModule;

beforeEach(async () => {
  // Fresh in-memory database per test: jsdom has no native IndexedDB. The
  // module is re-imported too, since it caches its open connection.
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  storageModule = await import("./idb-query-cache-storage");
});

describe("idb-query-cache-storage", () => {
  it("set then get round-trips a value past localStorage's 5M-character limit", async () => {
    const storage = storageModule.createIdbQueryCacheStorage();
    const large = "x".repeat(6_000_000);
    await storage.setItem("key", large);
    await expect(storage.getItem("key")).resolves.toBe(large);
  });

  it("get of a missing key resolves undefined", async () => {
    const storage = storageModule.createIdbQueryCacheStorage();
    await expect(storage.getItem("missing")).resolves.toBeUndefined();
  });

  it("set overwrites an existing entry", async () => {
    const storage = storageModule.createIdbQueryCacheStorage();
    await storage.setItem("key", "first");
    await storage.setItem("key", "second");
    await expect(storage.getItem("key")).resolves.toBe("second");
  });

  it("removeItem deletes the key", async () => {
    const storage = storageModule.createIdbQueryCacheStorage();
    await storage.setItem("key", "value");
    await storage.removeItem("key");
    await expect(storage.getItem("key")).resolves.toBeUndefined();
  });

  it("get resolves undefined instead of throwing when IndexedDB can't open", async () => {
    vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
      throw new Error("blocked");
    });
    const storage = storageModule.createIdbQueryCacheStorage();
    await expect(storage.getItem("key")).resolves.toBeUndefined();
  });

  it("clearIdbQueryCache removes the persisted query cache", async () => {
    const storage = storageModule.createIdbQueryCacheStorage();
    await storage.setItem(storageModule.QUERY_CACHE_KEY, "cached");
    await storageModule.clearIdbQueryCache();
    await expect(storage.getItem(storageModule.QUERY_CACHE_KEY)).resolves.toBeUndefined();
  });

  it("removeLegacyLocalStorageQueryCache drops the old localStorage entry", () => {
    window.localStorage.setItem(storageModule.QUERY_CACHE_KEY, '{"clientState":{"queries":[]}}');
    storageModule.removeLegacyLocalStorageQueryCache();
    expect(window.localStorage.getItem(storageModule.QUERY_CACHE_KEY)).toBeNull();
  });
});
