"use client";

import { useProgressTrackerStore } from "../store";
import { profileModeKey } from "../types";

import type { ProfileFaction } from "../types";

/**
 * The active profile's active-mode faction, or `undefined` when no profile
 * is active or the active mode isn't set up for it. Every
 * `getQuestAvailability`/`isQuestAvailable` call site needs both this and
 * the progress bucket, so this is the one shared lookup instead of each
 * consumer re-deriving it. Faction lives on `ProfileProgress`, not
 * `Profile`, since each mode is its own character and can have its own
 * faction.
 */
export function useActiveFaction(): ProfileFaction | undefined {
  return useProgressTrackerStore((state) => {
    if (state.activeProfileId === null) return undefined;
    return state.progressByProfile[profileModeKey(state.activeProfileId, state.activeMode)]
      ?.faction;
  });
}
