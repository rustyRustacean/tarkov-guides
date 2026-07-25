"use client";

import { useMemo } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { useUndoableState } from "@/shared/lib/use-undoable-state";
import { toast } from "@/shared/ui/toast/toast-store";

import {
  buildTaskCompletionSnapshot,
  computeAutoCompletePrereqsPatch,
  computeAutoStartUnlockedPatch,
} from "../lib/task-status";
import { isQuestAvailable } from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { useActiveFaction } from "./use-active-faction";

import type { ProfileProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function pluralize(count: number, singular: string): string {
  return `${String(count)} ${singular}${count === 1 ? "" : "s"}`;
}

export interface UseTaskActionsResult {
  startTask: (taskId: string) => void;
  doneTask: (taskId: string) => void;
  failTask: (taskId: string) => void;
  /** Reverts a done/failed task back to `inprog`, restoring stash counts from the snapshot captured when it was completed - a persistent, always-available action distinct from the ephemeral toast "UNDO" button. */
  undoTask: (taskId: string) => void;
  /** Reverts an `inprog` task back to `notstarted` - ported from `old/TarkovTrackerWB-main/src/components/maps/mapSidebar.js`'s `resetTaskToNotStarted` (legacy's UNSTART). Drops `autoStarted`/any other status metadata rather than carrying it forward, same "revert to pristine" rationale as {@link undoTask}. */
  unstartTask: (taskId: string) => void;
}

/**
 * The task status state machine, ported from
 * `old/TarkovTrackerWB-main/src/components/tasks/taskActions.js`. Every
 * action here is undoable via a single shared `useUndoableState` instance
 * (`maxDepth: 1`, matching legacy's own single-slot `_lastMutation`
 * buffer covering start/done/fail/undo uniformly), scoped to the active
 * profile so switching profiles clears the stack (fixes the confirmed
 * legacy cross-profile undo-corruption bug - see `kappa.js`'s
 * `_kappaUndoStack`, the same class of bug this project's
 * `useUndoableState` was designed to prevent everywhere it's used).
 *
 * The undo snapshot is the FULL `ProfileProgress` (not just
 * `{have,pending,taskStatus}`) restored via the store's
 * `replaceActiveProgress` - deliberately NOT `setTaskStatuses` (a
 * merge-patch), since a merge can't remove a key a cascade newly added,
 * which a correct undo sometimes needs to do.
 */
export function useTaskActions(): UseTaskActionsResult {
  const { data } = useTarkovGameData();
  // `data?.tasks` is read directly (not `data?.tasks ?? []`) so the useMemo
  // dependency is a stable reference when unchanged - `?? []` would create
  // a brand-new empty-array literal every render whenever `data` is
  // undefined, defeating the memoization.
  const tasks = data?.tasks;
  const tasksById = useMemo(() => new Map((tasks ?? []).map((task) => [task.id, task])), [tasks]);

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const autoStartNext = useProgressTrackerStore((state) => state.autoStartNext);
  const setTaskStatuses = useProgressTrackerStore((state) => state.setTaskStatuses);
  const replaceActiveProgress = useProgressTrackerStore((state) => state.replaceActiveProgress);
  const replaceHaveAndPending = useProgressTrackerStore((state) => state.replaceHaveAndPending);

  const undoable = useUndoableState<ProfileProgress>({
    scopeKey: activeProfileId,
    apply: replaceActiveProgress,
  });

  function withUndoToast(message: string, task: NormalizedTask): void {
    toast({
      message: `${message} ${task.name}`,
      action: { label: "UNDO", onClick: () => undoable.undo() },
    });
  }

  function startTask(taskId: string): void {
    if (!progress) return;
    const task = tasksById.get(taskId);
    if (!task) return;

    undoable.push(progress);

    const cascade = computeAutoCompletePrereqsPatch(task, tasksById, progress.taskStatus);
    setTaskStatuses({
      ...cascade.patch,
      [taskId]: { ...progress.taskStatus[taskId], status: "inprog" },
    });

    withUndoToast(
      cascade.cascadedTaskIds.length > 0
        ? `Started (auto-completed ${pluralize(cascade.cascadedTaskIds.length, "prerequisite")}):`
        : "Started",
      task,
    );
  }

  function doneTask(taskId: string): void {
    if (!progress) return;
    const task = tasksById.get(taskId);
    if (!task) return;

    undoable.push(progress);

    const cascade = computeAutoCompletePrereqsPatch(task, tasksById, progress.taskStatus);
    const snapshot = buildTaskCompletionSnapshot(task, progress.have);
    const donePatch = {
      ...cascade.patch,
      [taskId]: {
        ...progress.taskStatus[taskId],
        status: "done" as const,
        snapshot,
        completedAt: new Date().toISOString(),
      },
    };
    setTaskStatuses(donePatch);

    const updatedTaskStatus = { ...progress.taskStatus, ...donePatch };
    const autoStart = computeAutoStartUnlockedPatch(
      taskId,
      tasks ?? [],
      updatedTaskStatus,
      autoStartNext,
    );
    // `computeAutoStartUnlockedPatch` only checks task-status prerequisites
    // (ported as-is from legacy's `autoStartUnlockedBy`) - it doesn't know
    // about trader/level/faction/Prestige gates. Cross-check each candidate
    // against the same full-gate `isQuestAvailable` every other view uses,
    // so autoStartNext can never auto-start a task the player couldn't
    // actually pick up yet (e.g. a faction-exclusive or Prestige-gated task
    // whose status-only prerequisite happens to be satisfied) - a real gap
    // found during the 2026-07-16 task-data audit.
    const updatedProgress = { ...progress, taskStatus: updatedTaskStatus };
    const confirmedStartedTaskIds =
      activeFaction === undefined
        ? []
        : autoStart.startedTaskIds.filter((id) => {
            const candidate = tasksById.get(id);
            return (
              candidate !== undefined &&
              isQuestAvailable(candidate, tasksById, updatedProgress, activeFaction)
            );
          });
    const confirmedPatch: Record<string, (typeof autoStart.patch)[string]> = {};
    for (const id of confirmedStartedTaskIds) {
      const entry = autoStart.patch[id];
      if (entry) confirmedPatch[id] = entry;
    }
    if (Object.keys(confirmedPatch).length > 0) {
      setTaskStatuses(confirmedPatch);
    }

    const clauses: string[] = [];
    if (cascade.cascadedTaskIds.length > 0) {
      clauses.push(`auto-completed ${pluralize(cascade.cascadedTaskIds.length, "prerequisite")}`);
    }
    if (confirmedStartedTaskIds.length > 0) {
      clauses.push(`auto-started ${pluralize(confirmedStartedTaskIds.length, "unlocked task")}`);
    }
    withUndoToast(clauses.length > 0 ? `Completed (${clauses.join(", ")}):` : "Completed", task);
  }

  function failTask(taskId: string): void {
    if (!progress) return;
    const task = tasksById.get(taskId);
    if (!task) return;

    undoable.push(progress);
    setTaskStatuses({
      [taskId]: {
        ...progress.taskStatus[taskId],
        status: "failed",
        completedAt: new Date().toISOString(),
      },
    });
    withUndoToast("Failed", task);
  }

  function undoTask(taskId: string): void {
    if (!progress) return;
    const task = tasksById.get(taskId);
    if (!task) return;
    const current = progress.taskStatus[taskId];
    if (current?.status !== "done" && current?.status !== "failed") return;

    undoable.push(progress);

    if (current.snapshot) {
      replaceHaveAndPending({ ...progress.have, ...current.snapshot }, progress.pending);
    }
    // Drop `snapshot`/`autoDone`/`completedAt` rather than carrying them
    // forward - an in-progress task shouldn't hold completion metadata
    // (harmless either way since `doneTask` always recomputes a fresh
    // `snapshot` on the next completion, but cleaner not to keep stale data
    // around in the meantime).
    setTaskStatuses({ [taskId]: { status: "inprog" } });

    withUndoToast("Reverted to in progress:", task);
  }

  function unstartTask(taskId: string): void {
    if (!progress) return;
    const task = tasksById.get(taskId);
    if (!task) return;
    if (progress.taskStatus[taskId]?.status !== "inprog") return;

    undoable.push(progress);
    setTaskStatuses({ [taskId]: { status: "notstarted" } });
    withUndoToast("Reset to not started:", task);
  }

  return { startTask, doneTask, failTask, undoTask, unstartTask };
}
