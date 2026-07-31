import type {
  JsonApiBartersData,
  JsonApiCraftsData,
  JsonApiHideoutData,
  JsonApiItem,
  JsonApiItemsData,
  JsonApiMap,
  JsonApiMapsData,
  JsonApiTask,
  JsonApiTaskObjective,
  JsonApiTaskRewards,
  JsonApiTasksData,
  JsonApiTrader,
  JsonApiTradersData,
} from "./json-api-types";
import type {
  RawBarter,
  RawCraft,
  RawFinishRewards,
  RawHideoutStation,
  RawItem,
  RawItemPve,
  RawItemRef,
  RawMap,
  RawRewardTraderRef,
  RawTarkovApiResponseData,
  RawTask,
  RawTaskObjective,
  RawTaskZone,
  RawTrader,
} from "./types";

/** Every JSON API resource this app needs, already fetched and translated (see `fetch-json-resource.ts`). */
export interface JsonApiFetchedResources {
  items: JsonApiItemsData;
  itemsPve: JsonApiItemsData;
  tasks: JsonApiTasksData;
  traders: JsonApiTradersData;
  hideout: JsonApiHideoutData;
  maps: JsonApiMapsData;
  barters: JsonApiBartersData;
  crafts: JsonApiCraftsData;
}

/**
 * `giveItem`/`findItem`/`plantItem`/`sellItem` are the only objective types
 * carrying a real hoard-or-hand-over item - see `JsonApiTaskObjective.items`'s
 * doc comment for why only `items[0]` is used.
 */
const ITEM_SET_OBJECTIVE_TYPES = new Set(["findItem", "giveItem", "plantItem", "sellItem"]);

/**
 * Resolves an item id back into the embedded-object shape GraphQL used to
 * hand back directly. Falls back to using the id itself as a visible
 * placeholder name (rather than throwing) for a dangling reference - this
 * API is explicitly "still a work in progress" per tarkov.dev's own staff,
 * so a missing cross-reference is a real possibility worth degrading
 * gracefully from, not a hard invariant to crash on.
 */
function toItemRef(itemsById: ReadonlyMap<string, JsonApiItem>, id: string): RawItemRef {
  const item = itemsById.get(id);
  return item
    ? { id: item.id, name: item.name, shortName: item.shortName, iconLink: item.iconLink }
    : { id, name: id, shortName: id, iconLink: null };
}

/** Resolves a trader id into the `{id, name, imageLink}` shape every reward bucket that names a trader needs - same fallback convention as `toItemRef` for a dangling reference. */
function toTraderRef(
  tradersById: ReadonlyMap<string, JsonApiTrader>,
  id: string,
): RawRewardTraderRef {
  const trader = tradersById.get(id);
  return { id, name: trader?.name ?? id, imageLink: trader?.imageLink ?? null };
}

function normalizedNameForMap(mapsById: ReadonlyMap<string, JsonApiMap>, id: string): string {
  return mapsById.get(id)?.normalizedName ?? id;
}

function zoneMapRef(
  mapsById: ReadonlyMap<string, JsonApiMap>,
  id: string | null,
): { normalizedName: string } | null {
  return id ? { normalizedName: normalizedNameForMap(mapsById, id) } : null;
}

// ─── items ───────────────────────────────────────────────────────────────

