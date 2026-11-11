import { joinMobsAcrossModes } from "./mob-loadouts";

import type {
  JsonApiBartersData,
  JsonApiCraftsData,
  JsonApiHideoutData,
  JsonApiItem,
  JsonApiItemsData,
  JsonApiMap,
  JsonApiMapBoss,
  JsonApiMapSwitch,
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
  RawBossSpawnTiming,
  RawCraft,
  RawFinishRewards,
  RawGroundPoint,
  RawHideoutStation,
  RawItem,
  RawItemModePrices,
  RawItemRef,
  RawMap,
  RawMapBoss,
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
  /** Seasonal PvP items, read for their flea prices only (like `itemsPve`). */
  itemsSeason: JsonApiItemsData;
  tasks: JsonApiTasksData;
  /** PvE-tagged tasks: real, distinct data (not just a price overlay like `itemsPve`), since PvE can have different requirements/rewards or PvE-exclusive tasks. */
  tasksPve: JsonApiTasksData;
  /** Seasonal PvP tasks: tarkov.dev's `pvp-season` game mode, a subset of the regular list. */
  tasksSeason: JsonApiTasksData;
  traders: JsonApiTradersData;
  hideout: JsonApiHideoutData;
  maps: JsonApiMapsData;
  /** PvE maps, read for their boss rosters only (see `joinMaps`). */
  mapsPve: JsonApiMapsData;
  /** Seasonal PvP maps, read for their boss rosters only. */
  mapsSeason: JsonApiMapsData;
  barters: JsonApiBartersData;
  crafts: JsonApiCraftsData;
}

/**
 * `giveItem`/`findItem`/`plantItem`/`sellItem` are the only objective types
 * carrying a real hoard-or-hand-over item; see `JsonApiTaskObjective.items`'s
 * doc comment for why only `items[0]` is used.
 */
const ITEM_SET_OBJECTIVE_TYPES = new Set(["findItem", "giveItem", "plantItem", "sellItem"]);

/**
 * Resolves an item id back into the embedded-object shape GraphQL used to
 * hand back directly. Falls back to using the id itself as a visible
 * placeholder name (rather than throwing) for a dangling reference. This
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

/** Resolves a trader id into the `{id, name, imageLink}` shape every reward bucket that names a trader needs, same fallback convention as `toItemRef` for a dangling reference. */
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
    // real item) can come back `undefined` rather than an empty array.
    // Trust nothing's guaranteed present just because the sampled payloads
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

