"use client";

import { useMemo, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { Progress } from "@/shared/ui/progress/Progress";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useTaskActions } from "../hooks/use-task-actions";
import { getQuestAvailability, getTasksBehindCounts } from "../selectors/quest-availability";
import {
  getTraderOutlineColor,
  groupTasksByTrader,
  sortTraderNames,
} from "../selectors/trader-grouping";
import { useProgressTrackerStore } from "../store";

import { QuestCard } from "./QuestCard";
import { QuestDetailDialog } from "./QuestDetailDialog";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface TraderTaskBoardProps {
  /** Free-text task-name search from `QuestBoard`'s shared toolbar input - defaults to "" so this still renders standalone (e.g. in tests) without a parent supplying one. */
  searchQuery?: string;
}

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
 *
 * Each section header shows that trader's avatar (`QuestTreeView`'s own
 * `h-16 w-16` portrait recipe, `traderImageByName`/`getTraderOutlineColor`)
 * and a `done/total` progress bar - deliberately computed from every task
 * for that trader (`traderStatsByName`), not just the currently-visible
 * ones, so toggling `showLocked` never changes what the fraction means.
 * `QuestCard` rows pass `showTrader={false}` since the section header
 * already establishes trader identity.
 *
 * `searchQuery` (from `QuestBoard`'s shared toolbar search box) filters
 * `visibleTasks` down further, same substring-of-name match as `QuestList`'s
 * own search - a trader section disappears entirely once none of its tasks
 * match, since `groupTasksByTrader` only ever creates a group for a trader
 * that has at least one task in what it's given.
 */
export function TraderTaskBoard({ searchQuery = "" }: TraderTaskBoardProps) {
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
    const lockFiltered = showLocked
      ? allTasks
      : allTasks.filter((task) => availability.get(task.id)?.isLocked !== true);
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) return lockFiltered;
    return lockFiltered.filter((task) => task.name.toLowerCase().includes(query));
  }, [tasksData, availability, showLocked, searchQuery]);

  // First visible task per trader is enough - every task for a given trader
  // shares the same `trader.imageLink` (same pattern as `QuestTreeView`'s
  // own `traderImageByName`). Sourced from the FULL `tasksData`, not
  // `visibleTasks`, so a section's avatar doesn't flicker based on the
  // `showLocked` toggle.
  const traderImageByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const task of tasksData ?? []) {
      if (!map.has(task.trader.name)) map.set(task.trader.name, task.trader.imageLink);
    }
    return map;
  }, [tasksData]);

  // Ungated per-trader totals for the progress bar in each section header -
  // deliberately built from the FULL `tasksData` (not `visibleTasks`, which
  // `showLocked` filters), so toggling "Show locked" changes which rows are
  // visible without changing what "N/M" means for that trader.
  const traderStatsByName = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    if (!availability) return stats;
    for (const task of tasksData ?? []) {
      const entry = stats.get(task.trader.name) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (availability.get(task.id)?.status === "done") entry.done += 1;
      stats.set(task.trader.name, entry);
    }
    return stats;
  }, [tasksData, availability]);
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
        <Checkbox
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
        const traderImage = traderImageByName.get(traderName) ?? null;
        const traderStats = traderStatsByName.get(traderName) ?? { done: 0, total: 0 };

        return (
          <Card key={traderName}>
            <CardHeader>
              <div className="flex items-center gap-4">
                {traderImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                  <img
                    src={traderImage}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-full object-cover outline-2 outline-offset-1"
                    style={{ outlineColor: getTraderOutlineColor(traderName) }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-muted h-16 w-16 shrink-0 rounded-full outline-2 outline-offset-1"
                    style={{ outlineColor: getTraderOutlineColor(traderName) }}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{traderName}</CardTitle>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {traderStats.done}/{traderStats.total}
                    </span>
                  </div>
                  <Progress value={traderStats.done} max={traderStats.total} />
                  <CardDescription>{traderTasks.length} quests</CardDescription>
                </div>
              </div>
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
                      showTrader={false}
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