function joinItems(
  itemsData: JsonApiItemsData,
  tradersById: ReadonlyMap<string, JsonApiTrader>,
  tasksById: ReadonlyMap<string, JsonApiTask>,
): readonly RawItem[] {
  return Object.values(itemsData.items).map((item) => ({
    id: item.id,
    name: item.name,
    shortName: item.shortName,
    iconLink: item.iconLink,
    wikiLink: item.wikiLink,
    basePrice: item.basePrice,
    avg24hPrice: item.avg24hPrice,
    lastLowPrice: item.lastLowPrice,
    changeLast48hPercent: item.changeLast48hPercent,
    width: item.width,
    height: item.height,
    // Defensive `?? []` throughout this module: this API is explicitly
    // "still a work in progress" per tarkov.dev's own staff, and a real
    // live fetch confirmed at least one array field (`sellToTrader` on a
    // real item) can come back `undefined` rather than an empty array -
    // trust nothing's guaranteed present just because the sampled payloads
    // used to write these types happened to include it.
    types: item.types ?? [],
    sellFor: (item.sellToTrader ?? []).map((offer) => {
      const trader = tradersById.get(offer.trader);
      return {
        priceRUB: offer.priceRUB,
        vendor: {
          name: trader?.name ?? offer.trader,
          normalizedName: trader?.normalizedName ?? offer.trader,
        },
      };
    }),
    buyFor: (item.buyFromTrader ?? []).map((offer) => {
      const trader = tradersById.get(offer.trader);
      const taskUnlock = tasksById.get(offer.taskUnlock ?? "");
      return {
        priceRUB: offer.priceRUB,
        currency: offer.currency,
        vendor: {
          name: trader?.name ?? offer.trader,
          normalizedName: trader?.normalizedName ?? offer.trader,
          minTraderLevel: offer.minTraderLevel,
          taskUnlock: offer.taskUnlock
            ? { id: offer.taskUnlock, name: taskUnlock?.name ?? offer.taskUnlock }
            : null,
          buyLimit: offer.buyLimit,
        },
      };
    }),
  }));
}

function joinItemsPve(pveItemsData: JsonApiItemsData): readonly RawItemPve[] {
  return Object.values(pveItemsData.items).map((item) => ({
    id: item.id,
    avg24hPrice: item.avg24hPrice,
    lastLowPrice: item.lastLowPrice,
    changeLast48hPercent: item.changeLast48hPercent,
  }));
}

// ─── traders / maps (near-identical shape already, no join needed) ───────

function joinTraders(tradersData: JsonApiTradersData): readonly RawTrader[] {
  return Object.values(tradersData).map((trader) => ({
    id: trader.id,
    name: trader.name,
    normalizedName: trader.normalizedName,
    imageLink: trader.imageLink,
  }));
}

function joinMaps(mapsData: JsonApiMapsData): readonly RawMap[] {
  return Object.values(mapsData.maps).map((map) => ({
    name: map.name,
    normalizedName: map.normalizedName,
    raidDuration: map.raidDuration,
    players: map.players,
    bosses: (map.bosses ?? []).map((boss) => ({
      name: boss.name,
      spawnChance: boss.spawnChance,
      spawnLocations: (boss.spawnLocations ?? []).map((location) => ({
        name: location.name,
        chance: location.chance,
      })),
    })),
  }));
}

// ─── hideout ─────────────────────────────────────────────────────────────

function joinHideoutStations(
  hideoutData: JsonApiHideoutData,
  itemsById: ReadonlyMap<string, JsonApiItem>,
): readonly RawHideoutStation[] {
  const stations = Object.values(hideoutData);
  const normalizedNameById = new Map(
    stations.map((station) => [station.id, station.normalizedName]),
  );

  return stations.map((station) => ({
    id: station.id,
    name: station.name,
    normalizedName: station.normalizedName,
    levels: (station.levels ?? []).map((level) => ({
      level: level.level,
      itemRequirements: (level.itemRequirements ?? []).map((requirement) => ({
        item: toItemRef(itemsById, requirement.item),
        count: requirement.count,
      })),
      stationLevelRequirements: (level.stationLevelRequirements ?? []).map((requirement) => ({
        station: {
          normalizedName: normalizedNameById.get(requirement.station) ?? requirement.station,
        },
        level: requirement.level,
      })),
    })),
  }));
}

// ─── barters / crafts ──────────────────────────────────────────────────────

function joinBarters(
  bartersData: JsonApiBartersData,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  tradersById: ReadonlyMap<string, JsonApiTrader>,
): readonly RawBarter[] {
  return bartersData.map((barter) => {
    const trader = tradersById.get(barter.trader);
    return {
      id: barter.id,
      level: barter.level,
      trader: {
        name: trader?.name ?? barter.trader,
        normalizedName: trader?.normalizedName ?? barter.trader,
      },
      requiredItems: (barter.requiredItems ?? []).map((ref) => ({
        item: toItemRef(itemsById, ref.item),
        count: ref.count,
      })),
      // The new API models one reward per barter (`offeredItem`), unlike the
      // old GraphQL `rewardItems` array - wrapped in a 1-element array so
      // every existing consumer iterating `.rewardItems` keeps working.
      rewardItems: [
        { item: toItemRef(itemsById, barter.offeredItem.item), count: barter.offeredItem.count },
      ],
    };
  });
}

