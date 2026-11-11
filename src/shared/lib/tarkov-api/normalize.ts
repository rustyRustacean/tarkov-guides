import { buildPriceIndex, normalizeItem } from "./normalize-item";
import { normalizeTask } from "./normalize-task";

import type { RawTarkovApiResponseData, TarkovGameData } from "./types";

/**
 * Transforms the raw tarkov.dev GraphQL response into the shape the app
 * consumes. Only `items` and `tasks` need real transformation (PvE-price
 * merge/trader-price computation for items; item-requirement dedup for
 * tasks). `hideoutStations`/`traders`/`barters`/`crafts`/`maps` are
 * already exactly the shape the query selected, so they pass through
 * unchanged.
 */
export function normalizeTarkovApiResponse(data: RawTarkovApiResponseData): TarkovGameData {
  const pveIndex = buildPriceIndex(data.itemsPve);
  const seasonIndex = buildPriceIndex(data.itemsSeason);

  return {
    tasks: data.tasks.map(normalizeTask),
    tasksPve: data.tasksPve.map(normalizeTask),
    tasksSeason: data.tasksSeason.map(normalizeTask),
    hideoutStations: data.hideoutStations,
    items: data.items.map((item) => normalizeItem(item, pveIndex, seasonIndex)),
    traders: data.traders,
    barters: data.barters,
    crafts: data.crafts,
    maps: data.maps,
    mobs: data.mobs,
  };
}
