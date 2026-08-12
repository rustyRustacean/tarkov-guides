"use client";

import { useMemo } from "react";

import { getQuestAvailability, type QuestAvailability } from "../selectors/quest-availability";

import { useActiveFaction } from "./use-active-faction";
import { useActiveModeTasks } from "./use-active-mode-tasks";
import { useActiveProgress } from "./use-active-progress";

/**
 * The active profile's `getQuestAvailability()` result, memoized on the
 * live task list + progress + faction. Pre-production audit
 * (`CODE_AUDIT.md` finding 6) found this exact `useMemo`-wrapped call
 * duplicated across `QuestList`/`QuestTreeView`/`TraderTaskBoard`/
 * `QuestAnalyticsPanel`, each independently re-running the same ~510-task
 * gating pass keyed on the same three inputs.
 *
 * Note on what this does and doesn't share: a `useMemo`-backed hook only
 * avoids recomputing across re-renders of the SAME mounted component
 * instance - it does not give two simultaneously-mounted components a
 * single shared computation the way a React Query cache entry would. In
 * practice this doesn't cost much here: `QuestBoard`'s four view modes
 * (List/Tree/Trader/Analytics) are Radix `Tabs.Content` panes, which
 * unmount when inactive by default (no `forceMount`), so at most one of
 * these four is ever mounted at a time on `/progress-tracker` - what this
 * hook actually eliminates is 4+ copies of the same boilerplate, not 4
 * simultaneous computations. `undefined` whenever there's no active
 * profile, mirroring every migrated call site's own previous guard.
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
