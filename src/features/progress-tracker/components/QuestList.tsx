"use client";

import { useMemo, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useTaskActions } from "../hooks/use-task-actions";
import {
  getQuestAvailability,
  getQuestDependents,
  getQuestPriorityScore,
  getTasksBehindCounts,
} from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { QuestCard } from "./QuestCard";
import { defaultQuestFilters, QuestFilterBar } from "./QuestFilterBar";

import type { QuestFilters } from "./QuestFilterBar";
import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function matchesFilters(
  task: NormalizedTask,
  availability: QuestAvailability | undefined,
  filters: QuestFilters,
): boolean {
  if (!availability) return false;
  if (filters.hideDone && availability.status === "done") return false;
  if (!filters.showLocked && availability.isLocked) return false;
  if (filters.kappaOnly && !task.kappaRequired) return false;
  if (filters.traderName !== null && task.trader.name !== filters.traderName) return false;
  if (filters.search.trim().length > 0) {
    const query = filters.search.trim().toLowerCase();
    if (!task.name.toLowerCase().includes(query)) return false;
  }
  return true;
}

function sortTasks(
  tasks: readonly NormalizedTask[],
  allTasks: readonly NormalizedTask[],
  filters: QuestFilters,
  pinnedTaskIds: readonly string[],
  // Built from `allTasks` (not the already-filtered `tasks`), same as the
  // "impact" branch below - a quest's tasks-behind count reflects the whole
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

/**
 * The flat/filterable quest list - the "list" view mode of `QuestBoard`.
 * Calls `useTaskActions()` exactly once here (not per `QuestCard`) so the
 * `tasksById` map it builds isn't redundantly recomputed once per row.
 */
export function QuestList() {
  const { data } = useTarkovGameData();
  // Read `data?.tasks` directly (not `data?.tasks ?? []`) so the useMemo
  // dependency below is a stable reference when unchanged - see the same
  // fix in `hooks/use-task-actions.ts`.
  const tasksData = data?.tasks;
  const tasks = tasksData ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();

  const [filters, setFilters] = useState<QuestFilters>(defaultQuestFilters());

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

  if (!progress || activeFaction === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking quests.
      </p>
    );
  }

  const availability = getQuestAvailability(tasks, progress, activeFaction);
  const filtered = tasks.filter((task) => matchesFilters(task, availability.get(task.id), filters));
  const visibleTasks = sortTasks(
    filtered,
    tasks,
    filters,
    progress.pinnedTaskIds,
    tasksBehindCounts,
  );
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
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
