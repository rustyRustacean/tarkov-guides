"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { Progress } from "@/shared/ui/progress/Progress";

import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { getKappaItems } from "../lib/kappa";
import { sortTraderNames } from "../selectors/trader-grouping";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { TraderRemainingPieChart } from "./TraderRemainingPieChart";

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
  traderRemaining: readonly { traderName: string; remaining: number }[];
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
 * Real completion/trader/Kappa statistics only. Deliberately drops
 * `old/tarkov-tips/src/components/kappa/analytics/QuestCharts.tsx`'s
 * "Progress Timeline" bar chart, which the legacy component's own UI copy
 * admits is simulated (`Math.floor(completedCount * (i+1) / 7)`), not
 * derived from any stored history. `TaskProgress.completedAt` makes a real
 * trend chart possible once enough history accumulates, but that's future
 * work, not a fabricated placeholder now.
 */
export function QuestAnalyticsPanel() {
  // `tasks` (not `tasks ?? []`) as the dependency. See
  // `hooks/use-task-actions.ts`'s comment for why the fallback needs to
  // live inside the memoized callback, not the dependency expression.
  const { tasks: tasksData } = useActiveModeTasks();
  const progress = useActiveProgress();
  // Shared with every other quest view via `useQuestAvailability()` rather
  // than re-deriving its own copy. Also subsumes this component's own
  // faction gating, so a separate `useActiveFaction()` call is no longer
  // needed here.
  const availability = useQuestAvailability();

  const stats = useMemo((): AnalyticsStats | null => {
    if (!progress || !availability) return null;
    const tasks = tasksData ?? [];

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

    const traderRemaining = Array.from(traderTotals.values())
      .map((trader) => ({ traderName: trader.traderName, remaining: trader.total - trader.done }))
      .filter((trader) => trader.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);

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
      traderStats: sortTraderNames(Array.from(traderTotals.keys()))
        .map((traderName) => traderTotals.get(traderName))
        .filter((trader): trader is TraderStat => trader !== undefined),
      traderRemaining,
      kappaItemsTotal: kappaItems.length,
      kappaItemsOwned: kappaItems.filter((item) => item.got).length,
      kappaTasksTotal,
      kappaTasksDone,
    };
  }, [tasksData, progress, availability]);

  if (!progress || !stats) {
    return <NoActiveProfileNotice reason="see analytics" />;
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

      <div className="grid gap-4 lg:grid-cols-2">
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
            <CardTitle>Remaining tasks by trader</CardTitle>
          </CardHeader>
          <CardContent>
            <TraderRemainingPieChart data={stats.traderRemaining} />
          </CardContent>
        </Card>
      </div>

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
