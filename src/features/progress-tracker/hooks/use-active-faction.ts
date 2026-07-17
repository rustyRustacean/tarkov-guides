"use client";

import { useProgressTrackerStore } from "../store";

import type { ProfileFaction } from "../types";

/**
 * The active profile's faction, or `undefined` when no profile is active.
 * `ProfileProgress` has no faction field of its own (faction lives on
 * `Profile`) - every `getQuestAvailability`/`isQuestAvailable` call site
 * needs both, so this is the one shared lookup instead of each consumer
 * re-deriving its own `profiles.find(...)` (added 2026-07-16 task-data
 * audit, when faction gating was wired up for the first time).
 */
export function useActiveFaction(): ProfileFaction | undefined {
  return useProgressTrackerStore(
    (state) => state.profiles.find((profile) => profile.id === state.activeProfileId)?.faction,
  );
}
