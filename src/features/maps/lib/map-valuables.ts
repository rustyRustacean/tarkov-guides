import { ITEM_LOCATIONS } from "@/shared/data/item-locations";
import { isBarterOnly, isDogtag, isQuestTool } from "@/shared/lib/flea-market/item-predicates";
import { findItemLocationEntry } from "@/shared/lib/item-resolution/find-item-location-entry";

import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** An item is "map signature" once ≥ this many of a map's own quests reference it, ported from `old/TarkovTrackerWB-main/src/components/maps/valuables.js`'s `QUEST_SIGNATURE_MIN`. */
export const QUEST_SIGNATURE_MIN = 2;

/** Ported from `valuables.js`'s `TOP_DOLLAR_THRESHOLD_DEFAULT`. */
export const DEFAULT_TOP_DOLLAR_THRESHOLD_RUB = 45_000;

/**
 * Items that only spawn on specific maps, hidden from every other map's Top
 * Dollar. Hand-maintained: the item API carries no per-item spawn-map data,
 * and Top Dollar is otherwise map-agnostic. Matched by name (case-insensitive).
 */
export const MAP_EXCLUSIVE_ITEMS: readonly { pattern: RegExp; maps: readonly string[] }[] = [
  { pattern: /aceso xpress/i, maps: ["terminal", "icebreaker"] },
];

/** True when `item` is map-exclusive (per {@link MAP_EXCLUSIVE_ITEMS}) and `normalizedName` isn't one of its maps. */
function isExcludedFromMap(item: NormalizedItem, normalizedName: string): boolean {
  const rule = MAP_EXCLUSIVE_ITEMS.find((entry) => entry.pattern.test(item.name));
  return rule ? !rule.maps.includes(normalizedName) : false;
}

export interface ValuableItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  /** Item base price; drives the flea-tax / net-price calculation. */
  basePrice: number;
  /** PvP 24h average flea price. */
  avg24hPrice: number | null;
  /** PvP lowest recent flea listing. */
  lastLowPrice: number | null;
  /** PvP 48h price change, percent. */
  changeLast48hPercent: number | null;
  /** PvE 24h average flea price. */
  avg24hPve: number | null;
  /** PvE lowest recent flea listing. */
  lastLowPve: number | null;
  /** PvE 48h price change, percent. */
  changePve: number | null;
  /** Most a trader pays for it, and which trader. */
  traderSell: number;
  traderSellVendor: string;
  /** Cheapest a trader sells it to you, and which trader. */
  traderBuy: number;
  traderBuyVendor: string;
  /** From `ITEM_LOCATIONS.<key>.perMap[normalizedName]`, `null` when uncurated for this map. */
  locationHint: string | null;
  /** How many of this map's own quests reference the item; only set on Map Signature rows. */
  refs?: number;
}

function toValuableItem(item: NormalizedItem, normalizedName: string, refs?: number): ValuableItem {
  const locationHint =
    findItemLocationEntry(item, ITEM_LOCATIONS)?.entry.perMap[normalizedName] ?? null;
  const base: ValuableItem = {
    id: item.id,
    name: item.name,
    shortName: item.shortName,
    iconLink: item.iconLink,
    basePrice: item.basePrice,
    avg24hPrice: item.avg24hPrice,
    lastLowPrice: item.lastLowPrice,
    changeLast48hPercent: item.changeLast48hPercent,
    avg24hPve: item.avg24hPve,
    lastLowPve: item.lastLowPve,
    changePve: item.changePve,
    traderSell: item.traderSell,
    traderSellVendor: item.traderSellVendor,
    traderBuy: item.traderBuy,
    traderBuyVendor: item.traderBuyVendor,
    locationHint,
  };
  return refs === undefined ? base : { ...base, refs };
}

/** Excludes quest tools and dogtags from an otherwise-barter-only item; the three-filter combination both Map Signature and Top Dollar apply. */
function isGrabbableValuable(item: NormalizedItem): boolean {
  return isBarterOnly(item) && !isQuestTool(item) && !isDogtag(item);
}

