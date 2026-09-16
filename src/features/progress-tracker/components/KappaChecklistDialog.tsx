"use client";

import { useMemo } from "react";

import { Badge } from "@/shared/ui/badge/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { getCollectorTask } from "../lib/kappa";
import { formatTraderRequirement, meetsTraderRequirements } from "../selectors/quest-availability";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { statusBadge } from "./QuestCard";

export interface KappaChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The real, complete Kappa requirement: assembled from two API-verified
 * signals, kept deliberately separate from the per-trader curated
 * "Essential" row on `QuestSwimlaneMatrix`/`QuestTreeView` (a different,
 * broader, still-being-curated BSG UI
 * category, see `data/loyalty-board-overrides.ts`'s doc comment). Not
 * derivable from any single upstream endpoint, so this is how it has to be
 * built:
 *
 * 1. `NormalizedTask.kappaRequired`: the 16 tasks tarkov.dev itself flags
 *    as Kappa requirements.
 * 2. The "Collector" task's own `traderRequirements`: its real in-game
 *    gate is LL4 on 7 traders plus Fence reputation >= 3, which tarkov.dev
 *    models as ordinary `traderRequirements` entries on that one task, not
 *    a separate "kappa requirements" object anywhere in the API.
 *
 * Since this dialog is itself a modal, task clicks route through the
 * app-wide `useItemDetailStore` (mounted once in `app/providers.tsx`)
 * rather than a locally-mounted `QuestDetailDialog`, matching
 * `MapRecommendationDialog`'s established reasoning: stacking a second,
 * independently-managed Radix dialog on top of this one would need its own
 * dismiss/focus coordination the shared store already handles.
 */
export function KappaChecklistDialog({ open, onOpenChange }: KappaChecklistDialogProps) {
  const { tasks: tasksData } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const availability = useQuestAvailability();
  const openTask = useItemDetailStore((state) => state.openTask);

  const essentialTasks = useMemo(
    () => (tasksData ?? []).filter((task) => task.kappaRequired),
    [tasksData],
  );
  const collectorTask = useMemo(() => getCollectorTask(tasksData ?? []), [tasksData]);
  const collectorCheck = useMemo(
    () => (collectorTask && progress ? meetsTraderRequirements(collectorTask, progress) : null),
    [collectorTask, progress],
  );
  const unmetRequirements = useMemo(() => new Set(collectorCheck?.unmet ?? []), [collectorCheck]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kappa Checklist</DialogTitle>
          <DialogDescription>
            Everything required for the Kappa secure container: the 16 essential tasks, plus
            Collector&apos;s own trader-level and Fence-reputation gate.
          </DialogDescription>
        </DialogHeader>

        {!progress || activeFaction === undefined || !availability ? (
          <div className="mt-4">
            <NoActiveProfileNotice reason="track Kappa progress" />
          </div>
        ) : (
          <div className="mt-4 -mr-2 flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-2">
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                16 essential tasks
              </h3>
              <ul className="flex flex-col gap-1">
                {essentialTasks.map((task) => {
                  const taskAvailability = availability.get(task.id);
                  const badge = taskAvailability ? statusBadge(task, taskAvailability) : null;
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        className="hover:bg-secondary flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-colors"
                        onClick={() => {
                          openTask(task.id);
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm">{task.name}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {task.trader.name}
                          </span>
                        </span>
                        {badge && (
                          <Badge variant={badge.variant} className="shrink-0">
                            {badge.label}
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Collector&apos;s trader gate
              </h3>
              {!collectorTask ? (
                <p className="text-muted-foreground text-sm">
                  Collector task not found in the current data.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {collectorTask.traderRequirements.map((requirement) => {
                    const met = !unmetRequirements.has(requirement);
                    const current =
                      requirement.requirementType === "reputation"
                        ? (progress.traderReputation[requirement.traderId] ?? 0)
                        : (progress.traderLevels[requirement.traderId] ?? 1);
                    return (
                      <li
                        key={`${requirement.traderId}-${requirement.requirementType}`}
                        className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-sm"
                      >
                        <span>{formatTraderRequirement(requirement)}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-muted-foreground font-mono text-xs">
                            {current} / {requirement.value}
                          </span>
                          <Badge variant={met ? "green" : "outline"}>
                            {met ? "Met" : "Not met"}
                          </Badge>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
