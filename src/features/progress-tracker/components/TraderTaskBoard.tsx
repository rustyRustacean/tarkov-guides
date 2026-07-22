"use client";

import { useMemo, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useTaskActions } from "../hooks/use-task-actions";
import { getQuestAvailability, getTasksBehindCounts } from "../selectors/quest-availability";
import { groupTasksByTrader, sortTraderNames } from "../selectors/trader-grouping";
import { useProgressTrackerStore } from "../store";

import { QuestCard } from "./QuestCard";
import { QuestDetailDialog } from "./QuestDetailDialog";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/**
 * Trader-grouped view mode of `QuestBoard` - one section per trader, in
 * canonical in-game roster order (`sortTraderNames`). Within each section,
 * tasks are pinned-first then sorted by how many other quests are
 * transitively gated behind them (`getTasksBehindCounts`, descending) -
 * `groupTasksByTrader`'s own pinned+status-bucket order is only the
 * starting point, re-sorted locally here rather than changing that shared
 * helper (other/future consumers may still want its original order).
 * Locked tasks are hidden by default (`showLocked`, a local toggle
 * mirroring `QuestTreeView`'s own `kappaOnly`/`showLocked` state rather
 * than anything shared across views - see that component's doc comment for
 * why each view keeps its own filter state).
 */
export function TraderTaskBoard() {
  const { data } = useTarkovGameData();
  const tasksData = data?.tasks;

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();
  const [showLocked, setShowLocked] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const tasksBehindCounts = useMemo(() => getTasksBehindCounts(tasksData ?? []), [tasksData]);

  // Gating every task is real work across ~500 real quests - previously
  // redone on every render (including any unrelated store update bubbling
  // through this component's parents). Memoized before the early return
  // below, per the Rules of Hooks (same pattern `QuestTreeView`'s
  // `availability` memo already uses ahead of its own early return).
  const availability = useMemo(
    () =>
      progress && activeFaction !== undefined
        ? getQuestAvailability(tasksData ?? [], progress, activeFaction)
        : undefined,
    [tasksData, progress, activeFaction],
  );
  const visibleTasks = useMemo(() => {
    const allTasks = tasksData ?? [];
    if (!availability) return [];
    return showLocked
      ? allTasks
      : allTasks.filter((task) => availability.get(task.id)?.isLocked !== true);
  }, [tasksData, availability, showLocked]);
  const groups = useMemo(
    () =>
      progress
        ? groupTasksByTrader(visibleTasks, progress)
        : new Map<string, readonly NormalizedTask[]>(),
    [visibleTasks, progress],
  );
  const orderedTraderNames = useMemo(() => sortTraderNames([...groups.keys()]), [groups]);

  if (!progress || activeFaction === undefined || !availability) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking quests.
      </p>
    );
  }

  const pinnedSet = new Set(progress.pinnedTaskIds);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={showLocked}
          onChange={(event) => {
            setShowLocked(event.target.checked);
          }}
        />
        Show locked
      </label>

      {orderedTraderNames.map((traderName) => {
        const traderTasks = [...(groups.get(traderName) ?? [])].sort((a, b) => {
          const aPinned = pinnedSet.has(a.id);
          const bPinned = pinnedSet.has(b.id);
          if (aPinned !== bPinned) return aPinned ? -1 : 1;
          return (tasksBehindCounts.get(b.id) ?? 0) - (tasksBehindCounts.get(a.id) ?? 0);
        });
        return (
          <Card key={traderName}>
            <CardHeader>
              <CardTitle>{traderName}</CardTitle>
              <CardDescription>{traderTasks.length} quests</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {traderTasks.map((task) => {
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
            </CardContent>
          </Card>
        );
      })}

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
