import { describe, expect, it } from "vitest";

import {
  adjustPending,
  cancelRaid,
  confirmRaid,
  editStash,
  fillMoneyPending,
  getRemaining,
  removeCustomItemEntry,
  upsertCustomItem,
} from "./item-tracking";

import type { CustomItemEntry } from "../types";

describe("getRemaining", () => {
  it("floors at 0 once have covers need", () => {
    expect(getRemaining(5, 5)).toBe(0);
    expect(getRemaining(5, 10)).toBe(0);
  });
  it("returns need minus have when have is short", () => {
    expect(getRemaining(5, 2)).toBe(3);
  });
});

describe("editStash", () => {
  it("sets the stash count directly, never touching other items", () => {
    const result = editStash({ "item-a": 1 }, "item-b", 4);
    expect(result).toEqual({ "item-a": 1, "item-b": 4 });
  });
  it("clamps negative/non-finite input to 0", () => {
    expect(editStash({}, "item-a", -5)["item-a"]).toBe(0);
    expect(editStash({}, "item-a", Number.NaN)["item-a"]).toBe(0);
  });
});

describe("adjustPending", () => {
  it("increments/decrements by delta", () => {
    expect(adjustPending({ "item-a": 2 }, "item-a", 1)["item-a"]).toBe(3);
    expect(adjustPending({ "item-a": 2 }, "item-a", -1)["item-a"]).toBe(1);
  });
  it("floors at 0 and never goes negative", () => {
    expect(adjustPending({ "item-a": 0 }, "item-a", -5)["item-a"]).toBe(0);
  });
  it("defaults a missing entry to 0 before applying the delta", () => {
    expect(adjustPending({}, "item-a", 2)["item-a"]).toBe(2);
  });
});

describe("fillMoneyPending", () => {
  it("direction > 0 OVERWRITES pending with the full remaining amount, not additive", () => {
    const result = fillMoneyPending({ money: 999 }, { money: 3 }, "money", 10, 1);
    expect(result.money).toBe(7);
  });
  it("direction < 0 clears pending to 0 outright", () => {
    const result = fillMoneyPending({ money: 500 }, { money: 3 }, "money", 10, -1);
    expect(result.money).toBe(0);
  });
});

describe("confirmRaid (EXTRACTED)", () => {
  it("merges every pending item into have, then clears pending", () => {
    const result = confirmRaid({ "item-a": 1 }, { "item-a": 2, "item-b": 5 });
    expect(result.have).toEqual({ "item-a": 3, "item-b": 5 });
    expect(result.pending).toEqual({});
  });
  it("is a no-op on have when pending is empty", () => {
    const result = confirmRaid({ "item-a": 1 }, {});
    expect(result.have).toEqual({ "item-a": 1 });
  });
});

describe("cancelRaid (DIED)", () => {
  it("clears pending only, leaving have untouched", () => {
    const result = cancelRaid({ "item-a": 1 });
    expect(result.have).toEqual({ "item-a": 1 });
    expect(result.pending).toEqual({});
  });
});

describe("upsertCustomItem", () => {
  const existing: CustomItemEntry = { id: "item-a", name: "Item A", iconLink: null, need: 2 };

  it("appends a new entry when the id isn't already tracked", () => {
    const result = upsertCustomItem(
      [existing],
      { id: "item-b", name: "Item B", iconLink: null },
      5,
    );
    expect(result).toEqual([existing, { id: "item-b", name: "Item B", iconLink: null, need: 5 }]);
  });

  it("updates need in place without duplicating when the id already exists", () => {
    const result = upsertCustomItem(
      [existing],
      { id: "item-a", name: "Item A", iconLink: null },
      9,
    );
    expect(result).toEqual([{ id: "item-a", name: "Item A", iconLink: null, need: 9 }]);
  });
});

describe("removeCustomItemEntry", () => {
  it("filters out the matching id, leaving others untouched", () => {
    const a: CustomItemEntry = { id: "item-a", name: "A", iconLink: null, need: 1 };
    const b: CustomItemEntry = { id: "item-b", name: "B", iconLink: null, need: 1 };
    expect(removeCustomItemEntry([a, b], "item-a")).toEqual([b]);
  });
});
