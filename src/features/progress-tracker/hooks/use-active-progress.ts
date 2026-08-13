"use client";

import { useProgressTrackerStore } from "../store";
import { profileModeKey } from "../types";

import type { ProfileProgress } from "../types";

/**
 * The active profile's progress bucket for the currently active mode, or
 * `undefined` when there's no active profile OR the active profile hasn't
 * set up the active mode yet (e.g. it only has a PvP bucket and the mode
 * switcher is on PvE). The one shared lookup: every progress-tracker
 * surface reads through this instead of re-deriving
 * `progressByProfile[profileModeKey(...)]` itself, since a profile can now
 * hold more than one progress bucket.
 */
export function useActiveProgress(): ProfileProgress | undefined {
  return useProgressTrackerStore((state) => {
    if (state.activeProfileId === null) return undefined;
    return state.progressByProfile[profileModeKey(state.activeProfileId, state.activeMode)];
  });
}
