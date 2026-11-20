import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

/** A complete `NormalizedItem` for tests, with only the fields under test overridden. */
export function makeNormalizedItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    wikiLink: null,
    basePrice: 10_000,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    traderSell: 0,
    traderSellVendor: "",
    traderBuy: 0,
    traderBuyVendor: "",
    buyOffers: [],
    avg24hPve: null,
    lastLowPve: null,
    changePve: null,
    avg24hSeason: null,
    lastLowSeason: null,
    changeSeason: null,
    ...overrides,
  };
}
