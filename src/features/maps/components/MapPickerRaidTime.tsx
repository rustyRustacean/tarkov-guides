"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getRaidTimes } from "../lib/raid-times";

import { MapTimes } from "./MapTimes";

interface Props {
  normalizedName: string;
}

/**
 * Raid/extract/player readout for the currently selected map: rendered as a
 * direct sibling of `TarkovClock` inside the shared card `MapsPage.tsx`
 * wraps both in (not its own separate card, an earlier version's), so
 * `divide-x` there draws a divider between them only when both are actually
 * present, without either owning that divider itself. A self-contained
 * component that reads live game data itself (the same pattern
 * `MapBossStrips` uses).
 */
export function MapPickerRaidTime({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const map = maps.find((m) => m.normalizedName === normalizedName);

  const raidTimes = getRaidTimes(map);
  const hasRaidTimes = raidTimes.raidMinutes !== null || raidTimes.players !== null;

  if (!hasRaidTimes) return null;

  return <MapTimes raidTimes={raidTimes} />;
}
