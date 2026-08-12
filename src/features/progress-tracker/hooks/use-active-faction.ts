"use client";

import { useProgressTrackerStore } from "../store";
import { profileModeKey } from "../types";

import type { ProfileFaction } from "../types";

/**
 * The active profile's active-mode faction, or `undefined` when no profile
 * is active or the active mode isn't set up for it. Every
 * `getQuestAvailability`/`isQuestAvailable` call site needs both this and
 * the progress bucket, so this is the one shared lookup instead of each
 * consumer re-deriving it itself (added 2026-07-16 task-data audit, when
 * faction gating was wired up for the first time; faction moved from
 * `Profile` onto `ProfileProgress` in the 2026-08 game-mode rework, since
 * each mode is now its own character and can have its own faction).
 */
export function useActiveFaction(): ProfileFaction | undefined {
  return useProgressTrackerStore((state) => {
    if (state.activeProfileId === null) return undefined;
    return state.progressByProfile[profileModeKey(state.activeProfileId, state.activeMode)]
      ?.faction;
  });
}
