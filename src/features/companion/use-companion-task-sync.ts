"use client";

import { useEffect, useRef } from "react";

import { computeAutoCompletePrereqsPatch } from "@/features/progress-tracker/lib/task-status";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useCompanionStatus } from "./use-companion";
import { readProfileMap, useProfileSyncPreference } from "./use-companion-profile-sync";

import type { CompanionQuestStatus } from "./companion-config";
import type { TaskProgress, TaskStatus } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

const COMPANION_TO_SITE: Record<CompanionQuestStatus, TaskStatus> = {
  finished: "done",
  started: "inprog",
  failed: "failed",
};

// Progress ordering, so a sync never *downgrades* a status the profile already
// has further along (the companion's log-derived state is best-effort and can
// miss the final event of a task).
const RANK: Record<TaskStatus, number> = { notstarted: 0, failed: 1, inprog: 2, done: 3 };

/**
 * Build the `setTaskStatuses` patch that brings a profile's tasks up to the
 * companion's game state. Pure, so it can be tested exhaustively.
 *
 * - Maps finished→done, started→inprog, failed→failed.
 * - Skips task ids the game data doesn't know (edition-locked/removed quests).
 * - Never downgrades: only tasks the companion places *further along* than the
 *   profile already has are included (so manual progress is never clobbered).
 * - **Backfills prerequisites.** A synced `done`/`inprog` task proves every
 *   strictly-required prerequisite was already completed, so each one cascades
 *   via the same {@link computeAutoCompletePrereqsPatch} a manual click uses.
 *   This is what covers a player whose logs are partial - cleared logs, a fresh
 *   install, or the ~15% of quest events that don't resolve to a known task -
 *   where the raw log state alone would show a late task done with its whole
 *   chain still "not started". Pass `tasksById` to enable it; omit to get the
 *   flat mapping only.
 */
export function buildTaskSyncPatch(
  quests: Readonly<Record<string, CompanionQuestStatus>>,
  current: Readonly<Record<string, TaskProgress>>,
  validTaskIds: ReadonlySet<string> | null,
  tasksById?: ReadonlyMap<string, NormalizedTask>,
): Record<string, TaskProgress> {
  const patch: Record<string, TaskProgress> = {};

  for (const [taskId, companionStatus] of Object.entries(quests)) {
    if (validTaskIds && !validTaskIds.has(taskId)) continue;
    const target = COMPANION_TO_SITE[companionStatus];
    const existing = current[taskId]?.status ?? "notstarted";
    if (RANK[target] <= RANK[existing]) continue;
    patch[taskId] = { status: target };
  }

  if (!tasksById) return patch;

  // Cascade from every task the sync just advanced. Each call is handed the
  // merged (current + accumulated) state, so a prerequisite already resolved by
  // an earlier cascade is skipped rather than re-walked - the whole pass stays
  // linear in practice even though chains overlap heavily.
  for (const taskId of Object.keys(patch)) {
    const status = patch[taskId]?.status;
    if (status !== "done" && status !== "inprog") continue;
    const task = tasksById.get(taskId);
    if (!task) continue;
    const cascade = computeAutoCompletePrereqsPatch(task, tasksById, { ...current, ...patch });
    Object.assign(patch, cascade.patch);
  }

  return patch;
}

/**
 * App-wide side effect: when the companion is connected, populate the active
 * profile's task tracker to match the character's in-game progress - on load
 * and whenever the companion picks up new quest events. Only writes into the
 * profile linked to the current game character (matching mode), applies once
 * per distinct game state, and uses {@link buildTaskSyncPatch}'s no-downgrade
 * merge so it never overwrites further-along manual progress.
 *
 * Shares the profile-sync preference (both are "sync from the game").
 */
export function useCompanionTaskSync(): void {
  const [enabled] = useProfileSyncPreference();
  const { status, isConnected } = useCompanionStatus(enabled);
  const { data } = useTarkovGameData();
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
  const setTaskStatuses = useProgressTrackerStore((state) => state.setTaskStatuses);
  const appliedRef = useRef<string>("");

  const quests = status?.quests;
  const counts = status?.questCounts;
  const companionMode = status?.mode ?? null;
  const gameProfileId = status?.profileId ?? null;

  useEffect(() => {
    if (!enabled || !isConnected || !quests || companionMode === null) return;
    if (activeProfileId === null) return;
    const active = profiles.find((profile) => profile.id === activeProfileId);
    if (!active) return;

    // Only sync into a profile of the matching mode.
    const siteMode = companionMode === "pve" ? "PVE" : "PVP";
    if (active.mode !== siteMode) return;

    // If this game character is linked to a *different* profile than the active
    // one, don't cross-write - leave the visible profile alone.
    const linked = gameProfileId ? readProfileMap()[gameProfileId] : undefined;
    if (linked !== undefined && linked !== activeProfileId) return;

    const signature = `${activeProfileId}|${gameProfileId ?? ""}|${String(counts?.finished ?? 0)}-${String(counts?.started ?? 0)}-${String(counts?.failed ?? 0)}`;
    if (appliedRef.current === signature) return;

    const tasksById = data ? new Map(data.tasks.map((task) => [task.id, task])) : null;
    const validIds = tasksById ? new Set(tasksById.keys()) : null;
    const current = progressByProfile[activeProfileId]?.taskStatus ?? {};
    const patch = buildTaskSyncPatch(quests, current, validIds, tasksById ?? undefined);
    if (Object.keys(patch).length > 0) setTaskStatuses(patch);
    appliedRef.current = signature;
  }, [
    enabled,
    isConnected,
    quests,
    counts,
    companionMode,
    gameProfileId,
    activeProfileId,
    profiles,
    progressByProfile,
    data,
    setTaskStatuses,
  ]);
}
