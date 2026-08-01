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
 * Day and Night sides sit side by side and wrap under the map tabs on narrow
 * viewports instead of forcing horizontal scroll. Renders nothing for a map
 * with no boss data. Self-contained (reads live game data itself), matching
 * this feature's other panel components (e.g. `TaskMarkersLayer`).
 */
export function MapBossStrips({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];

  const { day, night } = getBossStripData(normalizedName, maps);
  const hasBosses = (day?.pills.length ?? 0) > 0 || (night?.pills.length ?? 0) > 0;

  if (!hasBosses) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <BossStrip side={day} />
      <BossStrip side={night} />
    </div>
  );
}
