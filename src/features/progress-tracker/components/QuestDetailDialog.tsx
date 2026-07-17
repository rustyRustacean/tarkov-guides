"use client";

import { useMemo } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useTaskActions } from "../hooks/use-task-actions";
import { estimateSectionWeight, selectFeaturedSectionIndex } from "../lib/quest-detail-bento";
import { getQuestAvailability, getQuestDependents } from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { statusBadge } from "./QuestCard";

import type { RawFinishRewards, TraderRequirement } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

export interface QuestDetailDialogProps {
  /** `null` closes the dialog. */
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Lets the caller re-target the dialog at a prerequisite/dependent quest without closing it. */
  onSelectTask: (taskId: string) => void;
}

interface BentoSection {
  id: string;
  title: string;
  weight: number;
  content: ReactNode;
}

function requirementLabel(requirement: TraderRequirement): string {
  const noun = requirement.requirementType === "reputation" ? "reputation" : "loyalty level";
  return `${requirement.traderName} ${noun} ${requirement.compareMethod} ${String(requirement.value)}`;
}

/**
 * `true` when a `RawFinishRewards` object actually has anything to show.
 * Real tarkov.dev data confirmed via a live browser check: a task's
 * `startRewards`/`failureOutcome` can be a non-null object with every field
 * an empty array (i.e. "no starting reward," not `null`) - gating a whole
 * section (including its heading) on mere object presence rendered an empty
 * "Starting rewards" heading with nothing under it for e.g. the real
 * "Debut" task. Callers must gate on this, not on `rewards !== null` alone.
 */
function hasRewardContent(rewards: RawFinishRewards): boolean {
  return (
    rewards.items.length > 0 ||
    rewards.traderStanding.length > 0 ||
    rewards.traderUnlock.length > 0 ||
    rewards.offerUnlock.length > 0 ||
    rewards.skillLevelReward.length > 0
  );
}

/**
 * Flattens every field of a `RawFinishRewards` object (2026-07-16 API
 * field-application audit) into one line of display text
 * per entry - shared by `RewardBreakdown` (the actual rendered list) and
 * each reward section's bento-grid weight estimate, so both always agree on
 * exactly what a reward section "contains."
 */
function formatRewardLines(rewards: RawFinishRewards): string[] {
  const lines: string[] = [];
  for (const entry of rewards.items) lines.push(`${entry.item.name} × ${String(entry.count)}`);
  for (const entry of rewards.traderStanding) {
    lines.push(
      `${entry.trader.name} Rep ${entry.standing > 0 ? "+" : ""}${String(entry.standing)}`,
    );
  }
  for (const entry of rewards.traderUnlock) lines.push(`Unlocks ${entry.name}`);
  for (const entry of rewards.offerUnlock) {
    lines.push(
      `Unlocks purchase of ${entry.item.name} at ${entry.trader.name} LL${String(entry.level)}`,
    );
  }
  for (const entry of rewards.skillLevelReward) lines.push(`${entry.name} +${String(entry.level)}`);
  return lines;
}

