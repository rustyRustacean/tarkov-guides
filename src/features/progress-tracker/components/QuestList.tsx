"use client";

import { useMemo, useState } from "react";

import { taskMatchesQuery } from "@/shared/lib/task-search";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { useTaskActions } from "../hooks/use-task-actions";
import {
  getQuestDependents,
  getQuestPriorityScore,
  getTasksBehindCounts,
} from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { QuestCard } from "./QuestCard";
import { QuestDetailDialog } from "./QuestDetailDialog";
import { defaultQuestFilters, QuestFilterBar } from "./QuestFilterBar";

import type { QuestFilters } from "./QuestFilterBar";
import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function matchesFilters(
  task: NormalizedTask,
  availability: QuestAvailability | undefined,
  filters: QuestFilters,
  searchQuery: string,
): boolean {
  if (!availability) return false;
  if (filters.hideDone && availability.status === "done") return false;
  if (!filters.showLocked && availability.isLocked) return false;
  if (filters.kappaOnly && !task.kappaRequired) return false;
  if (filters.traderName !== null && task.trader.name !== filters.traderName) return false;
  if (!taskMatchesQuery(task, searchQuery)) return false;
  return true;
}

function sortTasks(
  tasks: readonly NormalizedTask[],
  allTasks: readonly NormalizedTask[],
  filters: QuestFilters,
  pinnedTaskIds: readonly string[],
  // Built from `allTasks` (not the already-filtered `tasks`), same as the
  // "impact" branch below: a quest's tasks-behind count reflects the whole
  // real dependency graph, unaffected by what the current kappa/locked/
  // search filters happen to be hiding right now. Passed in (rather than
  // computed here) so the caller can reuse the same map for each
  // `QuestCard`'s "N behind" badge without computing it twice.
  behindCounts: ReadonlyMap<string, number>,
): NormalizedTask[] {
  const pinnedSet = new Set(pinnedTaskIds);
  const scoreById = new Map<string, number>();
  if (filters.sortBy === "impact") {
    for (const task of tasks) {
      scoreById.set(task.id, getQuestPriorityScore(task, getQuestDependents(task.id, allTasks)));
    }
  }

  return [...tasks].sort((a, b) => {
    const aPinned = pinnedSet.has(a.id);
    const bPinned = pinnedSet.has(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    switch (filters.sortBy) {
      case "level":
        return a.minPlayerLevel - b.minPlayerLevel;
      case "name":
        return a.name.localeCompare(b.name);
      case "trader":
        return a.trader.name.localeCompare(b.trader.name);
      case "behind":
        return (behindCounts.get(b.id) ?? 0) - (behindCounts.get(a.id) ?? 0);
      case "impact":
      default:
        return (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
    }
  });
}

export interface QuestListProps {
  /** Free-text search from `QuestBoard`'s toolbar. Defaults to "" so this renders standalone (e.g. in tests). */
  searchQuery?: string;
}

/**
 * The flat/filterable quest list, the "list" view mode of `QuestBoard`.
 * Calls `useTaskActions()` exactly once here (not per `QuestCard`) so the
 * `tasksById` map it builds isn't redundantly recomputed once per row.
 */
export function QuestList({ searchQuery = "" }: QuestListProps) {
  // `tasks` (not `tasks ?? []`) so each useMemo dependency below is a stable
  // reference when unchanged. See the same fix in `hooks/use-task-actions.ts`.
  // The `?? []` fallback is applied inside each memo's body instead, never
  // here.
  const { tasks: tasksData } = useActiveModeTasks();

  const progress = useActiveProgress();
  // A narrower dependency than the whole `progress` object for the
  // `visibleTasks` memo below: `pinnedTaskIds` keeps the same array
  // reference across any progress update that doesn't touch pins (plain
  // object spread leaves untouched fields referentially identical), so
  // depending on `progress` itself would re-sort on every unrelated change
  // (e.g. bumping an item's pending count) even though pin order never did.
  const pinnedTaskIds = progress?.pinnedTaskIds;
  const activeFaction = useActiveFaction();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();

  const [filters, setFilters] = useState<QuestFilters>(defaultQuestFilters());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const traderNames = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasksData ?? []) {
      names.add(task.trader.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tasksData]);

  // Hoisted above the "impact"-only computation inside `sortTasks` so the
  // count is always available for each row's badge, regardless of which
  // sort is currently active. Depends on `tasksData` (not `tasks`), same
  // stable-reference reasoning as `traderNames` above.
  const tasksBehindCounts = useMemo(() => getTasksBehindCounts(tasksData ?? []), [tasksData]);

  // Gating every task (level/trader/faction/prestige/delay) is real work
  // across ~500 real quests, previously redone on every render, including
  // every keystroke in the search box. Shared with every other quest view
  // via `useQuestAvailability()` rather than each re-deriving its own copy
  // of this same computation.
  const availability = useQuestAvailability();
  const filtered = useMemo(
    () =>
      availability
        ? (tasksData ?? []).filter((task) =>
            matchesFilters(task, availability.get(task.id), filters, searchQuery),
          )
        : [],
    [tasksData, availability, filters, searchQuery],
  );
  // `sortTasks`'s "impact" branch calls `getQuestPriorityScore`/
  // `getQuestDependents` (an O(n) scan) once per visible task: O(n²) over
  // ~500 real quests when redone on every unrelated re-render. Memoizing
  // here means it only actually re-sorts when `filtered`/the sort-relevant
  // filters/pins/counts change.
  const visibleTasks = useMemo(
    () => sortTasks(filtered, tasksData ?? [], filters, pinnedTaskIds ?? [], tasksBehindCounts),
    [filtered, tasksData, filters, pinnedTaskIds, tasksBehindCounts],
  );

  if (!progress || activeFaction === undefined || !availability) {
    return <NoActiveProfileNotice reason="start tracking quests" />;
  }

  const pinnedSet = new Set(progress.pinnedTaskIds);

  return (
    <div className="flex flex-col gap-4">
      <QuestFilterBar filters={filters} onFiltersChange={setFilters} traderNames={traderNames} />

      {visibleTasks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No quests match your filters.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleTasks.map((task) => {
            const taskAvailability = availability.get(task.id);
            if (!taskAvailability) return null;
            return (
              <QuestCard
                key={task.id}
                task={task}
                availability={taskAvailability}
                pinned={pinnedSet.has(task.id)}
                tasksBehindCount={tasksBehindCounts.get(task.id) ?? 0}
                onStart={startTask}
                onDone={doneTask}
                onFail={failTask}
                onUndo={undoTask}
                onTogglePin={togglePinnedTask}
                onOpenDetail={setSelectedTaskId}
              />
            );
          })}
        </ul>
      )}

      <QuestDetailDialog
        taskId={selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  );
}