function joinCrafts(
  craftsData: JsonApiCraftsData,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  hideoutStationsById: ReadonlyMap<string, { name: string; normalizedName: string }>,
): readonly RawCraft[] {
  return craftsData.map((craft) => {
    const station = hideoutStationsById.get(craft.station);
    return {
      id: craft.id,
      level: craft.level,
      duration: craft.duration,
      station: {
        name: station?.name ?? craft.station,
        normalizedName: station?.normalizedName ?? craft.station,
      },
      requiredItems: (craft.requiredItems ?? []).map((ref) => ({
        item: toItemRef(itemsById, ref.item),
        count: ref.count,
      })),
      rewardItems: [
        { item: toItemRef(itemsById, craft.productItem.item), count: craft.productItem.count },
      ],
    };
  });
}

// ─── tasks ───────────────────────────────────────────────────────────────

function joinObjective(
  objective: JsonApiTaskObjective,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  mapsById: ReadonlyMap<string, JsonApiMap>,
): RawTaskObjective {
  const zones: RawTaskZone[] = (objective.zones ?? []).map((zone) => ({
    id: zone.id,
    map: zoneMapRef(mapsById, zone.map),
    position: zone.position,
  }));

  // `findQuestItem`'s equivalent of `zones` - synthesized into the same
  // shape (one zone per position) so quest-item objectives keep showing map
  // markers instead of silently losing them under the new field name.
  (objective.possibleLocations ?? []).forEach((location, locationIndex) => {
    location.positions.forEach((position, positionIndex) => {
      zones.push({
        id: `${objective.id}-${String(locationIndex)}-${String(positionIndex)}`,
        map: zoneMapRef(mapsById, location.map),
        position,
      });
    });
  });

  const representativeItemId = ITEM_SET_OBJECTIVE_TYPES.has(objective.type)
    ? objective.items?.[0]
    : undefined;

  return {
    id: objective.id,
    type: objective.type,
    description: objective.description,
    optional: objective.optional,
    maps: (objective.maps ?? []).map((id) => ({
      normalizedName: normalizedNameForMap(mapsById, id),
    })),
    ...(representativeItemId ? { item: toItemRef(itemsById, representativeItemId) } : {}),
    ...(objective.count !== undefined ? { count: objective.count } : {}),
    ...(objective.foundInRaid !== undefined ? { foundInRaid: objective.foundInRaid } : {}),
    ...(objective.markerItem ? { markerItem: toItemRef(itemsById, objective.markerItem) } : {}),
    ...(zones.length > 0 ? { zones } : {}),
  };
}

function joinRewards(
  rewards: JsonApiTaskRewards | null,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  tradersById: ReadonlyMap<string, JsonApiTrader>,
): RawFinishRewards | null {
  if (!rewards) return null;

  return {
    items: (rewards.items ?? []).map((reward) => {
      const item = itemsById.get(reward.item);
      return {
        item: { ...toItemRef(itemsById, reward.item), basePrice: item?.basePrice ?? 0 },
        count: reward.count,
      };
    }),
    traderStanding: (rewards.traderStanding ?? []).map((reward) => ({
      trader: toTraderRef(tradersById, reward.trader),
      standing: reward.standing,
    })),
    traderUnlock: (rewards.traderUnlock ?? []).map((traderId) => ({
      trader: toTraderRef(tradersById, traderId),
    })),
    offerUnlock: (rewards.offerUnlock ?? []).map((reward) => ({
      trader: toTraderRef(tradersById, reward.trader),
      level: reward.level,
      item: toItemRef(itemsById, reward.item),
    })),
    skillLevelReward: (rewards.skillLevelReward ?? []).map((reward) => ({
      name: reward.skill,
      level: reward.level,
    })),
  };
}

