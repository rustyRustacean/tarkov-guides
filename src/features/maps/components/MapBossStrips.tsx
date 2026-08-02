"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getBossStripData } from "../lib/boss-groups";

import { BossStrip } from "./BossStrip";

interface Props {
  normalizedName: string;
}

/**
 * The current map's boss roster, shown inline at the right end of the
 * map-picker row (see `MapsPage.tsx`) rather than on its own toolbar ledge -
 * one merged strip (no Day/Night split) that wraps under the map tabs on
 * narrow viewports instead of forcing horizontal scroll. Night-only and
 * level-gated bosses carry a corner glyph rather than a separate labeled
 * side. Renders nothing for a map with no boss data. Self-contained (reads
 * live game data itself), matching this feature's other panel components
 * (e.g. `TaskMarkersLayer`).
 */
export function MapBossStrips({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];

  const { pills } = getBossStripData(normalizedName, maps);

  if (pills.length === 0) return null;

  return <BossStrip pills={pills} />;
}
