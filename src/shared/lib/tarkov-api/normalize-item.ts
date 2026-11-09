import type {
  NormalizedItem,
  RawBuyForEntry,
  RawItem,
  RawItemModePrices,
  RawSellForEntry,
  TraderBuyOffer,
} from "./types";

const FLEA_MARKET_VENDOR = "flea-market";

/** One game mode's flea prices for an item (PvE or Seasonal). */
export interface ModePrices {
  avg24h: number | null;
  lastLow: number | null;
  change: number | null;
}

const NO_PRICES: ModePrices = { avg24h: null, lastLow: null, change: null };

/** Keyed by item id, for a single normalization pass: never returned/persisted (this is scratch state, not part of `TarkovGameData`). */
export function buildPriceIndex(
  entries: readonly RawItemModePrices[],
): ReadonlyMap<string, ModePrices> {
  const index = new Map<string, ModePrices>();
  for (const entry of entries) {
    index.set(entry.id, {
      avg24h: entry.avg24hPrice,
      lastLow: entry.lastLowPrice,
      change: entry.changeLast48hPercent,
    });
  }
  return index;
}

function isFleaMarket(vendorNormalizedName: string): boolean {
  return vendorNormalizedName === FLEA_MARKET_VENDOR;
}

/**
 * Best (highest) price a trader pays you for the item ("trader sell") and
 * cheapest (lowest) price a trader charges to buy it from them ("trader
 * buy"). The flea market is also a vendor in `sellFor`/`buyFor`, excluded
 * here since it's already covered by `avg24hPrice`/`lastLowPrice`.
 */
function computeBestTraderPrices(
  sellFor: readonly RawSellForEntry[],
  buyFor: readonly RawBuyForEntry[],
): {
  bestSell: RawSellForEntry | undefined;
  bestBuy: RawBuyForEntry | undefined;
} {
  let bestSell: RawSellForEntry | undefined;
  for (const entry of sellFor) {
    if (isFleaMarket(entry.vendor.normalizedName) || entry.priceRUB <= 0) continue;
    if (!bestSell || entry.priceRUB > bestSell.priceRUB) bestSell = entry;
  }
  let bestBuy: RawBuyForEntry | undefined;
  for (const entry of buyFor) {
    if (isFleaMarket(entry.vendor.normalizedName) || entry.priceRUB <= 0) continue;
    if (!bestBuy || entry.priceRUB < bestBuy.priceRUB) bestBuy = entry;
  }
  return { bestSell, bestBuy };
}

/** Every non-flea trader buy offer, with unlock requirements, so a "where to buy" list can show every option rather than just the cheapest. */
function buildBuyOffers(buyFor: readonly RawBuyForEntry[]): readonly TraderBuyOffer[] {
  return buyFor
    .filter((entry) => !isFleaMarket(entry.vendor.normalizedName) && entry.priceRUB > 0)
    .map((entry) => ({
      vendor: entry.vendor.name,
      vendorKey: entry.vendor.normalizedName,
      priceRUB: entry.priceRUB,
      minTraderLevel: entry.vendor.minTraderLevel ?? 1,
      taskUnlockId: entry.vendor.taskUnlock?.id ?? "",
      taskUnlockName: entry.vendor.taskUnlock?.name ?? "",
      buyLimit: entry.vendor.buyLimit ?? 0,
    }));
}

/**
 * Normalizes one raw tarkov.dev item into the shape the app consumes:
 * merges in its PvE and Seasonal prices, resolves best trader sell/buy
 * prices (excluding the flea market itself), and builds the full per-trader
 * buy-offer list. Ported from `refreshData.js`'s inline `slimItems` mapper.
 */
export function normalizeItem(
  rawItem: RawItem,
  pveIndex: ReadonlyMap<string, ModePrices>,
  seasonIndex: ReadonlyMap<string, ModePrices> = new Map(),
): NormalizedItem {
  const pve = pveIndex.get(rawItem.id) ?? NO_PRICES;
  const season = seasonIndex.get(rawItem.id) ?? NO_PRICES;
  const { bestSell, bestBuy } = computeBestTraderPrices(rawItem.sellFor, rawItem.buyFor);

  return {
    id: rawItem.id,
    name: rawItem.name,
    shortName: rawItem.shortName,
    iconLink: rawItem.iconLink,
    wikiLink: rawItem.wikiLink,
    basePrice: rawItem.basePrice,
    width: rawItem.width || 1,
    height: rawItem.height || 1,
    avg24hPrice: rawItem.avg24hPrice,
    lastLowPrice: rawItem.lastLowPrice,
    changeLast48hPercent: rawItem.changeLast48hPercent,
    types: rawItem.types,
    traderSell: bestSell ? bestSell.priceRUB : 0,
    traderSellVendor: bestSell ? bestSell.vendor.name : "",
    traderBuy: bestBuy ? bestBuy.priceRUB : 0,
    traderBuyVendor: bestBuy ? bestBuy.vendor.name : "",
    buyOffers: buildBuyOffers(rawItem.buyFor),
    avg24hPve: pve.avg24h,
    lastLowPve: pve.lastLow,
    changePve: pve.change,
    avg24hSeason: season.avg24h,
    lastLowSeason: season.lastLow,
    changeSeason: season.change,
  };
}
