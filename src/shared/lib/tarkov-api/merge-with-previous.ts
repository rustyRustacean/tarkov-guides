import type { TarkovGameData } from "./types";

function nonEmpty<T>(fresh: readonly T[], previous: readonly T[] | undefined): readonly T[] {
  return fresh.length > 0 ? fresh : (previous ?? []);
}

/**
 * Per-section "don't let an API partial-outage nuke good cached data"
 * protection, ported from `refreshData.js`'s `nonEmpty` merge. tarkov.dev
 * has documented partial-translation outages that return
 * structurally-valid-but-empty arrays for one or more sections - this
 * keeps whichever previous non-empty value was already cached for any
 * section the fresh response came back empty on, instead of overwriting
 * good data with nothing.
 *
 * Reimplemented as an explicit pure function taking `previous` as a
 * parameter (rather than legacy's implicit `localStorage` read inside the
 * merge itself), so it's testable with plain objects and has no hidden
 * storage coupling - the caller (`useTarkovGameData`'s `queryFn`) supplies
 * the previous result via `queryClient.getQueryData`.
 */
export function mergeWithPreviousGameData(
  fresh: TarkovGameData,
  previous: TarkovGameData | undefined,
): TarkovGameData {
  return {
    tasks: nonEmpty(fresh.tasks, previous?.tasks),
    tasksPve: nonEmpty(fresh.tasksPve, previous?.tasksPve),
    hideoutStations: nonEmpty(fresh.hideoutStations, previous?.hideoutStations),
    items: nonEmpty(fresh.items, previous?.items),
    traders: nonEmpty(fresh.traders, previous?.traders),
    barters: nonEmpty(fresh.barters, previous?.barters),
    crafts: nonEmpty(fresh.crafts, previous?.crafts),
    maps: nonEmpty(fresh.maps, previous?.maps),
  };
}
