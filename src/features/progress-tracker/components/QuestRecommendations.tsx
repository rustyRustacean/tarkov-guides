"use client";

import { useMemo, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { Card, CardContent } from "@/shared/ui/card/Card";

import { useActiveFaction } from "../hooks/use-active-faction";
import {
  getAvailableQuests,
  getQuestDependents,
  getQuestPriorityScore,
  HIGH_VALUE_REWARD_THRESHOLD_RUB,
} from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { QuestDetailDialog } from "./QuestDetailDialog";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

const RECOMMENDATION_LIMIT = 15;

/** Explains which of `getQuestPriorityScore`'s weighted factors this task actually earned points from - display copy only, doesn't recompute the score itself. */
function getRecommendationReasons(
  task: NormalizedTask,
  dependents: readonly NormalizedTask[],
): readonly string[] {
  const reasons: string[] = [];
  if (task.kappaRequired) reasons.push("Kappa required");
  if ((task.finishRewards?.traderUnlock.length ?? 0) > 0) reasons.push("Unlocks a trader");
  if ((task.finishRewards?.traderStanding ?? []).some((entry) => entry.standing > 0.02)) {
    reasons.push("Trader standing gain");
  }
  if (
    (task.finishRewards?.items ?? []).some(
      (entry) => entry.item.basePrice > HIGH_VALUE_REWARD_THRESHOLD_RUB,
    )
  ) {
    reasons.push("High-value reward");
  }
  if (task.experience >= 10_000) reasons.push("High XP reward");
  if (dependents.length > 0) reasons.push(`Unlocks ${String(dependents.length)} more quest(s)`);
  return reasons;
}

/**
 * The top currently-available quests ranked by `getQuestPriorityScore`,
 * replacing `old/tarkov-tips/src/components/kappa/analytics/QuestRecommendations.tsx`'s
 * map-session/progression-path preference UI (session-planning heuristics
 * unrelated to what this migration needed to fix - see the plan's §5).
 * Kept to the one thing that's actually load-bearing: "what should I do
 * next," backed by the same canonical availability/priority selectors every
 * other quest view uses.
 */
export function QuestRecommendations() {
  const { data } = useTarkovGameData();
  const allTasks = data?.tasks;
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    if (!progress || activeFaction === undefined) return [];
    const tasks = allTasks ?? [];
    const available = getAvailableQuests(tasks, progress, activeFaction);
    return available
      .map((task) => {
        const dependents = getQuestDependents(task.id, tasks);
        return {
          task,
          score: getQuestPriorityScore(task, dependents),
          reasons: getRecommendationReasons(task, dependents),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, RECOMMENDATION_LIMIT);
  }, [allTasks, progress, activeFaction]);

  if (!progress) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to see recommendations.
      </p>
    );
  }

  if (recommendations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No quests are currently available - check your character stats or task list.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {recommendations.map(({ task, score, reasons }, index) => (
        <Card key={task.id}>
          <CardContent className="flex items-start justify-between gap-4 p-4">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setSelectedTaskId(task.id);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-semibold">#{index + 1}</span>
                <span className="truncate font-medium">{task.name}</span>
                {task.kappaRequired && <Badge variant="kappa">Kappa</Badge>}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {task.trader.name} · Lv {task.minPlayerLevel} · {task.experience.toLocaleString()}{" "}
                XP
              </div>
              {reasons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => (
                    <span key={reason} className="bg-secondary rounded px-1.5 py-0.5 text-xs">
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </button>
            <span className="text-primary shrink-0 text-lg font-bold">{score}</span>
          </CardContent>
        </Card>
      ))}

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
