import { describe, expect, it } from "vitest";

import { mergeWithPreviousGameData } from "./merge-with-previous";

import type { TarkovGameData } from "./types";

function makeGameData(overrides: Partial<TarkovGameData> = {}): TarkovGameData {
  return {
    tasks: [],
    hideoutStations: [],
    items: [],
    traders: [],
    barters: [],
    crafts: [],
    maps: [],
    ...overrides,
  };
}

describe("mergeWithPreviousGameData", () => {
  it("keeps the fresh value for any section that came back non-empty", () => {
    const fresh = makeGameData({ items: [{ id: "1" }] as never });
    const previous = makeGameData({ items: [{ id: "old" }] as never });
    expect(mergeWithPreviousGameData(fresh, previous).items).toEqual([{ id: "1" }]);
  });

  it("falls back to the previous value for a section the fresh response returned empty", () => {
    const fresh = makeGameData({ items: [] });
    const previous = makeGameData({ items: [{ id: "old" }] as never });
    expect(mergeWithPreviousGameData(fresh, previous).items).toEqual([{ id: "old" }]);
  });

  it("falls back to an empty array when both fresh and previous are empty/undefined", () => {
    const fresh = makeGameData({ items: [] });
    expect(mergeWithPreviousGameData(fresh, undefined).items).toEqual([]);
  });

  it("merges each of the seven sections independently", () => {
    const fresh = makeGameData({
      tasks: [],
      items: [{ id: "fresh-item" }] as never,
      traders: [],
    });
    const previous = makeGameData({
      tasks: [{ id: "old-task" }] as never,
      items: [{ id: "old-item" }] as never,
      traders: [{ id: "old-trader" }] as never,
    });
    const result = mergeWithPreviousGameData(fresh, previous);
    expect(result.tasks).toEqual([{ id: "old-task" }]);
    expect(result.items).toEqual([{ id: "fresh-item" }]);
    expect(result.traders).toEqual([{ id: "old-trader" }]);
  });
});
