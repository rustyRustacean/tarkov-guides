"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Card } from "@/shared/ui/card/Card";

import { getRaidTimes } from "../lib/raid-times";

import { MapTimes } from "./MapTimes";

interface Props {
  normalizedName: string;
}

/**
 * Raid/extract time card for the currently selected map - lives on the right
 * side of the map-picker row (`MapsPage.tsx`), directly above the
 * `MapScreenLayout` fullscreen toggle it's roughly stacked over. A
 * self-contained component that reads live game data itself (the same
 * pattern `MapBossStrips` uses), so it sits in the picker row independently
 * of the boss roster.
 */
export function MapPickerRaidTime({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const map = maps.find((m) => m.normalizedName === normalizedName);

  const raidTimes = getRaidTimes(map);
  const hasRaidTimes = raidTimes.raidMinutes !== null || raidTimes.players !== null;

  if (!hasRaidTimes) return null;

  return (
    <Card className="px-3 py-2">
      <MapTimes raidTimes={raidTimes} />
    </Card>
  );
}
