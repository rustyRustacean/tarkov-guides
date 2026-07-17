import { ITEM_LOCATIONS } from "@/shared/data/item-locations";
import { isBarterOnly, isDogtag, isQuestTool } from "@/shared/lib/flea-market/item-predicates";
import { findItemLocationEntry } from "@/shared/lib/item-resolution/find-item-location-entry";

import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** An item is "map signature" once ≥ this many of a map's own quests reference it - ported from `old/TarkovTrackerWB-main/src/components/maps/valuables.js`'s `QUEST_SIGNATURE_MIN`. */
export const QUEST_SIGNATURE_MIN = 2;

/** Ported from `valuables.js`'s `TOP_DOLLAR_THRESHOLD_DEFAULT`. */
export const DEFAULT_TOP_DOLLAR_THRESHOLD_RUB = 45_000;

export interface ValuableItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  avg24hPrice: number | null;
  lastLowPrice: number | null;
  changeLast48hPercent: number | null;
  traderSell: number;
  traderSellVendor: string;
  /** From `ITEM_LOCATIONS.<key>.perMap[normalizedName]`, `null` when uncurated for this map. */
  locationHint: string | null;
  /** How many of this map's own quests reference the item - only set on Map Signature rows. */
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
    avg24hPrice: item.avg24hPrice,
    lastLowPrice: item.lastLowPrice,
    changeLast48hPercent: item.changeLast48hPercent,
    traderSell: item.traderSell,
    traderSellVendor: item.traderSellVendor,
    locationHint,
  };
  return refs === undefined ? base : { ...base, refs };
}

/** Excludes quest tools and dogtags from an otherwise-barter-only item - the three-filter combination both Map Signature and Top Dollar apply. */
function isGrabbableValuable(item: NormalizedItem): boolean {
  return isBarterOnly(item) && !isQuestTool(item) && !isDogtag(item);
}

/**
 * `mapNormalizedName -> itemId -> refCount` (how many of that map's own
 * quests require the item) - ported from `old/TarkovTrackerWB-main/src/lib/
 * refreshData.js`'s `buildMapItemCounts`. Any-map tasks (`task.maps.length
 * === 0`) contribute to no map's count at all, matching legacy's
 * `(t.maps||[]).forEach` being a no-op for an empty array - a narrower
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
 * The Valuables panel's two sections for one map - ported from `old/
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
    seen.add(item.id);
    mapSignature.push(toValuableItem(item, normalizedName, refs));
  }
  mapSignature.sort((a, b) => (b.avg24hPrice ?? 0) - (a.avg24hPrice ?? 0));

  const topDollar: ValuableItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (!isGrabbableValuable(item)) continue;
    if ((item.avg24hPrice ?? 0) < thresholdRub) continue;
    topDollar.push(toValuableItem(item, normalizedName));
  }
  topDollar.sort((a, b) => (b.avg24hPrice ?? 0) - (a.avg24hPrice ?? 0));

  return { mapSignature, topDollar };
}