function joinTask(
  task: JsonApiTask,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  tradersById: ReadonlyMap<string, JsonApiTrader>,
  mapsById: ReadonlyMap<string, JsonApiMap>,
  prestigeLevelById: ReadonlyMap<string, number>,
): RawTask {
  const trader = tradersById.get(task.trader);
  const map = task.map ? mapsById.get(task.map) : undefined;

  return {
    id: task.id,
    name: task.name,
    kappaRequired: task.kappaRequired,
    minPlayerLevel: task.minPlayerLevel,
    experience: task.experience,
    wikiLink: task.wikiLink,
    factionName: task.factionName,
    taskImageLink: task.taskImageLink,
    availableDelaySecondsMin: task.availableDelaySecondsMin,
    availableDelaySecondsMax: task.availableDelaySecondsMax,
    restartable: task.restartable,
    lightkeeperRequired: task.lightkeeperRequired,
    requiredPrestige: task.requiredPrestige
      ? { prestigeLevel: prestigeLevelById.get(task.requiredPrestige) ?? 0 }
      : null,
    trader: {
      id: task.trader,
      name: trader?.name ?? task.trader,
      imageLink: trader?.imageLink ?? null,
    },
    map: task.map
      ? { name: map?.name ?? task.map, normalizedName: map?.normalizedName ?? task.map }
      : null,
    taskRequirements: (task.taskRequirements ?? []).map((requirement) => ({
      task: { id: requirement.task },
      status: requirement.status ?? [],
    })),
    traderRequirements: (task.traderRequirements ?? []).map((requirement) => {
      const requirementTrader = tradersById.get(requirement.trader);
      return {
        id: requirement.id,
        trader: { id: requirement.trader, name: requirementTrader?.name ?? requirement.trader },
        requirementType: requirement.requirementType,
        compareMethod: requirement.compareMethod,
        value: requirement.value,
      };
    }),
    objectives: (task.objectives ?? []).map((objective) =>
      joinObjective(objective, itemsById, mapsById),
    ),
    failConditions: (task.failConditions ?? []).map((objective) =>
      joinObjective(objective, itemsById, mapsById),
    ),
    startRewards: joinRewards(task.startRewards, itemsById, tradersById),
    finishRewards: joinRewards(task.finishRewards, itemsById, tradersById),
    failureOutcome: joinRewards(task.failureOutcome, itemsById, tradersById),
  };
}

function joinTasks(
  tasksData: JsonApiTasksData,
  itemsById: ReadonlyMap<string, JsonApiItem>,
  tradersById: ReadonlyMap<string, JsonApiTrader>,
  mapsById: ReadonlyMap<string, JsonApiMap>,
): readonly RawTask[] {
  const prestigeLevelById = new Map(
    (tasksData.prestige ?? []).map((tier) => [tier.id, tier.prestigeLevel]),
  );
  return Object.values(tasksData.tasks).map((task) =>
    joinTask(task, itemsById, tradersById, mapsById, prestigeLevelById),
  );
}

/**
 * Reshapes every fetched-and-translated JSON API resource back into
 * `RawTarkovApiResponseData` - the exact shape GraphQL used to hand back
 * pre-joined, so every consumer downstream of `fetch-tarkov-data-upstream.ts`
 * (normalization, every feature) needs zero changes. The JSON API is fully
 * relational (bare id cross-references); this function is the one place
 * that resolves every one of those ids back into an embedded object.
 */
export function joinJsonApiData(resources: JsonApiFetchedResources): RawTarkovApiResponseData {
  const itemsById = new Map(Object.values(resources.items.items).map((item) => [item.id, item]));
  const tradersById = new Map(Object.entries(resources.traders));
  const mapsById = new Map(Object.entries(resources.maps.maps));
  const tasksById = new Map(Object.entries(resources.tasks.tasks));
  const hideoutStationsById = new Map(
    Object.values(resources.hideout).map((station) => [
      station.id,
      { name: station.name, normalizedName: station.normalizedName },
    ]),
  );

  return {
    tasks: joinTasks(resources.tasks, itemsById, tradersById, mapsById),
    hideoutStations: joinHideoutStations(resources.hideout, itemsById),
    items: joinItems(resources.items, tradersById, tasksById),
    itemsPve: joinItemsPve(resources.itemsPve),
    maps: joinMaps(resources.maps),
    traders: joinTraders(resources.traders),
    barters: joinBarters(resources.barters, itemsById, tradersById),
    crafts: joinCrafts(resources.crafts, itemsById, hideoutStationsById),
  };
}
