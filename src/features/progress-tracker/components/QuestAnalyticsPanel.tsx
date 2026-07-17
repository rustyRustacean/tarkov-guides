"use client";

import { useMemo } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { Progress } from "@/shared/ui/progress/Progress";

import { useActiveFaction } from "../hooks/use-active-faction";
import { getKappaItems } from "../lib/kappa";
import { getQuestAvailability } from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

interface TraderStat {
  traderName: string;
  total: number;
  done: number;
}

interface AnalyticsStats {
  total: number;
  done: number;
  inprog: number;
  available: number;
  locked: number;
  failed: number;
  traderStats: readonly TraderStat[];
  kappaItemsTotal: number;
  kappaItemsOwned: number;
  kappaTasksTotal: number;
  kappaTasksDone: number;
}

function statTile(
  label: string,
  value: number | string,
): { label: string; value: number | string } {
  return { label, value };
}

/**
 * Real completion/trader/Kappa statistics only - deliberately drops
 * `old/tarkov-tips/src/components/kappa/analytics/QuestCharts.tsx`'s "Progress
 * Timeline" bar chart, which the legacy component's own UI copy admits is
 * simulated (`Math.floor(completedCount * (i+1) / 7)`), not derived from any
 * stored history. `TaskProgress.completedAt` (added in this migration's
 * `types.ts`) makes a real trend chart possible once enough history
 * accumulates, but that's future work, not a fabricated placeholder now.
 */
export function QuestAnalyticsPanel() {
  const { data } = useTarkovGameData();
  // Read `data?.tasks` directly as the dependency (not `data?.tasks ?? []`
  // - see `hooks/use-task-actions.ts`'s comment for why the fallback needs
  // to live inside the memoized callback, not the dependency expression.
  const tasksData = data?.tasks;
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();

  const stats = useMemo((): AnalyticsStats | null => {
    if (!progress || activeFaction === undefined) return null;
    const tasks = tasksData ?? [];

    const availability = getQuestAvailability(tasks, progress, activeFaction);
    let done = 0;
    let inprog = 0;
    let available = 0;
    let locked = 0;
    let failed = 0;
    const traderTotals = new Map<string, TraderStat>();

    for (const task of tasks) {
      const entry = availability.get(task.id);
      const status = entry?.status ?? "notstarted";
      if (status === "done") done++;
      else if (status === "inprog") inprog++;
      else if (status === "failed") failed++;
      else if (entry?.isAvailable) available++;
      else locked++;

      const traderName = task.trader.name;
      const bucket = traderTotals.get(traderName) ?? { traderName, total: 0, done: 0 };
      bucket.total += 1;
      if (status === "done") bucket.done += 1;
      traderTotals.set(traderName, bucket);
    }

    const kappaItems = getKappaItems(tasks, progress.kappaGot);
    const kappaTasksTotal = tasks.filter((task) => task.kappaRequired).length;
    const kappaTasksDone = tasks.filter(
      (task) => task.kappaRequired && progress.taskStatus[task.id]?.status === "done",
    ).length;

    return {
      total: tasks.length,
      done,
      inprog,
      available,
      locked,
      failed,
      traderStats: Array.from(traderTotals.values()).sort((a, b) => b.total - a.total),
      kappaItemsTotal: kappaItems.length,
      kappaItemsOwned: kappaItems.filter((item) => item.got).length,
      kappaTasksTotal,
      kappaTasksDone,
    };
  }, [tasksData, progress, activeFaction]);

  if (!progress || !stats) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to see analytics.
      </p>
    );
  }

  const completionPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const tiles = [
    statTile("Completion", `${String(completionPercent)}%`),
    statTile("Done", `${String(stats.done)} / ${String(stats.total)}`),
    statTile("In progress", stats.inprog),
    statTile("Available", stats.available),
    statTile("Locked", stats.locked),
    statTile("Failed", stats.failed),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{tile.value}</div>
              <div className="text-muted-foreground text-xs">{tile.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress by trader</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stats.traderStats.map((trader) => (
            <div key={trader.traderName} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm">{trader.traderName}</span>
              <Progress value={trader.done} max={trader.total} className="flex-1" />
              <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
                {trader.done}/{trader.total}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kappa progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm">Collector items</span>
            <Progress
              value={stats.kappaItemsOwned}
              max={Math.max(stats.kappaItemsTotal, 1)}
              className="flex-1"
            />
            <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
              {stats.kappaItemsOwned}/{stats.kappaItemsTotal}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm">Kappa tasks</span>
            <Progress
              value={stats.kappaTasksDone}
              max={Math.max(stats.kappaTasksTotal, 1)}
              className="flex-1"
            />
            <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
              {stats.kappaTasksDone}/{stats.kappaTasksTotal}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
