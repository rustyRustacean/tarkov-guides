import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { idbDelImage, idbGetImage, idbPutImage } from "./custom-map-idb";

beforeEach(() => {
  // Fresh in-memory database per test: jsdom has no native IndexedDB.
  globalThis.indexedDB = new IDBFactory();
});

describe("custom-map-idb", () => {
  it("put then get round-trips a data URL", async () => {
    await idbPutImage("custom-1", "data:image/png;base64,AAAA");
    await expect(idbGetImage("custom-1")).resolves.toBe("data:image/png;base64,AAAA");
  });

  it("get of a missing key resolves undefined", async () => {
    await expect(idbGetImage("missing")).resolves.toBeUndefined();
  });

  it("put overwrites an existing entry", async () => {
    await idbPutImage("custom-1", "data:image/png;base64,FIRST");
    await idbPutImage("custom-1", "data:image/png;base64,SECOND");
    await expect(idbGetImage("custom-1")).resolves.toBe("data:image/png;base64,SECOND");
  });

  it("del removes the key", async () => {
    await idbPutImage("custom-1", "data:image/png;base64,AAAA");
    await idbDelImage("custom-1");
    await expect(idbGetImage("custom-1")).resolves.toBeUndefined();
  });

  it("del of a missing key is a no-op", async () => {
    await expect(idbDelImage("missing")).resolves.toBeUndefined();
  });
});
