import { fetchJsonApiResource, fetchTranslatedJsonResource } from "./fetch-json-resource";
import { joinJsonApiData } from "./join-json-api-data";

import type { JsonApiFetchedResources } from "./join-json-api-data";
import type {
  JsonApiBartersData,
  JsonApiCraftsData,
  JsonApiHideoutData,
  JsonApiItemsData,
  JsonApiMapsData,
  JsonApiTasksData,
  JsonApiTradersData,
} from "./json-api-types";
import type { RawTarkovApiResponseData } from "./types";

const EMPTY_ITEMS: JsonApiItemsData = { items: {} };
const EMPTY_TASKS: JsonApiTasksData = { tasks: {}, prestige: [] };
const EMPTY_TRADERS: JsonApiTradersData = {};
const EMPTY_HIDEOUT: JsonApiHideoutData = {};
const EMPTY_MAPS: JsonApiMapsData = { maps: {} };
const EMPTY_BARTERS: JsonApiBartersData = [];
const EMPTY_CRAFTS: JsonApiCraftsData = [];

/**
 * Fetches every tarkov.dev JSON API resource this app needs and joins them
 * back into `RawTarkovApiResponseData` - the shape the old GraphQL endpoint
 * used to hand back pre-joined in one request (`api.tarkov.dev/graphql` is
 * now down, `503 GraphQL server unavailable`; tarkov.dev's replacement is
 * this per-resource JSON API, see `json-api-constants.ts`). Error contract,
 * adapted from the old GraphQL version's "partial errors, keep going"
 * tolerance for this per-resource-fetch model:
 * - Each of the 9 resource fetches (6 translated + 2 untranslated + a
 *   PvE-price-only `items` fetch) runs independently via `Promise.allSettled`
 *   - one resource failing (a real possibility; this API is explicitly
 *     "still a work in progress" per tarkov.dev's own staff) doesn't sink
 *     the others.
 * - A rejected resource is substituted with an empty payload for that
 *   section rather than failing the whole fetch - `mergeWithPreviousGameData`
 *   (`use-tarkov-game-data.ts`) already exists specifically to fall back to
 *   whatever was previously cached for any section that comes back empty.
 * - Only throws if every single resource fails (mirrors the old "`data`
 *   entirely missing → throws" contract).
 *
 * The "both tasks and items ended up empty → throw, keep cached data"
 * safety net is NOT here - it needs the merged-with-previous result, not
 * just this raw fetch. See `use-tarkov-game-data.ts`.
 *
 * **Server-only** (2026-07-16 caching audit, unchanged by this migration):
 * called exclusively by `src/app/api/tarkov-data/route.ts`, never directly
 * from client code - see that route's doc comment for why (the combined
 * payload is too large for Next's per-fetch Data Cache, so the route's own
 * `revalidate` config is what actually caches it, shared across every
 * visitor).
 *
 * Named distinctly from `fetchTarkovGameData` (`fetch-tarkov-data.ts`, the
 * client's own entry point, which calls this route rather than tarkov.dev
 * directly) specifically so the two are never confused at a glance, and so
 * every existing test mocking the client-facing `fetchTarkovGameData` name
 * keeps working unmodified.
 *
 * @param signal - Forwarded from React Query's `QueryFunctionContext` for automatic in-flight-request cancellation on unmount/refetch.
 */
export async function fetchTarkovDataUpstream(
  signal?: AbortSignal,
): Promise<RawTarkovApiResponseData> {
  const settled = await Promise.allSettled([
    fetchTranslatedJsonResource<JsonApiItemsData>("items", "regular", signal),
    fetchJsonApiResource<JsonApiItemsData>("items", "pve", signal),
    fetchTranslatedJsonResource<JsonApiTasksData>("tasks", "regular", signal),
    // Tasks (unlike hideout/traders/maps, left "regular"-only for now) get a
    // real PvE-tagged fetch - per 2026-08 user direction: most tasks are
    // shared between PvP and PvE, but some have PvE-specific requirements or
    // are PvE-exclusive, so this is worth pulling distinctly, mirroring the
    // PvE-price `items` fetch above. Seasonal PvP has no equivalent - tarkov.dev's
    // `GameMode` enum is confirmed (against its live schema) to only have
    // `regular`/`pve`, no `season` value - so Seasonal transparently reuses
    // the "regular" tasks below (see `useActiveModeTasks`'s `isAccurateForMode`).
    fetchTranslatedJsonResource<JsonApiTasksData>("tasks", "pve", signal),
    fetchTranslatedJsonResource<JsonApiTradersData>("traders", "regular", signal),
    fetchTranslatedJsonResource<JsonApiHideoutData>("hideout", "regular", signal),
    fetchTranslatedJsonResource<JsonApiMapsData>("maps", "regular", signal),
    fetchJsonApiResource<JsonApiBartersData>("barters", "regular", signal),
    fetchJsonApiResource<JsonApiCraftsData>("crafts", "regular", signal),
  ]);
  const [items, itemsPve, tasks, tasksPve, traders, hideout, maps, barters, crafts] = settled;

  const rejections = settled.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (rejections.length === settled.length) {
    const firstReason: unknown = rejections[0]?.reason;
    throw firstReason instanceof Error
      ? firstReason
      : new Error("tarkov.dev JSON API returned no data");
  }
  if (rejections.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      "[tarkov-api] one or more JSON API resources failed, continuing with partial data:",
      rejections.map((result): unknown => result.reason),
    );
  }

  const resources: JsonApiFetchedResources = {
    items: items.status === "fulfilled" ? items.value : EMPTY_ITEMS,
    itemsPve: itemsPve.status === "fulfilled" ? itemsPve.value : EMPTY_ITEMS,
    tasks: tasks.status === "fulfilled" ? tasks.value : EMPTY_TASKS,
    tasksPve: tasksPve.status === "fulfilled" ? tasksPve.value : EMPTY_TASKS,
    traders: traders.status === "fulfilled" ? traders.value : EMPTY_TRADERS,
    hideout: hideout.status === "fulfilled" ? hideout.value : EMPTY_HIDEOUT,
    maps: maps.status === "fulfilled" ? maps.value : EMPTY_MAPS,
    barters: barters.status === "fulfilled" ? barters.value : EMPTY_BARTERS,
    crafts: crafts.status === "fulfilled" ? crafts.value : EMPTY_CRAFTS,
  };

  return joinJsonApiData(resources);
}
