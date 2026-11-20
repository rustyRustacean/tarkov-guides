import { describe, expect, it } from "vitest";

import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";

import { makeNormalizedItem } from "../test-fixtures";

import { fleaPriceForMode, isFleaBanned, searchFeeItems, summarizeFleaSale } from "./flea-fee";

describe("fleaPriceForMode", () => {
  const item = makeNormalizedItem({ avg24hPrice: 100, avg24hPve: 200, avg24hSeason: 300 });

  it("reads each mode's own market", () => {
    expect(fleaPriceForMode(item, "PVP")).toBe(100);
    expect(fleaPriceForMode(item, "PVE")).toBe(200);
    expect(fleaPriceForMode(item, "PVP_SEASONAL")).toBe(300);
  });

  it("passes through a missing price as null", () => {
    expect(fleaPriceForMode(makeNormalizedItem(), "PVE")).toBeNull();
  });
});

describe("isFleaBanned", () => {
  it("reads tarkov.dev's noFlea type", () => {
    expect(isFleaBanned(makeNormalizedItem({ types: ["noFlea", "barter"] }))).toBe(true);
    expect(isFleaBanned(makeNormalizedItem({ types: ["barter"] }))).toBe(false);
  });
});

describe("searchFeeItems", () => {
  const items = [
    makeNormalizedItem({ id: "gpu", name: "Graphics card", shortName: "GPU" }),
    makeNormalizedItem({ id: "ledx", name: "LEDX Skin Transilluminator", shortName: "LEDX" }),
    makeNormalizedItem({ id: "old-gpu", name: "Broken GPhone", shortName: "GPhone" }),
    makeNormalizedItem({ id: "free", name: "Graphics stand", shortName: "Stand", basePrice: 0 }),
    makeNormalizedItem({ id: "rub", name: "Roubles", shortName: "RUB", types: ["money"] }),
  ];

  it("returns nothing for a blank query", () => {
    expect(searchFeeItems(items, "   ")).toEqual([]);
  });

  it("puts prefix matches before other matches, by name or short name", () => {
    expect(searchFeeItems(items, "gp").map((item) => item.id)).toEqual(["gpu", "old-gpu"]);
    expect(searchFeeItems(items, "skin").map((item) => item.id)).toEqual(["ledx"]);
  });

  it("skips items with no base price and currency", () => {
    expect(searchFeeItems(items, "graphics").map((item) => item.id)).toEqual(["gpu"]);
    expect(searchFeeItems(items, "rou")).toEqual([]);
  });

  it("stops at the limit", () => {
    expect(searchFeeItems(items, "g", 1)).toHaveLength(1);
  });
});

describe("summarizeFleaSale", () => {
  it("matches the shared fee formula for a stack", () => {
    const summary = summarizeFleaSale(10_000, 25_000, 3);
    expect(summary.fee).toBe(calculateFleaTax(10_000, 25_000, 3));
    expect(summary.net).toBe(calculateFleaNet(10_000, 25_000, 3));
    expect(summary.gross).toBe(75_000);
    expect(summary.feeShare).toBeCloseTo(summary.fee / 75_000);
  });

  it("treats a quantity below one as one", () => {
    expect(summarizeFleaSale(1000, 1000, 0)).toEqual(summarizeFleaSale(1000, 1000, 1));
  });
});
