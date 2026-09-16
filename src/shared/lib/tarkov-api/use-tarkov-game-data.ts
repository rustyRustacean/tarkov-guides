"use client";

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import { TARKOV_GAME_DATA_QUERY_KEY } from "./constants";
import { fetchTarkovGameData } from "./fetch-tarkov-data";
import { mergeWithPreviousGameData } from "./merge-with-previous";
import { normalizeTarkovApiResponse } from "./normalize";

import type { TarkovGameData } from "./types";

/**
 * Fetches and normalizes the tarkov.dev dataset (items, tasks, hideout
 * stations, traders, maps, barters, crafts) that every game-data feature
 * in this app is built on. Replaces `old/TarkovTrackerWB-main`'s hand-rolled
 * `refreshData.js` fetch-plus-localStorage-cache with React Query; see
 * `src/app/providers.tsx` for the added cache persistence that replicates
 * legacy's instant-reload UX.
 *
 * Fetches from this app's own `/api/tarkov-data` proxy (`fetchTarkovGameData`,
 * `fetch-tarkov-data.ts`), not tarkov.dev directly: the proxy's server-side
 * cache is shared across every visitor, capping total upstream load at a
 * fixed constant regardless of traffic, instead of scaling with visitor
 * count the way a direct-from-browser fetch would. This client-side React
 * Query cache (plus its `localStorage` persistence, see `providers.tsx`) is
 * the second, complementary layer: it's what gives an individual visitor an
 * instant reload with zero network round-trip at all, even to our own proxy.
 *
 * Returns the plain `UseQueryResult` rather than a hand-rolled wrapper, so
 * callers get `.data`/`.isLoading`/`.isError`/`.error`/`.refetch()` for
 * free (per the conventions guide: don't hand-roll loading/error state
 * React Query already provides). Inherits the app-wide 1hr `staleTime`
 * default from `providers.tsx`, and additionally sets its own
 * `refetchInterval` (see the `useQuery` call below) so a tab left open on
 * a data-driven page, the maps page's live boss/raid data in particular,
 * doesn't go indefinitely stale just because it's never remounted or
 * refocused. Default retry (3x exponential backoff) is also left untouched,
 * a free improvement over legacy's zero-retry fetch.
 */
export function useTarkovGameData(): UseQueryResult<TarkovGameData> {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: TARKOV_GAME_DATA_QUERY_KEY,
    // Boss spawn chances/raid data can change per patch or live event, and
    // a long-open tab otherwise only refetches on remount/window-refocus.
    // This keeps a tab that's just sitting on the maps page in sync with
    // the proxy's own 12hr revalidation window instead of showing
    // arbitrarily old data indefinitely. Deliberately longer than the
    // app-wide 1hr `staleTime` (`providers.tsx`): each refetch re-downloads
    // the full ~7-10MB dataset, and Vercel's ISR cache is billed per KB
    // written, so polling faster than the server's own revalidation window
    // would just re-request the same still-cached response for nothing.
    refetchInterval: 12 * 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const raw = await fetchTarkovGameData(signal);
      const normalized = normalizeTarkovApiResponse(raw);
      const previous = queryClient.getQueryData<TarkovGameData>(TARKOV_GAME_DATA_QUERY_KEY);
      const merged = mergeWithPreviousGameData(normalized, previous);

      // Mirrors refreshData.js's final safety net: if both tasks and items
      // ended up empty even after merging with whatever was previously
      // cached, treat this as a failed refresh. React Query keeps serving
      // the last successful `data` when a queryFn throws, so this
      // surfaces as an error rather than silently rendering an empty
      // dataset with no explanation.
      if (merged.tasks.length === 0 && merged.items.length === 0) {
        throw new Error("tarkov.dev API returned no usable task/item data");
      }

      return merged;
    },
  });
}
