"use client";

import { COMPANION_PROFILE_MAP_KEY } from "@/features/companion/companion-config";

import { STORAGE_KEY } from "./local-storage-adapter";

/**
 * Every browser key holding tracker profiles or their progress.
 *
 * Deliberately a short explicit list rather than "wipe anything starting
 * with `tarkovguides.`": the same origin also stores map drawings, theme,
 * and collaboration ids, which aren't what someone means by "clear my task
 * data".
 *
 * The companion's profile map is included because it points at tracker
 * profile ids that no longer exist; leaving it would make the companion
 * re-attach the game's character to a profile that isn't there.
 */
const PROGRESS_KEYS = [
  STORAGE_KEY,
  COMPANION_PROFILE_MAP_KEY,
  // The cached tarkov.dev responses. Not progress, but stale task/item data is
  // the other half of "my tasks look wrong", and it costs one refetch to drop.
  "tarkovguides.query-cache.v1",
] as const;

/**
 * Erase every profile and all of its progress from this browser.
 *
 * The store is reset by its caller; this removes what's on disk, so the
 * debounced auto-save has nothing to restore from and a reload comes up
 * empty. The companion's own on/off preferences are deliberately left
 * alone: clearing is usually meant to let the companion repopulate from
 * the game, which it can't do if this also turns it off.
 *
 * Never throws: a browser with storage disabled has nothing to clear anyway.
 */
export function clearStoredProgress(): void {
  if (typeof window === "undefined") return;
  for (const key of PROGRESS_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Private mode or storage disabled: nothing was persisted to begin with.
    }
  }
}
