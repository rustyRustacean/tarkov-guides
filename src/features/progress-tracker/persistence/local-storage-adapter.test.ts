import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyProfileProgress } from "../types";

import { localStorageAdapter } from "./local-storage-adapter";
import { serializeSnapshot } from "./serialize";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("localStorageAdapter", () => {
  it("isAvailable is true in a browser-like (jsdom) environment", () => {
    expect(localStorageAdapter.isAvailable()).toBe(true);
  });

  it("read() resolves null when nothing has been written yet", async () => {
    await expect(localStorageAdapter.read()).resolves.toBeNull();
  });

  it("write() then read() round-trips a snapshot", async () => {
    const snapshot = serializeSnapshot({
      profiles: [{ id: "p1", name: "PMC", mode: "PVP", faction: "BEAR", face: null }],
      activeProfileId: "p1",
      progressByProfile: { p1: emptyProfileProgress() },
      autoStartNext: true,
    });
    await localStorageAdapter.write(snapshot);
    await expect(localStorageAdapter.read()).resolves.toEqual(snapshot);
  });

  it("read() resolves null (never throws) for malformed JSON already sitting in localStorage", async () => {
    window.localStorage.setItem("tarkovguides.progress-tracker.v1", "{not valid json");
    await expect(localStorageAdapter.read()).resolves.toBeNull();
  });

  it("write() resolves without throwing even if localStorage.setItem throws (e.g. quota exceeded)", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const snapshot = serializeSnapshot({
      profiles: [],
      activeProfileId: null,
      progressByProfile: {},
      autoStartNext: true,
    });
    await expect(localStorageAdapter.write(snapshot)).resolves.toBeUndefined();
    setItemSpy.mockRestore();
  });
});
