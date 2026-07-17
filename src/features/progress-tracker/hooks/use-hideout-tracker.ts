"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { toast } from "@/shared/ui/toast/toast-store";

import { toggleHideoutBuiltPatch } from "../lib/hideout";
import { useProgressTrackerStore } from "../store";
import { hideoutBuiltKey } from "../types";

export interface UseHideoutTrackerResult {
  /** Toggles one level's built state - building cascades down through every lower level of the same station; un-building only undoes the exact level clicked. Never blocked by lock status: matches confirmed legacy "catch up" behavior where clicking a locked level force-completes it. */
  toggleLevel: (stationNormalizedName: string, stationName: string, level: number) => void;
  /** Sets this level as the hideout goal, or clears it if it already is (only one goal at a time). */
  toggleGoal: (stationNormalizedName: string, stationName: string, level: number) => void;
}

/**
 * Hideout build-toggle and goal picker, ported from
 * `old/TarkovTrackerWB-main/src/components/hideout/hideoutGoal.js` +
 * `lib/tarkovData.js`'s `toggleHideoutBuilt`/`setHideoutGoal`. Not a
 * `useUndoableState` consumer - the Phase 4 plan's undo-hook table only
 * names task actions/kappa/raid-commit, and legacy has no undo stack here
 * either. Toast copy is deliberately simple ("Built: X L2"), not legacy's
 * dynamic "explains what unlocked next" narrative - matches this
 * project's established simpler-toast convention (`use-raid-commit.ts`,
 * `use-kappa-tracker.ts`).
 */
export function useHideoutTracker(): UseHideoutTrackerResult {
  const { data } = useTarkovGameData();
  const stationsData = data?.hideoutStations;
  const stations = stationsData ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const replaceHideoutBuilt = useProgressTrackerStore((state) => state.replaceHideoutBuilt);
  const setHideoutGoal = useProgressTrackerStore((state) => state.setHideoutGoal);

  function toggleLevel(stationNormalizedName: string, stationName: string, level: number): void {
    if (!progress) return;
    const wasBuilt = progress.hideoutBuilt[hideoutBuiltKey(stationNormalizedName, level)] === true;
    replaceHideoutBuilt(
      toggleHideoutBuiltPatch(stations, progress.hideoutBuilt, stationNormalizedName, level),
    );
    toast({ message: `${wasBuilt ? "Un-built" : "Built"}: ${stationName} L${String(level)}` });
  }

  function toggleGoal(stationNormalizedName: string, stationName: string, level: number): void {
    if (!progress) return;
    const isCurrentGoal =
      progress.hideoutGoal?.stationNormalizedName === stationNormalizedName &&
      progress.hideoutGoal.level === level;
    setHideoutGoal(isCurrentGoal ? null : { stationNormalizedName, level });
    toast({
      message: isCurrentGoal ? "Goal cleared" : `Goal set: ${stationName} L${String(level)}`,
    });
  }

  return { toggleLevel, toggleGoal };
}
