"use client";

import { useMemo } from "react";

import { getQuestAvailability, type QuestAvailability } from "../selectors/quest-availability";

import { useActiveFaction } from "./use-active-faction";
import { useActiveModeTasks } from "./use-active-mode-tasks";
import { useActiveProgress } from "./use-active-progress";

/**
 * The active profile's `getQuestAvailability()` result, memoized on the
 * live task list, progress, and faction. Consolidates a `useMemo`-wrapped
 * call that used to be duplicated across `QuestList`, `QuestTreeView`,
 * `TraderTaskBoard`, and `QuestAnalyticsPanel`, each independently
 * re-running the same task-gating pass on the same three inputs.
 *
 * A `useMemo`-backed hook only avoids recomputing across re-renders of the
 * SAME mounted component instance; it doesn't share a computation across
 * simultaneously-mounted components the way a cache would. That doesn't
 * cost much here: `QuestBoard`'s four view modes are Radix `Tabs.Content`
 * panes that unmount when inactive, so at most one is ever mounted at a
 * time. This hook mainly eliminates duplicated boilerplate, not duplicated
 * computation. Returns `undefined` whenever there's no active profile.
 */
export function useQuestAvailability(): ReadonlyMap<string, QuestAvailability> | undefined {
  const { tasks } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();

  return useMemo(
    () =>
      progress && activeFaction !== undefined
        ? getQuestAvailability(tasks ?? [], progress, activeFaction)
        : undefined,
    [tasks, progress, activeFaction],
  );
}
