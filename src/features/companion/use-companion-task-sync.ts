"use client";

import { useEffect, useRef } from "react";

import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { computeAutoCompletePrereqsPatch } from "@/features/progress-tracker/lib/task-status";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { isSeasonalMode } from "./companion-config";
import { useCompanionStatus, useEverConnected } from "./use-companion";
import {
  companionModeToProfileMode,
  readProfileMap,
  useProfileSyncPreference,
} from "./use-companion-profile-sync";

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
 *   This is what covers a player whose logs are partial (cleared logs, a
 *   fresh install, or the ~15% of quest events that don't resolve to a known
 *   task), where the raw log state alone would show a late task done with its
 *   whole chain still "not started". Pass `tasksById` to enable it; omit to
 *   get the flat mapping only.
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
  // merged (current + accumulated) state, so a prerequisite already resolved
  // by an earlier cascade is skipped rather than re-walked: the whole pass
  // stays linear in practice even though chains overlap heavily.
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
 * Task patch for a SEASONAL character's profile. Seasons follow their own
 * unlock rules (reportedly "unlocking Z completes X and Y"), not the standard
 * prerequisite chain, so nothing is inferred here: the profile mirrors what
 * the logs prove, and every `autoDone` entry - which only the standard-chain
 * cascade ever writes - is a fabrication on a seasonal profile and gets reset.
 * That reset is also what heals profiles the cascade polluted before this
 * existed (observed: 13 phantom dones from 6 real starts). Tasks the user
 * ticked by hand carry no `autoDone` flag and are left alone; a reset task
 * the logs DO prove is re-added at its proven status by the flat pass, which
 * runs against the pruned state so a reset never blocks a re-add via the
 * no-downgrade rule.
 */
export function buildSeasonalTaskSyncPatch(
  quests: Readonly<Record<string, CompanionQuestStatus>>,
  current: Readonly<Record<string, TaskProgress>>,
  validTaskIds: ReadonlySet<string> | null,
): Record<string, TaskProgress> {
  const prune: Record<string, TaskProgress> = {};
  for (const [taskId, progress] of Object.entries(current)) {
    if (progress.autoDone === true) prune[taskId] = { status: "notstarted" };
  }
  const flat = buildTaskSyncPatch(quests, { ...current, ...prune }, validTaskIds);
  return { ...prune, ...flat };
}

/**
 * App-wide side effect: when the companion is connected, populate the active
 * profile's task tracker to match the character's in-game progress, on load
 * and whenever the companion picks up new quest events. Only writes into the
 * profile linked to the current game character (matching mode), applies once
 * per distinct game state, and uses {@link buildTaskSyncPatch}'s no-downgrade
 * merge so it never overwrites further-along manual progress.
 *
 * Shares the profile-sync preference (both are "sync from the game").
 *
 * Requires `everConnected` on top of that preference; see the same guard on
 * `useCompanionProfileSync` for why an unconditional poll here would trip the
 * browser's local-network permission prompt for every visitor.
 */
export function useCompanionTaskSync(): void {
  const [enabled] = useProfileSyncPreference();
  const [everConnected] = useEverConnected();
  const { status, isConnected } = useCompanionStatus(enabled && everConnected);
  const { tasksById } = useActiveModeTasks();
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const activeProgress = useActiveProgress();
  const setTaskStatuses = useProgressTrackerStore((state) => state.setTaskStatuses);
  const appliedRef = useRef<string>("");

  const quests = status?.quests;
  const counts = status?.questCounts;
  const companionMode = status?.mode ?? null;
  const gameProfileId = status?.profileId ?? null;

  useEffect(() => {
    if (!enabled || !isConnected || !quests || companionMode === null) return;
    if (activeProfileId === null) return;

    // Only sync while the currently-active MODE matches the game's. A
    // seasonal character resolves to "PVP_SEASONAL" rather than its base
    // mode (`companionModeToProfileMode`), so seasonal quest state can never
    // be written into the player's real PvP/PvE progress.
    const siteMode = companionModeToProfileMode(companionMode);
    if (activeMode !== siteMode) return;

    // If this game character is linked to a *different* profile than the
    // active one, don't cross-write: leave the visible profile alone.
    const linked = gameProfileId ? readProfileMap()[gameProfileId] : undefined;
    if (linked !== undefined && linked !== activeProfileId) return;

    const signature = `${activeProfileId}|${gameProfileId ?? ""}|${String(counts?.finished ?? 0)}-${String(counts?.started ?? 0)}-${String(counts?.failed ?? 0)}`;
    if (appliedRef.current === signature) return;

    const validIds = tasksById.size > 0 ? new Set(tasksById.keys()) : null;
    const current = activeProgress?.taskStatus ?? {};
    // A season's own unlock rules aren't the standard prerequisite chain, so
    // the cascade that backfills prerequisites is skipped there entirely.
    const patch = isSeasonalMode(companionMode)
      ? buildSeasonalTaskSyncPatch(quests, current, validIds)
      : buildTaskSyncPatch(quests, current, validIds, tasksById);
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
    activeMode,
    activeProgress,
    tasksById,
    setTaskStatuses,
  ]);
}