/**
 * `mapNormalizedName -> itemId -> refCount` (how many of that map's own
 * quests require the item), ported from `old/TarkovTrackerWB-main/src/lib/
 * refreshData.js`'s `buildMapItemCounts`. Any-map tasks (`task.maps.length
 * === 0`) contribute to no map's count at all, matching legacy's
 * `(t.maps||[]).forEach` being a no-op for an empty array: a narrower
 * relevance rule than `map-sidebar-tasks.ts`'s `taskRelevantToMap`, which
 * treats any-map tasks as relevant everywhere.
 */
function countItemReferencesByMap(
  tasks: readonly NormalizedTask[],
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const task of tasks) {
    for (const map of task.maps) {
      let byItem = counts.get(map);
      if (!byItem) {
        byItem = new Map();
        counts.set(map, byItem);
      }
      for (const item of task.itemRequirements) {
        byItem.set(item.id, (byItem.get(item.id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export interface MapValuables {
  mapSignature: readonly ValuableItem[];
  topDollar: readonly ValuableItem[];
}

/**
 * The Valuables panel's two sections for one map, ported from `old/
 * TarkovTrackerWB-main/src/lib/flea.js`'s `getMapValuables`, kept as one
 * combined function (not two independent selectors) because Top Dollar must
 * exclude anything already surfaced in Map Signature, matching legacy's
 * `seen` set.
 */
export function getMapValuables(
  tasks: readonly NormalizedTask[],
  items: readonly NormalizedItem[],
  normalizedName: string,
  thresholdRub: number,
): MapValuables {
  const referenceCounts = countItemReferencesByMap(tasks).get(normalizedName);
  const seen = new Set<string>();

  const mapSignature: ValuableItem[] = [];
  for (const item of items) {
    const refs = referenceCounts?.get(item.id) ?? 0;
    if (refs < QUEST_SIGNATURE_MIN) continue;
    if (!isGrabbableValuable(item)) continue;
    if (isExcludedFromMap(item, normalizedName)) continue;
    seen.add(item.id);
    mapSignature.push(toValuableItem(item, normalizedName, refs));
  }
  mapSignature.sort((a, b) => (b.avg24hPrice ?? 0) - (a.avg24hPrice ?? 0));

  const topDollar: ValuableItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (!isGrabbableValuable(item)) continue;
    if (isExcludedFromMap(item, normalizedName)) continue;
    if ((item.avg24hPrice ?? 0) < thresholdRub) continue;
    topDollar.push(toValuableItem(item, normalizedName));
  }
  topDollar.sort((a, b) => (b.avg24hPrice ?? 0) - (a.avg24hPrice ?? 0));

  return { mapSignature, topDollar };
}

/**
 * Flea search across ALL items (not just this map's valuables), ported from
 * `old/TarkovTrackerWB-main/src/lib/flea.js`'s `fleaSearchMatch`. Comma-
 * separated terms are OR'd; name/shortName prefix matches rank ahead of
 * substring matches, capped at `limit`. Feeds the Flea Market pane while its
 * search box has a query; cleared, the pane falls back to {@link getMapValuables}.
 */
export function searchFleaItems(
  items: readonly NormalizedItem[],
  normalizedName: string,
  query: string,
  limit = 80,
): readonly ValuableItem[] {
  const terms = query
    .toLowerCase()
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];

  const starts: NormalizedItem[] = [];
  const contains: NormalizedItem[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    const short = item.shortName.toLowerCase();
    if (terms.some((term) => name.startsWith(term) || short.startsWith(term))) starts.push(item);
    else if (terms.some((term) => name.includes(term) || short.includes(term))) contains.push(item);
  }
  return [...starts, ...contains]
    .slice(0, limit)
    .map((item) => toValuableItem(item, normalizedName));
}
