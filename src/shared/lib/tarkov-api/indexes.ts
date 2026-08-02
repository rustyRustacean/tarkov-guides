import type {
  NormalizedItem,
  NormalizedTask,
  RawBarter,
  RawBarterCraftItemRef,
  RawCraft,
  RawHideoutStation,
} from "./types";

/**
 * Not part of `TarkovGameData` itself and never persisted - the default
 * persister serializer (`JSON.stringify`) silently turns a `Map` into
 * `{}`, and even a plain `Record` built once here would just be dead
 * weight in every persisted snapshot. Build these on demand (e.g. via
 * `useMemo`) from an already-fetched `TarkovGameData.items`/`.tasks` list
 * instead.
 */
export interface ItemIndexes {
  /** Item id → item. */
  byId: Readonly<Record<string, NormalizedItem>>;
  /** Lowercased shortName → item. First match wins on a collision, matching legacy's `ITEM_BY_SHORT`. */
  byShortName: Readonly<Record<string, NormalizedItem>>;
}

/** Builds `{byId, byShortName}` lookup tables. Ported from `refreshData.js`'s `indexItems`. */
export function buildItemIndexes(items: readonly NormalizedItem[]): ItemIndexes {
  const byId: Record<string, NormalizedItem> = {};
  const byShortName: Record<string, NormalizedItem> = {};
  for (const item of items) {
    byId[item.id] = item;
    const key = item.shortName.toLowerCase();
    if (key && !(key in byShortName)) {
      byShortName[key] = item;
    }
  }
  return { byId, byShortName };
}

export interface BarterCraftIndexes {
  /** Item id → barters that require it as an input. */
  barterInputs: Readonly<Record<string, readonly RawBarter[]>>;
  /** Item id → barters that reward it. */
  barterRewards: Readonly<Record<string, readonly RawBarter[]>>;
  /** Item id → crafts that require it as an input. */
  craftInputs: Readonly<Record<string, readonly RawCraft[]>>;
  /** Item id → crafts that reward it. */
  craftRewards: Readonly<Record<string, readonly RawCraft[]>>;
}

function pushByItemId<T>(
  index: Record<string, T[]>,
  itemRefs: readonly RawBarterCraftItemRef[],
  value: T,
): void {
  for (const ref of itemRefs) {
    const bucket = index[ref.item.id];
    if (bucket) {
      bucket.push(value);
    } else {
      index[ref.item.id] = [value];
    }
  }
}

/** Builds "what can I do with this item?" reverse indexes for barters and crafts. Ported from `refreshData.js`'s `indexBartersAndCrafts`. */
export function buildBarterCraftIndexes(
  barters: readonly RawBarter[],
  crafts: readonly RawCraft[],
): BarterCraftIndexes {
  const barterInputs: Record<string, RawBarter[]> = {};
  const barterRewards: Record<string, RawBarter[]> = {};
  const craftInputs: Record<string, RawCraft[]> = {};
  const craftRewards: Record<string, RawCraft[]> = {};

  for (const barter of barters) {
    pushByItemId(barterInputs, barter.requiredItems, barter);
    pushByItemId(barterRewards, barter.rewardItems, barter);
  }
  for (const craft of crafts) {
    pushByItemId(craftInputs, craft.requiredItems, craft);
    pushByItemId(craftRewards, craft.rewardItems, craft);
  }

  return { barterInputs, barterRewards, craftInputs, craftRewards };
}

/**
 * One hideout build step that consumes a given item, for "needed for
 * hideout level" lookups in an item-detail view. Flattens the nested
 * `station → level → itemRequirement` shape into a single row per
 * (station, level) that references the item.
 */
export interface HideoutItemUse {
  stationId: string;
  stationName: string;
  stationNormalizedName: string;
  level: number;
  count: number;
}

/**
 * Item id → hideout build steps that consume it. Ported in spirit from
 * legacy `refreshData.js`'s hideout item indexing (`HIDEOUT_ITEMS`), but
 * keyed by item id (like {@link buildBarterCraftIndexes}) rather than
 * shortName, since `RawHideoutItemRequirement` carries a full item ref.
 * A single (station, level) is pushed once per distinct item id it
 * requires - a level requiring the same item id twice (not observed in
 * real data, but cheap to guard) buckets it once.
 */
export function buildHideoutByItem(
  stations: readonly RawHideoutStation[],
): Readonly<Record<string, readonly HideoutItemUse[]>> {
  const index: Record<string, HideoutItemUse[]> = {};
  for (const station of stations) {
    for (const level of station.levels) {
      const seenItemIds = new Set<string>();
      for (const requirement of level.itemRequirements) {
        const id = requirement.item.id;
        if (!id || seenItemIds.has(id)) continue;
        seenItemIds.add(id);
        const use: HideoutItemUse = {
          stationId: station.id,
          stationName: station.name,
          stationNormalizedName: station.normalizedName,
          level: level.level,
          count: requirement.count,
        };
        const bucket = index[id];
        if (bucket) {
          bucket.push(use);
        } else {
          index[id] = [use];
        }
      }
    }
  }
  return index;
}

/**
 * Item shortName → tasks that require it, for "required by task" lookups
 * in an item-detail view. Ported from `refreshData.js`'s
 * `indexTasksByItem`: dedupes per task by shortName so a task referencing
 * the same shortName more than once (e.g. two differently-tracked items
 * that happen to share a shortName) doesn't get pushed into the same
 * bucket twice.
 */
export function buildTasksByItemShortName(
  tasks: readonly NormalizedTask[],
): Readonly<Record<string, readonly NormalizedTask[]>> {
  const index: Record<string, NormalizedTask[]> = {};
  for (const task of tasks) {
    const seenShortNames = new Set<string>();
    for (const requirement of task.itemRequirements) {
      const key = requirement.shortName;
      if (!key || seenShortNames.has(key)) continue;
      seenShortNames.add(key);
      const bucket = index[key];
      if (bucket) {
        bucket.push(task);
      } else {
        index[key] = [task];
      }
    }
  }
  return index;
}
