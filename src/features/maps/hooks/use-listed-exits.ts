"use client";

import { useMemo } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useExitSnipStore } from "../exit-snip-store";
import { tabForRaidLocation } from "../lib/raid-location";

import type { AppliedExit } from "../lib/exit-snip";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

const NONE: readonly AppliedExit[] = [];

/**
 * The exits the last exit list snip named, for one map tab. Empty unless the
 * snip was read in a raid on that very map: an exit is never drawn on a map it
 * was not read for.
 */
export function useListedExits(normalizedName: string): readonly AppliedExit[] {
  const { data } = useTarkovGameData();
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);
  const snip = useExitSnipStore((state) => state.snip);
  return useMemo(() => {
    if (snip === null) return NONE;
    return tabForRaidLocation(snip.nameId, maps) === normalizedName ? snip.exits : NONE;
  }, [snip, maps, normalizedName]);
}
