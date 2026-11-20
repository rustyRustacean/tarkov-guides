"use client";

import { useEffect, useRef } from "react";

import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { computeAutoCompletePrereqsPatch } from "@/features/progress-tracker/lib/task-status";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { isSeasonalMode } from "./companion-config";
import {
  reportCompanionSync,
  reportCompanionSyncSkipped,
  useCompanionStatus,
  useCompanionSyncRequest,
  useEverConnected,
} from "./use-companion";
import {
  companionModeToProfileMode,
  linkedSiteProfileId,
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

/** The flat mapping: only tasks the companion places *further along* than `current`. */
function buildFlatTaskSyncPatch(
  quests: Readonly<Record<string, CompanionQuestStatus>>,
  current: Readonly<Record<string, TaskProgress>>,
  validTaskIds: ReadonlySet<string> | null,
): Record<string, TaskProgress> {
  const patch: Record<string, TaskProgress> = {};
  for (const [taskId, companionStatus] of Object.entries(quests)) {
    if (validTaskIds && !validTaskIds.has(taskId)) continue;
    const target = COMPANION_TO_SITE[companionStatus];
    const existing = current[taskId]?.status ?? "notstarted";
    if (RANK[target] <= RANK[existing]) continue;
    patch[taskId] = { status: target };
  }
  return patch;
}

/** Reset entries for every status the prerequisite cascade wrote (`autoDone`): inferred, never ticked by hand. */
function resetInferredDones(
  current: Readonly<Record<string, TaskProgress>>,
): Record<string, TaskProgress> {
  const reset: Record<string, TaskProgress> = {};
  for (const [taskId, progress] of Object.entries(current)) {
    if (progress.autoDone === true) reset[taskId] = { status: "notstarted" };
  }
  return reset;
}

/**
 * Build the `setTaskStatuses` patch that brings a profile's tasks up to the
 * companion's game state. Pure, so it can be tested exhaustively.
 *
 * - Maps finished→done, started→inprog, failed→failed.
 * - Skips task ids the game data doesn't know (edition-locked/removed quests).
 * - Never downgrades: only tasks the companion places *further along* than the
 *   profile already has are included (so manual progress is never clobbered).
 * - **Backfills prerequisites.** A `done`/`inprog` task proves every
 *   strictly-required prerequisite was already completed, so each one cascades
 *   via the same {@link computeAutoCompletePrereqsPatch} a manual click uses.
 *   This is what covers a player whose logs are partial (cleared logs, a
 *   fresh install, or the ~15% of quest events that don't resolve to a known
 *   task), where the raw log state alone would show a late task done with its
 *   whole chain still "not started". Pass `tasksById` to enable it; omit to
 *   get the flat mapping only.
 *   - Evidence beats inference: a task the companion reports `started` or
 *     `failed` is never marked done by the cascade.
 *   - Inferred dones (`autoDone`) are rebuilt on every pass rather than kept
 *     forever: they are reset, then re-derived from the tasks that are
 *     currently done or in progress. An inference that no longer holds (the
 *     task data changed, or it was wrong) disappears; one that still holds is
 *     left untouched and so not part of the patch.
 */
export function buildTaskSyncPatch(
  quests: Readonly<Record<string, CompanionQuestStatus>>,
  current: Readonly<Record<string, TaskProgress>>,
  validTaskIds: ReadonlySet<string> | null,
  tasksById?: ReadonlyMap<string, NormalizedTask>,
): Record<string, TaskProgress> {
  if (!tasksById) return buildFlatTaskSyncPatch(quests, current, validTaskIds);

  const reset = resetInferredDones(current);
  const base = { ...current, ...reset };
  const patch = { ...reset, ...buildFlatTaskSyncPatch(quests, base, validTaskIds) };

  const observedTaskIds = new Set(
    Object.entries(quests)
      .filter(([, companionStatus]) => companionStatus !== "finished")
      .map(([taskId]) => taskId),
  );

  // Cascade from every task that is now done or in progress. Each call is
  // handed the merged (base + accumulated) state, so a prerequisite already
  // resolved by an earlier cascade is skipped rather than re-walked: the
  // whole pass stays linear in practice even though chains overlap heavily.
  const sources = Object.entries({ ...base, ...patch }).filter(
    ([, progress]) => progress.status === "done" || progress.status === "inprog",
  );
  for (const [taskId] of sources) {
    const task = tasksById.get(taskId);
    if (!task) continue;
    const cascade = computeAutoCompletePrereqsPatch(
      task,
      tasksById,
      { ...base, ...patch },
      observedTaskIds,
    );
    Object.assign(patch, cascade.patch);
  }

  // Drop entries that leave the profile as it already is (a re-derived
  // inference), so they keep their original `completedAt` and a settled
  // profile yields an empty patch.
  return Object.fromEntries(
    Object.entries(patch).filter(([taskId, progress]) => {
      const existing = current[taskId];
      return existing?.status !== progress.status || existing.autoDone !== progress.autoDone;
    }),
  );
}

/**
 * Task patch for a SEASONAL character's profile. Nothing is inferred here:
 * the profile mirrors what the logs prove, and every `autoDone` entry (only
 * the standard-chain cascade ever writes one) is reset. Tasks the user ticked
 * by hand carry no `autoDone` flag and are left alone; a reset task the logs
 * DO prove is re-added at its proven status by the flat pass, which runs
 * against the pruned state so a reset never blocks a re-add via the
 * no-downgrade rule.
 *
 * Why the prerequisite cascade stays off for Seasonal (decided in #57):
 * - Seasons reportedly follow their own unlock rules ("unlocking Z completes
 *   X and Y"), not the standard chain. On a real seasonal character the
 *   cascade produced 13 phantom dones from 6 real starts (August 2026).
 * - Seasonal now reads tarkov.dev's own `pvp-season` tasks, but their
 *   `taskRequirements` are a copy of the regular chain (461 of 462 identical
 *   when checked on 2026-11-11; the other only drops a requirement), so they
 *   are the same data that misfired, not separate evidence of a season's rules.
 * - Revisit with a real seasonal companion `/status` fixture: if the chain
 *   holds there (no task the logs report started or failed would be inferred
 *   done, and no reported start has an unfinished strict prerequisite), switch
 *   this to {@link buildTaskSyncPatch} with `tasksById`.
 */
export function buildSeasonalTaskSyncPatch(
  quests: Readonly<Record<string, CompanionQuestStatus>>,
  current: Readonly<Record<string, TaskProgress>>,
  validTaskIds: ReadonlySet<string> | null,
): Record<string, TaskProgress> {
  const reset = resetInferredDones(current);
  const flat = buildFlatTaskSyncPatch(quests, { ...current, ...reset }, validTaskIds);
  return { ...reset, ...flat };
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
  const hydrationCount = useProgressTrackerStore((state) => state.hydrationCount);
  const setTaskStatuses = useProgressTrackerStore((state) => state.setTaskStatuses);
  const appliedRef = useRef<string>("");
  const syncRequest = useCompanionSyncRequest();

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
    if (activeMode !== siteMode) {
      reportCompanionSyncSkipped("mode");
      return;
    }

    // If this game character is linked to a *different* profile than the
    // active one, don't cross-write: leave the visible profile alone.
    const linked = gameProfileId ? readProfileMap()[gameProfileId] : undefined;
    // The map value is a `profileId:MODE` key, so it has to be unpacked before
    // comparing with the bare active profile id; comparing it raw never
    // matched and silently blocked every sync for any linked character.
    if (linked !== undefined && linkedSiteProfileId(linked) !== activeProfileId) {
      reportCompanionSyncSkipped("profile");
      return;
    }

    // The active profile has no character in this mode yet (the header's mode
    // switch allows that). The store would ignore the write, so say why
    // instead of reporting tasks as updated.
    if (activeProgress === undefined) {
      reportCompanionSyncSkipped("setup");
      return;
    }

    // The identity of a pass. `syncRequest` makes "Sync now" always count as
    // new; `hydrationCount` makes a profile loaded from elsewhere (saved state
    // arriving late, a restore, a folder link) get reconciled with the game.
    // The user's own edits are deliberately NOT part of it: a manual fix,
    // such as reverting a wrong inferred done, holds until the game reports
    // something new or "Sync now" is pressed, instead of being overwritten
    // on the spot.
    const signature = `${activeProfileId}|${gameProfileId ?? ""}|${String(counts?.finished ?? 0)}-${String(counts?.started ?? 0)}-${String(counts?.failed ?? 0)}|${String(syncRequest)}|${String(hydrationCount)}`;
    if (appliedRef.current === signature) return;

    const current = activeProgress.taskStatus;
    const validIds = tasksById.size > 0 ? new Set(tasksById.keys()) : null;
    // Seasonal skips the cascade that backfills prerequisites; see
    // `buildSeasonalTaskSyncPatch` for why.
    const patch = isSeasonalMode(companionMode)
      ? buildSeasonalTaskSyncPatch(quests, current, validIds)
      : buildTaskSyncPatch(quests, current, validIds, tasksById);
    if (Object.keys(patch).length > 0) setTaskStatuses(patch);
    reportCompanionSync(Object.keys(patch).length);
    // The companion's status routinely arrives before the quest list has
    // loaded. That first pass can't cascade prerequisites or filter unknown
    // ids, so it must not be remembered as done: once the list arrives
    // `tasksById` changes, this effect runs again, and the patch is
    // idempotent (nothing is ever downgraded or re-written).
    if (tasksById.size > 0) appliedRef.current = signature;
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
    hydrationCount,
    tasksById,
    setTaskStatuses,
    syncRequest,
  ]);
}
