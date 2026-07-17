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
  const tasks = tasksData ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();
  const [showLocked, setShowLocked] = useState(false);
  const tasksBehindCounts = useMemo(() => getTasksBehindCounts(tasksData ?? []), [tasksData]);

  if (!progress || activeFaction === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking quests.
      </p>
    );
  }

  const availability = getQuestAvailability(tasks, progress, activeFaction);
  const visibleTasks = showLocked
    ? tasks
    : tasks.filter((task) => availability.get(task.id)?.isLocked !== true);
  const groups = groupTasksByTrader(visibleTasks, progress);
  const orderedTraderNames = sortTraderNames([...groups.keys()]);
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
                    />
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
