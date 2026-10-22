"use client";

import { useEffect, useMemo, useRef } from "react";

import { useExitPathStore } from "@/features/maps/exit-path-store";
import { useExitSnipStore } from "@/features/maps/exit-snip-store";
import { lookUpFreshSnip, shouldTriggerSnip } from "@/features/player-lookup/use-killer-lookup";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { handleExitSnip } from "./exit-snip-flow";
import { useExitSnipPreference, useKillerLookupPreference } from "./use-companion";

import type { CompanionStatus } from "./companion-config";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

/** The last clipboard counter value a read was started for, shared by every mounted watcher. */
let lastFiredSeq: number | null = null;

/**
 * The one clipboard-snip watcher: a fresh Win+Shift+S snip is read ONCE and
 * routed.
 *
 * Why one watcher and not two: both features react to the same clipboard
 * change counter (`clipSeq`) and read the same image. Two independent
 * watchers would read it twice and race, and the player-name path answers an
 * exit list with a confusing "no name found". So an in-raid snip goes to the
 * exit list reader first; only when that says "not an exit list" does it fall
 * through to the player-name lookup.
 *
 * Each path is still opt-in on its own: with both options off the companion
 * is never asked to read the clipboard.
 */
export function useSnipWatcher(status: CompanionStatus | null): void {
  const [killerEnabled] = useKillerLookupPreference();
  const [exitEnabled] = useExitSnipPreference();
  const { data } = useTarkovGameData();
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);
  const clearExits = useExitSnipStore((state) => state.clear);
  const restoreExits = useExitSnipStore((state) => state.restoreFor);

  const lastSeqRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  // `null` until the first status arrives: that first reading is the starting
  // point, not a raid beginning (a reload mid-raid must not wipe the exits).
  const wasInRaidRef = useRef<boolean | null>(null);

  // Exits describe one raid. A new raid starting is when they go.
  const inRaid = status?.inRaid === true;
  const hasStatus = status !== null;
  const raidLocation = status?.raidLocation ?? null;
  useEffect(() => {
    if (!hasStatus) return;
    if (wasInRaidRef.current === null) {
      wasInRaidRef.current = inRaid;
      // Already in a raid when this page loaded: bring back this raid's exits.
      if (inRaid) restoreExits(raidLocation);
      return;
    }
    if (inRaid && !wasInRaidRef.current) {
      clearExits();
      useExitPathStore.getState().clearSelection();
    }
    wasInRaidRef.current = inRaid;
  }, [hasStatus, inRaid, raidLocation, clearExits, restoreExits]);

  useEffect(() => {
    if (!(killerEnabled || exitEnabled) || status === null) {
      // Re-baseline on re-enable/reconnect: the counter's value from before
      // the gap describes clipboard changes these options weren't on for.
      lastSeqRef.current = null;
      return;
    }
    const { baseline, fire } = shouldTriggerSnip(lastSeqRef.current, status.clipSeq);
    lastSeqRef.current = baseline;
    if (!fire || busyRef.current) return;
    // One clipboard change is read once, however many times this hook is
    // mounted (React dev double-mounts, a second header): the module-level
    // memory is what stops a second reader from saving the snip twice.
    if (baseline === lastFiredSeq) return;
    lastFiredSeq = baseline;

    busyRef.current = true;
    void (async () => {
      try {
        // The exit list only exists in a live raid you're still alive in.
        if (exitEnabled && status.inRaid === true && status.died !== true) {
          if ((await handleExitSnip(status, maps)) === "handled") return;
        }
        if (killerEnabled) await lookUpFreshSnip(status.mode);
      } finally {
        busyRef.current = false;
      }
    })();
  }, [killerEnabled, exitEnabled, status, maps]);
}
