"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getBossStripData } from "../lib/boss-groups";

import { BossStrip } from "./BossStrip";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's toolbar - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapHeader.js`, matching its `TarkovTrackerWB.html` layout:
 * Day boss strip on the left, Night boss strip on the right. (The raid/
 * extract times block that used to sit here lives in `MapPickerRaidTime`
 * now, up in the map-picker row - see `MapsPage.tsx`.) Self-contained (reads
 * live game data itself, matching this feature's other panel components,
 * e.g. `TaskMarkersLayer`). The variant switcher and fullscreen toggle live
 * outside this toolbar entirely - they overlay the map viewport itself
 * instead (see `MapScreenLayout.tsx`) - and the live in-game clock
 * (`TarkovClock`) lives up in the map-picker row alongside
 * `MapPickerRaidTime` (see `MapsPage.tsx`), so a map with no boss data (e.g.
 * a fresh/unsourced map) doesn't render this toolbar at all.
 */
export function MapHeader({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];

  const { day, night } = getBossStripData(normalizedName, maps);
  const hasBosses = (day?.pills.length ?? 0) > 0 || (night?.pills.length ?? 0) > 0;

  if (!hasBosses) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
      <div className="flex flex-wrap items-center gap-4">
        <BossStrip side={day} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <BossStrip side={night} />
      </div>
    </div>
  );
}
