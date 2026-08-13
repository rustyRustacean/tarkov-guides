import type { RawMap } from "@/shared/lib/tarkov-api/types";

export interface RaidTimes {
  raidMinutes: number | null;
  /** `raidMinutes - 7`, per legacy's exact spec: "earliest extraction time = 7 minutes lower than the total time allowed." `null` whenever `raidMinutes` is. */
  extractMinutes: number | null;
  players: string | null;
}

/**
 * Raid duration / earliest-extract / player-count for one map, ported from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `renderMapTimes`. Its sibling `renderRaidInfo` (a day/night raid-duration
 * pair, targeting a `#raid-info` element) is deliberately **not** ported:
 * `#raid-info` doesn't exist anywhere in the real `TarkovTrackerWB.html`
 * page, meaning `renderRaidInfo` is dead code that never actually rendered
 * in the live legacy UI. `renderMapTimes` (targeting the real, present
 * `#map-times` element) is the one genuine raid/extract widget.
 */
export function getRaidTimes(map: RawMap | undefined): RaidTimes {
  const raidMinutes =
    typeof map?.raidDuration === "number" && map.raidDuration > 0 ? map.raidDuration : null;
  const extractMinutes = raidMinutes !== null ? Math.max(0, raidMinutes - 7) : null;
  return { raidMinutes, extractMinutes, players: map?.players ?? null };
}
