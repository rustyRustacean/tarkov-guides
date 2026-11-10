import { create } from "zustand";

import type { BossPillTone } from "./lib/boss-groups";
import type { BossSpawnSpot } from "./lib/boss-spawns";
import type { ProfileMode } from "@/features/progress-tracker/types";

/** One boss's possible spawn spots, drawn on the map by its card's "Show on map". */
export interface ShownBossSpawns {
  /** The map tab (`normalizedName`) they were shown on: game coordinates of that map only. */
  map: string;
  /** The game mode whose roster they came from. */
  mode: ProfileMode;
  /** The pill's name and face, for the markers and the chip. */
  name: string;
  imagePortraitLink: string | null;
  tone: BossPillTone;
  spots: readonly BossSpawnSpot[];
  /** Zones the boss can use that list no spots, highest chance first. */
  zonesWithoutSpots: readonly string[];
}

export interface BossSpawnState {
  /** What's drawn, or `null` for nothing. */
  shown: ShownBossSpawns | null;
  /** Replaces whatever was shown: one boss at a time. */
  show: (shown: ShownBossSpawns) => void;
  clear: () => void;
}

/**
 * The boss spawn spots drawn on the map. In-memory only, like the ruler and
 * the exit path: possible spots for one boss on one map mean nothing after a
 * reload. `useClearBossSpawnSpotsOnChange` drops them when the map tab or
 * game mode changes, and every reader goes through {@link shownBossSpawnsOn}
 * as well, so they can never be drawn on another map or for another mode.
 */
export const useBossSpawnStore = create<BossSpawnState>((set) => ({
  shown: null,
  show(shown) {
    set({ shown });
  },
  clear() {
    set({ shown: null });
  },
}));

/** What's shown, as seen on `map` in `mode`: `null` when nothing is, or it belongs to another map or mode. */
export function shownBossSpawnsOn(
  state: BossSpawnState,
  map: string,
  mode: ProfileMode,
): ShownBossSpawns | null {
  const { shown } = state;
  return shown?.map === map && shown.mode === mode ? shown : null;
}