function RewardBreakdown({ rewards }: { rewards: RawFinishRewards }) {
  const lines = formatRewardLines(rewards);
  if (lines.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-col gap-1">
      {lines.map((line, index) => (
        // Static, never-reordered list built fresh from `rewards` each
        // render - index is a stable-enough key here.
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

/**
 * Full detail view for one task: objectives, item requirements, rewards,
 * prerequisites/unlocks (both id-based via `taskRequirements`/
 * `getQuestDependents`, never a persisted names-based field), trader-loyalty
 * gates, wiki link, and the same status actions `QuestCard` exposes. Reads
 * its own data (live game data + active profile) the same way
 * `CharacterStatsDialog` does, so callers only need to pass a `taskId`.
 *
 * A full-width hero image (`task.taskImageLink`) leads the dialog when one
 * exists, breaking out of `DialogContent`'s own padding via a negative
 * margin rather than touching the shared `Dialog.tsx` (used by 8 other
 * dialogs). Every section below it renders as its own visually-distinct
 * card in a 2-column bento grid instead of a flat stack of bare headings -
 * when the number of populated sections is odd, the single largest one
 * (`selectFeaturedSectionIndex`, weighted by `estimateSectionWeight`) spans
 * both columns so the grid still tiles evenly.
 */
export function QuestDetailDialog({ taskId, onOpenChange, onSelectTask }: QuestDetailDialogProps) {
  const { data } = useTarkovGameData();
  // Read `data?.tasks` directly as the dependency (not `data?.tasks ?? []`
  // - see `hooks/use-task-actions.ts`'s comment for why the fallback needs
  // to live inside the memoized callback, not the dependency expression.
  const tasksData = data?.tasks;
  const tasks = tasksData ?? [];
  const tasksById = useMemo(
    () => new Map((tasksData ?? []).map((task) => [task.id, task])),
    [tasksData],
  );

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const pinnedTaskIds = progress?.pinnedTaskIds ?? [];
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();

  const task = taskId !== null ? tasksById.get(taskId) : undefined;
  const availability =
    task && progress && activeFaction !== undefined
      ? getQuestAvailability(tasks, progress, activeFaction).get(task.id)
      : undefined;
  const dependents = task ? getQuestDependents(task.id, tasks) : [];

  const sections: BentoSection[] = [];
  if (task) {
    sections.push({
      id: "prerequisites",
      title: "Prerequisites",
      weight: estimateSectionWeight(
        task.taskRequirements.length === 0
          ? ["No prerequisites."]
          : task.taskRequirements.map(
              (requirement) =>
                tasksById.get(requirement.taskId)?.name ?? `Unknown task (${requirement.taskId})`,
            ),
      ),
      content:
        task.taskRequirements.length === 0 ? (
          <p className="text-muted-foreground text-xs">No prerequisites.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {task.taskRequirements.map((requirement) => {
              const prereqTask = tasksById.get(requirement.taskId);
              const unmet = availability?.unmetPrereqTaskIds.includes(requirement.taskId) ?? false;
              return (
                <li key={requirement.taskId}>
                  {prereqTask ? (
                    <button
                      type="button"
                      className={`hover:underline ${unmet ? "text-status-red" : ""}`}
                      onClick={() => {
                        onSelectTask(requirement.taskId);
                      }}
                    >
                      {prereqTask.name}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      Unknown task ({requirement.taskId})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ),
    });

    sections.push({
      id: "unlocks",
      title: "Unlocks",
      weight: estimateSectionWeight(
        dependents.length === 0
          ? ["Nothing unlocked."]
          : dependents.map((dependent) => dependent.name),
      ),
      content:
        dependents.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nothing unlocked.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {dependents.map((dependent) => (
              <li key={dependent.id}>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    onSelectTask(dependent.id);
                  }}
                >
                  {dependent.name}
                </button>
              </li>
            ))}
          </ul>
        ),
    });

    if (task.traderRequirements.length > 0) {
      sections.push({
        id: "trader-requirements",
        title: "Trader requirements",
        weight: estimateSectionWeight(task.traderRequirements.map(requirementLabel)),
        content: (
          <ul className="flex flex-col gap-1">
            {task.traderRequirements.map((requirement, index) => {
              const unmet = availability?.unmetTraderRequirements.some(
                (entry) =>
                  entry.traderId === requirement.traderId &&
                  entry.requirementType === requirement.requirementType,
              );
              return (
                // A trader requirement has no stable id in this app's
                // normalized shape; index is fine since this list never
                // reorders within a render.
                <li key={index} className={unmet ? "text-status-red" : ""}>
                  {requirementLabel(requirement)}
                </li>
              );
            })}
          </ul>
        ),
      });
    }

    if (task.itemRequirements.length > 0) {
      sections.push({
        id: "item-requirements",
        title: "Item requirements",
        weight: estimateSectionWeight(
          task.itemRequirements.map(
            (item) =>
              `${item.name} × ${String(item.count)}${item.foundInRaid ? " (found in raid)" : ""}`,
          ),
        ),
        content: (
          <ul className="flex flex-col gap-1">
            {task.itemRequirements.map((item) => (
              <li key={item.id}>
                {item.name} × {item.count}
                {item.foundInRaid && (
                  <span className="text-muted-foreground"> (found in raid)</span>
                )}
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (task.objectives.length > 0) {
      sections.push({
        id: "objectives",
        title: "Objectives",
        weight: estimateSectionWeight(
          task.objectives.map(
            (objective) => `${objective.description}${objective.optional ? " (optional)" : ""}`,
          ),
        ),
        content: (
          <ul className="flex flex-col gap-1">
            {task.objectives.map((objective) => (
              <li key={objective.id}>
                {objective.description}
                {objective.optional && <span className="text-muted-foreground"> (optional)</span>}
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (task.failConditions.length > 0) {
      sections.push({
        id: "fail-conditions",
        title: "Fail conditions",
        weight: estimateSectionWeight(
          task.failConditions.map(
            (condition) => `${condition.description}${condition.optional ? " (optional)" : ""}`,
          ),
        ),
        content: (
          <ul className="flex flex-col gap-1">
            {task.failConditions.map((condition) => (
              <li key={condition.id}>
                {condition.description}
                {condition.optional && <span className="text-muted-foreground"> (optional)</span>}
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (task.startRewards && hasRewardContent(task.startRewards)) {
      sections.push({
        id: "starting-rewards",
        title: "Starting rewards",
        weight: estimateSectionWeight(formatRewardLines(task.startRewards)),
        content: <RewardBreakdown rewards={task.startRewards} />,
      });
    }

    sections.push({
      id: "rewards",
      title: "Rewards",
      weight: estimateSectionWeight([
        `${task.experience.toLocaleString()} XP`,
        ...(task.finishRewards ? formatRewardLines(task.finishRewards) : []),
      ]),
      content: (
        <>
          <p>{task.experience.toLocaleString()} XP</p>
          {task.finishRewards && <RewardBreakdown rewards={task.finishRewards} />}
        </>
      ),
    });

    if (task.failureOutcome && hasRewardContent(task.failureOutcome)) {
      sections.push({
        id: "failure-outcome",
        title: "If this task fails",
        weight: estimateSectionWeight(formatRewardLines(task.failureOutcome)),
        content: <RewardBreakdown rewards={task.failureOutcome} />,
      });
    }
  }
  const featuredIndex = selectFeaturedSectionIndex(sections.map((section) => section.weight));

  return (
    <Dialog open={taskId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {task?.taskImageLink && (
          <div className="relative -mx-6 -mt-6 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon. */}
            <img
              src={task.taskImageLink}
              alt=""
              className="block h-40 w-full rounded-t-lg object-cover sm:h-48"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-lg bg-gradient-to-b from-black/50 to-transparent"
            />
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{task?.name ?? "Quest"}</DialogTitle>
        </DialogHeader>

        {!task ? (
          <p className="text-muted-foreground mt-4 text-sm">Quest not found.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{task.trader.name}</Badge>
              <Badge variant="outline">Level {task.minPlayerLevel}</Badge>
              {task.kappaRequired && <Badge variant="kappa">Kappa</Badge>}
              {task.lightkeeperRequired && <Badge variant="outline">Lightkeeper</Badge>}
              {availability &&
                (() => {
                  const badge = statusBadge(task, availability);
                  return <Badge variant={badge.variant}>{badge.label}</Badge>;
                })()}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {sections.map((section, index) => (
                <Card
                  key={section.id}
                  className={index === featuredIndex ? "sm:col-span-2" : undefined}
                >
                  <CardHeader className="gap-1 p-4 pb-1.5">
                    <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-sm">{section.content}</CardContent>
                </Card>
              ))}
            </div>

            {task.wikiLink && (
              <a
                href={task.wikiLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-status-blue hover:underline"
              >
                Wiki guide
              </a>
            )}

            {availability?.status === "inprog" && !task.restartable && (
              <p className="text-muted-foreground text-xs">
                This task cannot be retried after failing.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {availability?.status === "notstarted" && (
                <Button
                  type="button"
                  disabled={!availability.isAvailable}
                  onClick={() => {
                    startTask(task.id);
                  }}
                >
                  Start
                </Button>
              )}
              {availability?.status === "inprog" && (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      doneTask(task.id);
                    }}
                  >
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      failTask(task.id);
                    }}
                  >
                    Fail
                  </Button>
                </>
              )}
              {(availability?.status === "done" || availability?.status === "failed") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    undoTask(task.id);
                  }}
                >
                  Undo
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  togglePinnedTask(task.id);
                }}
              >
                {pinnedTaskIds.includes(task.id) ? "Unpin" : "Pin"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
