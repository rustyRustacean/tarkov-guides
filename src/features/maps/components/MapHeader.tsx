"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getBossStripData } from "../lib/boss-groups";
import { getRaidTimes } from "../lib/raid-times";

import { BossStrip } from "./BossStrip";
import { MapTimes } from "./MapTimes";
import { MapVariantSwitcher } from "./MapVariantSwitcher";
import { TarkovClock } from "./TarkovClock";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's toolbar - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapHeader.js`, matching its `TarkovTrackerWB.html` layout:
 * variant switcher + raid/extract times + Day boss strip on the left, Night
 * boss strip + live in-game clock on the right. Self-contained - reads live
 * game data itself, matching this feature's other panel components (e.g.
 * `TaskMarkersLayer`).
 */
export function MapHeader({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const map = maps.find((m) => m.normalizedName === normalizedName);

  const raidTimes = getRaidTimes(map);
  const { day, night } = getBossStripData(normalizedName, maps);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
      <div className="flex flex-wrap items-center gap-4">
        <MapVariantSwitcher normalizedName={normalizedName} />
        <MapTimes raidTimes={raidTimes} />
        <BossStrip side={day} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <BossStrip side={night} />
        <TarkovClock />
      </div>
    </div>
  );
}
