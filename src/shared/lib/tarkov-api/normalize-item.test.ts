import { describe, expect, it } from "vitest";

import { buildPveIndex, normalizeItem } from "./normalize-item";

import type { RawItem, RawItemPve } from "./types";

function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-1",
    name: "LEDX Skin Transilluminator",
    shortName: "LEDX",
    iconLink: "https://example.com/ledx.png",
    wikiLink: "https://example.com/wiki/ledx",
    basePrice: 100_000,
    avg24hPrice: 350_000,
    lastLowPrice: 340_000,
    changeLast48hPercent: 1.2,
    width: 1,
    height: 1,
    types: ["barter", "meds"],
    sellFor: [],
    buyFor: [],
    ...overrides,
  };
}

describe("buildPveIndex", () => {
  it("keys entries by item id", () => {
    const pveItems: readonly RawItemPve[] = [
      { id: "item-1", avg24hPrice: 400_000, lastLowPrice: 390_000, changeLast48hPercent: 2 },
    ];
    const index = buildPveIndex(pveItems);
    expect(index.get("item-1")).toEqual({ avg24hPve: 400_000, lastLowPve: 390_000, changePve: 2 });
    expect(index.get("missing")).toBeUndefined();
  });
});

describe("normalizeItem", () => {
  it("falls back to null PvE fields when no PvE entry exists", () => {
    const result = normalizeItem(makeRawItem(), new Map());
    expect(result.avg24hPve).toBeNull();
    expect(result.lastLowPve).toBeNull();
    expect(result.changePve).toBeNull();
  });

  it("merges the matching PvE entry", () => {
    const pveIndex = new Map([
      ["item-1", { avg24hPve: 400_000, lastLowPve: 390_000, changePve: 2 }],
    ]);
    const result = normalizeItem(makeRawItem(), pveIndex);
    expect(result.avg24hPve).toBe(400_000);
  });

  it("excludes the flea market vendor and zero/negative prices from best trader sell/buy", () => {
    const rawItem = makeRawItem({
      sellFor: [
        { priceRUB: 999_999, vendor: { name: "Flea Market", normalizedName: "flea-market" } },
        { priceRUB: 200_000, vendor: { name: "Therapist", normalizedName: "therapist" } },
        { priceRUB: 250_000, vendor: { name: "Prapor", normalizedName: "prapor" } },
        { priceRUB: 0, vendor: { name: "Skier", normalizedName: "skier" } },
      ],
      buyFor: [
        {
          priceRUB: 1,
          currency: "RUB",
          vendor: { name: "Flea Market", normalizedName: "flea-market" },
        },
        {
          priceRUB: 500_000,
          currency: "RUB",
          vendor: { name: "Peacekeeper", normalizedName: "peacekeeper", minTraderLevel: 2 },
        },
        {
          priceRUB: 480_000,
          currency: "RUB",
          vendor: { name: "Mechanic", normalizedName: "mechanic", minTraderLevel: 1 },
        },
      ],
    });
    const result = normalizeItem(rawItem, new Map());

    // Best sell = highest non-flea priceRUB (250k, Prapor), not the flea entry (999,999).
    expect(result.traderSell).toBe(250_000);
    expect(result.traderSellVendor).toBe("Prapor");
    // Best buy = lowest non-flea priceRUB (480k, Mechanic), not the flea entry (1).
    expect(result.traderBuy).toBe(480_000);
    expect(result.traderBuyVendor).toBe("Mechanic");
  });

  it("builds a buyOffers entry per non-flea trader with unlock/limit defaults", () => {
    const rawItem = makeRawItem({
      buyFor: [
        {
          priceRUB: 1,
          currency: "RUB",
          vendor: { name: "Flea Market", normalizedName: "flea-market" },
        },
        {
          priceRUB: 500_000,
          currency: "RUB",
          vendor: {
            name: "Peacekeeper",
            normalizedName: "peacekeeper",
            minTraderLevel: 2,
            taskUnlock: { id: "task-1", name: "Operation Aquarius" },
            buyLimit: 3,
          },
        },
        {
          priceRUB: 480_000,
          currency: "RUB",
          vendor: { name: "Mechanic", normalizedName: "mechanic" },
        },
      ],
    });
    const result = normalizeItem(rawItem, new Map());

    expect(result.buyOffers).toHaveLength(2);
    expect(result.buyOffers[0]).toEqual({
      vendor: "Peacekeeper",
      vendorKey: "peacekeeper",
      priceRUB: 500_000,
      minTraderLevel: 2,
      taskUnlockId: "task-1",
      taskUnlockName: "Operation Aquarius",
      buyLimit: 3,
    });
    // Missing minTraderLevel/taskUnlock/buyLimit default to 1/''/0.
    expect(result.buyOffers[1]).toEqual({
      vendor: "Mechanic",
      vendorKey: "mechanic",
      priceRUB: 480_000,
      minTraderLevel: 1,
      taskUnlockId: "",
      taskUnlockName: "",
      buyLimit: 0,
    });
  });

  it("returns 0/empty-string for traderSell/traderBuy when there are no trader offers at all", () => {
    const result = normalizeItem(makeRawItem({ sellFor: [], buyFor: [] }), new Map());
    expect(result.traderSell).toBe(0);
    expect(result.traderSellVendor).toBe("");
    expect(result.traderBuy).toBe(0);
    expect(result.traderBuyVendor).toBe("");
    expect(result.buyOffers).toEqual([]);
  });

  it("defaults width/height to 1 when the API returns 0", () => {
    const result = normalizeItem(makeRawItem({ width: 0, height: 0 }), new Map());
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});
