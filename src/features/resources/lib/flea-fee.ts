import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";
import { isMoneyItem } from "@/shared/lib/flea-market/item-predicates";

import type { ProfileMode } from "@/features/progress-tracker/types";
import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

/** The flea 24h average price in a mode's own market, or `null` when tarkov.dev has none. */
export function fleaPriceForMode(item: NormalizedItem, mode: ProfileMode): number | null {
  if (mode === "PVE") return item.avg24hPve;
  if (mode === "PVP_SEASONAL") return item.avg24hSeason;
  return item.avg24hPrice;
}

/** True when tarkov.dev tags the item as not listable on the flea market. */
export function isFleaBanned(item: NormalizedItem): boolean {
  return item.types.includes("noFlea");
}

/**
 * Items whose name or short name match `query`, prefix matches first, then
 * any other match, each in data order. Skips items with no base price (the
 * fee formula needs one) and currency, which is never listed.
 */
export function searchFeeItems(
  items: readonly NormalizedItem[],
  query: string,
  limit = 8,
): readonly NormalizedItem[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const starts: NormalizedItem[] = [];
  const contains: NormalizedItem[] = [];
  for (const item of items) {
    if (item.basePrice <= 0 || isMoneyItem(item)) continue;
    const name = item.name.toLowerCase();
    const short = item.shortName.toLowerCase();
    if (name.startsWith(term) || short.startsWith(term)) starts.push(item);
    else if (name.includes(term) || short.includes(term)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The numbers one flea sale works out to. */
export interface FleaSaleSummary {
  /** Total listing fee for the whole stack, in roubles. */
  fee: number;
  /** What the seller keeps after the fee, never negative. */
  net: number;
  /** List price times quantity. */
  gross: number;
  /** `fee / gross`, 0 when nothing is being sold. */
  feeShare: number;
}

/**
 * The fee and proceeds for listing `quantity` of an item at `listPrice`
 * each. Uses the shared fee formula, so like it this ignores the Intel
 * Center and Hideout Management discounts.
 */
export function summarizeFleaSale(
  basePrice: number,
  listPrice: number,
  quantity: number,
): FleaSaleSummary {
  const count = Math.max(1, Math.floor(quantity));
  const fee = calculateFleaTax(basePrice, listPrice, count);
  const net = calculateFleaNet(basePrice, listPrice, count);
  const gross = listPrice * count;
  return { fee, net, gross, feeShare: gross > 0 ? fee / gross : 0 };
}