/** One mode's flea prices per item (the PvE or Seasonal overlay), nothing else. */
function joinItemPrices(modeItemsData: JsonApiItemsData): readonly RawItemModePrices[] {
  return Object.values(modeItemsData.items).map((item) => ({
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

function toExtractFaction(faction: string): "pmc" | "scav" | "shared" {
  return faction === "scav" || faction === "shared" ? faction : "pmc";
}

function toHazardType(type: string): "minefield" | "sniper" | "hazard" {
  return type === "minefield" || type === "sniper" ? type : "hazard";
}

/**
 * Copies each map switch's untranslated name key into `nameKey`, in place.
 * Pass it as the maps fetch's `beforeTranslate`: the translation replaces
 * `name` with the display name, and the key is the only link from a
 * switch-triggered boss spawn to its switch (see {@link switchNameFor}).
 */
export function keepSwitchNameKeys(data: JsonApiMapsData): void {
  for (const map of Object.values(data.maps)) {
    for (const mapSwitch of map.switches ?? []) {
      mapSwitch.nameKey = mapSwitch.name;
    }
  }
}

/**
 * The display name of the switch a boss spawn's trigger id points at, or
 * `null` when none of the map's switches matches. Upstream builds a switch's
 * name key as `switch_{gameSwitchId}_{objectName}` (stripping a leading
 * `switch_` from the id first), from the same game id a spawn's `switch_id`
 * carries, so the key's prefix identifies the switch. Every trigger matched
 * exactly one switch in all three modes on 2026-11-08, except two on Labs:
 * upstream leaves switches with no collider out of the list.
 */
function switchNameFor(
  switchId: string | undefined,
  switches: readonly JsonApiMapSwitch[],
): string | null {
  if (switchId === undefined) return null;
  const prefix = `switch_${switchId.replace(/^switch_/i, "")}`;
  const match = switches.find(
    ({ nameKey }) =>
      nameKey !== undefined && (nameKey === prefix || nameKey.startsWith(`${prefix}_`)),
  );
  return match?.name ?? null;
}

/**
 * From this spawn time on (in seconds), upstream's value is a placeholder for
 * a spawn the game scripts rather than times: `9999` on Ice Breaker and
 * `119999` on PvE Labyrinth (checked 2026-11-08). 9999 s is longer than any
 * raid, so nothing later can be a real timer either.
 */
const SCRIPTED_SPAWN_TIME = 9999;

/** A spawn's BSG `Time`/`RandomTimeSpawn` pair as one timing, or `undefined` when upstream ships no time. */
function toSpawnTiming(boss: JsonApiMapBoss): RawBossSpawnTiming | undefined {
  const { spawnTime } = boss;
  if (spawnTime === undefined) return undefined;
  if (spawnTime >= SCRIPTED_SPAWN_TIME) return { kind: "scripted" };
  if (boss.spawnTimeRandom === true) return { kind: "random" };
  if (spawnTime > 0) return { kind: "timed", seconds: spawnTime };
  return { kind: "start" };
}

/** One map's boss list, resolved against that same mode's `mobs` metadata and that map's switches. */
function joinBosses(
  bosses: readonly JsonApiMapBoss[] | undefined,
  mobsById: NonNullable<JsonApiMapsData["mobs"]>,
  switches: readonly JsonApiMapSwitch[],
): readonly RawMapBoss[] {
  return (bosses ?? []).map((boss) => {
    // `boss.mob` is a code (e.g. "bossGluhar"); resolve it to the display
    // name + portrait via the sibling `mobs` metadata. Fall back to the
    // raw code when a mob is missing from the lookup, so an unknown boss
    // still shows *something* readable rather than "undefined".
    const mob = mobsById[boss.mob];
    const spawnTiming = toSpawnTiming(boss);
    const triggered = Boolean(boss.spawnTrigger) || boss.switch_id !== undefined;
    return {
      mobId: boss.mob,
      name: mob?.name ?? boss.mob,
      normalizedName: mob?.normalizedName ?? boss.mob,
      imagePortraitLink: mob?.imagePortraitLink ?? null,
      spawnChance: boss.spawnChance,
      escorts: (boss.escorts ?? []).map((escort) => {
        const escortMob = mobsById[escort.mob];
        return {
          mobId: escort.mob,
          name: escortMob?.name ?? escort.mob,
          imagePortraitLink: escortMob?.imagePortraitLink ?? null,
          amounts: escort.amount ?? [],
        };
      }),
      ...(boss.spawnLocations
        ? {
            spawnZones: boss.spawnLocations.map((zone) => ({
              key: zone.spawnKey,
              name: zone.name,
              chance: zone.chance,
            })),
          }
        : {}),
      ...(spawnTiming ? { spawnTiming } : {}),
      ...(triggered
        ? { spawnTrigger: { switchName: switchNameFor(boss.switch_id, switches) } }
        : {}),
    };
  });
}

/**
 * Another mode's boss list for the same map entry (matched by map id), or
 * `undefined` when that mode's maps came back without it (e.g. its fetch
 * failed), so a consumer falls back to the regular `bosses`.
 */
function modeBosses(mapId: string, modeData: JsonApiMapsData): readonly RawMapBoss[] | undefined {
  const modeMap = modeData.maps[mapId];
  return modeMap
    ? joinBosses(modeMap.bosses, modeData.mobs ?? {}, modeMap.switches ?? [])
    : undefined;
}

/** A game-space coordinate to 0.1 m: plenty for a map marker, and a fraction of the raw digits. */
function roundToDecimeter(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The possible spawn spots of every boss spawn zone on one map, keyed by
 * zone key, gathered from each mode's entry for that map (pass `undefined`
 * for a mode that lacks it) and deduplicated after rounding.
 */
function bossSpawnSpotsFor(
  entries: readonly (JsonApiMap | undefined)[],
): Record<string, readonly RawGroundPoint[]> {
  const spots: Record<string, RawGroundPoint[]> = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const boss of entry?.bosses ?? []) {
      for (const zone of boss.spawnLocations ?? []) {
        for (const position of zone.positions ?? []) {
          const spot = { x: roundToDecimeter(position.x), z: roundToDecimeter(position.z) };
          const id = `${zone.spawnKey}|${String(spot.x)}|${String(spot.z)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          (spots[zone.spawnKey] ??= []).push(spot);
        }
      }
    }
  }
  return spots;
}

/**
 * The regular maps, each carrying its PvE and Seasonal boss rosters too.
 * Only bosses are taken from the other modes: on 2026-11-07 they were the
 * one thing that really differed per mode on the app's maps (extracts were
 * the same set, raid lengths only differed on unread variant entries). The
 * boss spawn spots are one dictionary across all three modes (see
 * `RawMap.bossSpawnSpots`).
 */
function joinMaps(
  mapsData: JsonApiMapsData,
  mapsPve: JsonApiMapsData,
  mapsSeason: JsonApiMapsData,
): readonly RawMap[] {
  const mobsById = mapsData.mobs ?? {};
  return Object.entries(mapsData.maps).map(([mapId, map]) => {
    const bossesPve = modeBosses(mapId, mapsPve);
    const bossesSeason = modeBosses(mapId, mapsSeason);
    const bossSpawnSpots = bossSpawnSpotsFor([map, mapsPve.maps[mapId], mapsSeason.maps[mapId]]);
    return {
      name: map.name,
      normalizedName: map.normalizedName,
      nameId: map.nameId ?? null,
      raidDuration: map.raidDuration,
      players: map.players,
      bosses: joinBosses(map.bosses, mobsById, map.switches ?? []),
      ...(bossesPve ? { bossesPve } : {}),
      ...(bossesSeason ? { bossesSeason } : {}),
      ...(Object.keys(bossSpawnSpots).length > 0 ? { bossSpawnSpots } : {}),
      extracts: (map.extracts ?? []).map((extract) => ({
        id: extract.id,
        name: extract.name,
        faction: toExtractFaction(extract.faction),
        position: extract.position ?? null,
      })),
      transits: (map.transits ?? []).map((transit) => ({
        id: transit.id,
        name: transit.description,
        toMap: mapsData.maps[transit.map]?.normalizedName ?? null,
        position: transit.position ?? null,
      })),
      // A zone with no usable outline can't be drawn or routed around, so it is
      // dropped here rather than carried as an empty polygon.
      hazards: (map.hazards ?? [])
        .filter((hazard) => hazard.outline !== null && hazard.outline.length >= 3)
        .map((hazard) => ({
          hazardType: toHazardType(hazard.hazardType),
          name: hazard.name,
          outline: (hazard.outline ?? []).map((point) => ({ x: point.x, z: point.z })),
        })),
    };
  });
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
      // old GraphQL `rewardItems` array. Wrapped in a 1-element array so
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

  // `findQuestItem`'s equivalent of `zones`, synthesized into the same
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
    hasHiddenRequirement: (task.otherRequirements ?? []).some(
      (requirement) => requirement.type === "globalVariable" || requirement.type === "dialogue",
    ),
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
 * `RawTarkovApiResponseData`, the exact shape GraphQL used to hand back
 * pre-joined, so every consumer downstream of `fetch-tarkov-data-upstream.ts`
 * (normalization, every feature) needs zero changes. The JSON API is fully
 * relational (bare id cross-references); this function is the one place
 * that resolves every one of those ids back into an embedded object.
 */
export function joinJsonApiData(resources: JsonApiFetchedResources): RawTarkovApiResponseData {
  const itemsById = new Map(Object.values(resources.items.items).map((item) => [item.id, item]));
  const tradersById = new Map(Object.entries(resources.traders));
  const mapsById = new Map(Object.entries(resources.maps.maps));
  // Merged across every mode's tasks (PvE-only entries included): items are
  // a single mode-agnostic catalog, and a buy offer's `taskUnlock` reference
  // should resolve to a real task name regardless of which mode that task
  // happens to live in.
  const tasksById = new Map([
    ...Object.entries(resources.tasks.tasks),
    ...Object.entries(resources.tasksPve.tasks),
    ...Object.entries(resources.tasksSeason.tasks),
  ]);
  const hideoutStationsById = new Map(
    Object.values(resources.hideout).map((station) => [
      station.id,
      { name: station.name, normalizedName: station.normalizedName },
    ]),
  );

  return {
    tasks: joinTasks(resources.tasks, itemsById, tradersById, mapsById),
    tasksPve: joinTasks(resources.tasksPve, itemsById, tradersById, mapsById),
    tasksSeason: joinTasks(resources.tasksSeason, itemsById, tradersById, mapsById),
    hideoutStations: joinHideoutStations(resources.hideout, itemsById),
    items: joinItems(resources.items, tradersById, tasksById),
    itemsPve: joinItemPrices(resources.itemsPve),
    itemsSeason: joinItemPrices(resources.itemsSeason),
    maps: joinMaps(resources.maps, resources.mapsPve, resources.mapsSeason),
    mobs: joinMobsAcrossModes([resources.maps, resources.mapsPve, resources.mapsSeason]),
    traders: joinTraders(resources.traders),
    barters: joinBarters(resources.barters, itemsById, tradersById),
    crafts: joinCrafts(resources.crafts, itemsById, hideoutStationsById),
  };
}
