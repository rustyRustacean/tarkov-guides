"use client";

import { useEffect } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useBossSpawnStore } from "../boss-spawn-store";
import { useMapsStore } from "../store";

/**
 * Drops the boss spawn spots drawn on the map as soon as the map tab or the
 * game mode changes, whatever changed it: the map tabs, a task's map jump,
 * the companion following a raid, a session host, a `?map=` link, or the
 * header's mode switch. The spots belong to one map and mode, and the chip
 * over the map says they'll go. Subscribing to the two stores (rather than
 * comparing on render) means none of those callers has to know about this.
 * Mounted once, by `MapsPage`.
 */
export function useClearBossSpawnSpotsOnChange(): void {
  useEffect(() => {
    const clear = (): void => {
      useBossSpawnStore.getState().clear();
    };
    const unsubscribeMap = useMapsStore.subscribe((state, previous) => {
      if (state.currentMap !== previous.currentMap) clear();
    });
    const unsubscribeMode = useProgressTrackerStore.subscribe((state, previous) => {
      if (state.activeMode !== previous.activeMode) clear();
    });
    return () => {
      unsubscribeMap();
      unsubscribeMode();
    };
  }, []);
}
