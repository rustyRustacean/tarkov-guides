import { MAP_NORMALIZED_NAMES } from "./map-config";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

/**
 * Sub-locations the game treats as their own place but this app shows on a
 * single tab. Keyed by the upstream `normalizedName` that has no tab of its
 * own, valued by the tab it belongs to.
 *
 * Deliberately keyed on `normalizedName` rather than the raw internal id, so
 * the real id -> name mapping stays where it belongs (live API data) and this
 * table only records the handful of genuine same-map-different-preset cases:
 * Factory's night preset, Ground Zero's level-gated and tutorial variants, and
 * the Lab's dark preset. Verified against live `json.tarkov.dev/regular/maps`.
 */
const TAB_FOR_SUBLOCATION: Readonly<Record<string, string>> = {
  "night-factory": "factory",
  "ground-zero-21": "ground-zero",
  "ground-zero-tutorial": "ground-zero",
  "the-lab-dark": "the-lab",
};

/**
 * The map tab an EFT internal location id belongs to, or `null` when it can't
 * be resolved.
 *
 * The companion reports positions tagged with the game's own location id (the
 * `Location:` field EFT writes into its logs, e.g. `"RezervBase"`,
 * `"factory4_night"`). Every map in the live API carries that same id as
 * `nameId`, so the lookup is real data rather than a hardcoded table; only
 * the few multi-preset locations above need folding onto a shared tab.
 *
 * Returning `null` is meaningful: callers must NOT fall back to "whatever map
 * is currently open". Plotting a Reserve position on Woods because that's the
 * open tab is exactly the bug this exists to prevent.
 */
export function tabForRaidLocation(nameId: string | null, maps: readonly RawMap[]): string | null {
  if (nameId === null || nameId.length === 0) return null;
  const key = nameId.toLowerCase();
  const match = maps.find((map) => map.nameId !== null && map.nameId.toLowerCase() === key);
  if (!match) return null;
  const resolved = TAB_FOR_SUBLOCATION[match.normalizedName] ?? match.normalizedName;
  return MAP_NORMALIZED_NAMES.includes(resolved) ? resolved : null;
}

/**
 * Whether a position captured at `nameId` may be drawn on the map tab
 * `currentNormalizedName`.
 *
 * An unresolvable location is never shown: a marker on the wrong map is worse
 * than no marker, since it reads as a real in-game position.
 */
export function positionBelongsOnMap(
  nameId: string | null,
  currentNormalizedName: string,
  maps: readonly RawMap[],
): boolean {
  const tab = tabForRaidLocation(nameId, maps);
  return tab !== null && tab === currentNormalizedName;
}
