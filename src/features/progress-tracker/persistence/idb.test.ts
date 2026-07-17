import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { idbDel, idbGet, idbPut } from "./idb";

beforeEach(() => {
  // A fresh in-memory database per test - jsdom has no native IndexedDB, so
  // `fake-indexeddb` stands in; re-instantiating avoids state leaking
  // across tests (idb.ts always opens the same fixed DB/store name).
  globalThis.indexedDB = new IDBFactory();
});

describe("idb", () => {
  it("put then get round-trips a value", async () => {
    await idbPut("key-a", { hello: "world" });
    await expect(idbGet("key-a")).resolves.toEqual({ hello: "world" });
  });

  it("get of a missing key resolves undefined", async () => {
    await expect(idbGet("missing")).resolves.toBeUndefined();
  });

  it("put overwrites an existing entry", async () => {
    await idbPut("key-a", "first");
    await idbPut("key-a", "second");
    await expect(idbGet("key-a")).resolves.toBe("second");
  });

  it("del removes the key", async () => {
    await idbPut("key-a", "value");
    await idbDel("key-a");
    await expect(idbGet("key-a")).resolves.toBeUndefined();
  });

  it("del of a missing key is a no-op", async () => {
    await expect(idbDel("missing")).resolves.toBeUndefined();
  });
});
