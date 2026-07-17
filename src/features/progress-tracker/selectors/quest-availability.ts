import type { ProfileFaction, ProfileProgress, TaskProgress, TaskStatus } from "../types";
import type { NormalizedTask, TraderRequirement } from "@/shared/lib/tarkov-api/types";

/** Maps our stored vocabulary to tarkov.dev's, exactly as legacy's `prereqsMet` does (`done`→`"complete"`, `inprog`→`"active"`, else passthrough). */
const STATUS_TO_WIRE_STATUS: Record<TaskStatus, string> = {
  done: "complete",
  inprog: "active",
  notstarted: "notstarted",
  failed: "failed",
};

/**
 * A prerequisite's status condition is satisfied, but the task's own
 * `availableDelaySecondsMin/Max` (a real in-game timer - see
 * {@link NormalizedTask.availableDelaySecondsMin}) hasn't elapsed since the
 * prerequisite completed. Confirmed real via live tarkov.dev data + wiki
 * cross-reference during the 2026-07-16 task-data audit (e.g. "The Door"'s
 * wiki infobox literally annotates its prerequisite as `(+2hr)`, matching
 * its live `availableDelaySecondsMin/Max` of 7200/7700).
 */
export interface DelayedUnlockInfo {
  prereqTaskId: string;
  /** ISO timestamp - the earliest real unlock time (prereq's `completedAt` + `availableDelaySecondsMin`). */
  unlocksAtMin: string;
  /** ISO timestamp - the latest real unlock time (prereq's `completedAt` + `availableDelaySecondsMax`). */
  unlocksAtMax: string;
}

/**
 * Formats a {@link DelayedUnlockInfo} into a short human string ("~2 hrs" or
 * "~2.0-2.1 hrs" when the min/max window differs) for the "Locked - unlocks
 * in ~X hrs" UI hint `QuestCard`/`QuestDetailDialog` show in place of a bare
 * "Locked" state once the only remaining gate is the real-time delay.
 */
export function formatDelayedUnlockEta(delayedUnlock: DelayedUnlockInfo): string {
  const now = Date.now();
  const minHours = Math.max(0, new Date(delayedUnlock.unlocksAtMin).getTime() - now) / 3_600_000;
  const maxHours = Math.max(0, new Date(delayedUnlock.unlocksAtMax).getTime() - now) / 3_600_000;
  const label = (hours: number): string => (hours < 1 ? "<1" : hours.toFixed(1));
  const minLabel = label(minHours);
  const maxLabel = label(maxHours);
  return minLabel === maxLabel ? `~${minLabel} hrs` : `~${minLabel}-${maxLabel} hrs`;
}

export interface PrerequisiteCheckResult {
  met: boolean;
  unmetTaskIds: readonly string[];
  /** Set when a status-satisfied prerequisite is still within its real-time delay window. `null` otherwise (no delay, or the delay has already elapsed). When multiple requirements are simultaneously delay-gated, this carries the first one found - a rare (no task currently has >1 delay-gated prerequisite as of the audit) and UI-hint-only case. */
  delayedUnlock: DelayedUnlockInfo | null;
}

/**
 * Checks every one of `task.taskRequirements` against `taskProgress`. An
 * unknown/missing prerequisite task (e.g. belongs to the other faction) is
 * treated as met (fail-open). An empty `status` array on a requirement is
 * also treated as met. Both match confirmed legacy behavior
 * (`old/TarkovTrackerWB-main/src/components/hideout/hideoutGoal.js`'s
 * `prereqsMet`) - this is the real, non-stubbed implementation that fixes
 * the confirmed bug in `old/tarkov-tips/src/components/kappa/quests/QuestNode.tsx`,
 * whose own `prerequisitesMet` check was a no-op stub (`.every(() => true)`).
 *
 * Once a requirement's status condition is met, also checks the task's real
 * `availableDelaySecondsMin` against the prerequisite's `completedAt` (added
 * 2026-07-16 task-data audit - 24 real tasks have a nonzero delay). A
 * prerequisite with no recorded `completedAt` (done before this field
 * existed, or done before the delay fields existed on `NormalizedTask`)
 * fails open - treated as elapsed rather than locking the task indefinitely.
 */
export function arePrerequisitesMet(
  task: NormalizedTask,
  tasksById: ReadonlyMap<string, NormalizedTask>,
  taskProgress: Readonly<Record<string, TaskProgress | undefined>>,
): PrerequisiteCheckResult {
  const unmetTaskIds: string[] = [];
  let delayedUnlock: DelayedUnlockInfo | null = null;

  for (const requirement of task.taskRequirements) {
    if (requirement.status.length === 0) continue;
    if (!tasksById.has(requirement.taskId)) continue;

    const prereqProgress = taskProgress[requirement.taskId];
    const currentStatus = prereqProgress?.status ?? "notstarted";
    const wireStatus = STATUS_TO_WIRE_STATUS[currentStatus];
    if (!requirement.status.includes(wireStatus)) {
      unmetTaskIds.push(requirement.taskId);
      continue;
    }

    const hasDelay = task.availableDelaySecondsMin > 0 || task.availableDelaySecondsMax > 0;
    if (hasDelay && prereqProgress?.completedAt !== undefined) {
      const completedAtMs = new Date(prereqProgress.completedAt).getTime();
      const unlocksAtMinMs = completedAtMs + task.availableDelaySecondsMin * 1000;
      if (Date.now() < unlocksAtMinMs) {
        unmetTaskIds.push(requirement.taskId);
        delayedUnlock ??= {
          prereqTaskId: requirement.taskId,
          unlocksAtMin: new Date(unlocksAtMinMs).toISOString(),
          unlocksAtMax: new Date(
            completedAtMs + task.availableDelaySecondsMax * 1000,
          ).toISOString(),
        };
      }
    }
  }
  return { met: unmetTaskIds.length === 0, unmetTaskIds, delayedUnlock };
}

/**
 * `task.factionName` is `"Any"`, `"BEAR"`, or `"USEC"` on live tarkov.dev
 * data (2026-07-16 audit - confirmed 498/6/6 across all 510 real tasks,
 * `null` never actually observed) - `"Any"` is available to every faction,
 * otherwise it must match the profile's own faction exactly. A `null`
 * `factionName` (the wire type's nullability, unobserved in practice) fails
 * open the same as `"Any"` rather than locking every task with unset
 * faction data. 12 real tasks are faction-exclusive as of the audit.
 */
export function meetsFactionRequirement(task: NormalizedTask, faction: ProfileFaction): boolean {
  return task.factionName === null || task.factionName === "Any" || task.factionName === faction;
}

/**
 * `task.requiredPrestigeLevel` means "the player must already have at least
 * this Prestige tier" - confirmed via wiki cross-reference (2026-07-16 audit)
 * against all 4 real "New Beginning" tasks, whose wiki requirement text
 * ("Must have Prestige level N") matches tarkov.dev's
 * `requiredPrestige.prestigeLevel: N` exactly. `null` means no Prestige gate.
 */
export function meetsPrestigeRequirement(task: NormalizedTask, prestigeLevel: number): boolean {
  return task.requiredPrestigeLevel === null || prestigeLevel >= task.requiredPrestigeLevel;
}

function compareValue(actual: number, compareMethod: string, required: number): boolean {
  switch (compareMethod) {
    case ">=":
      return actual >= required;
    case ">":
      return actual > required;
    case "<=":
      return actual <= required;
    case "<":
      return actual < required;
    case "=":
    case "==":
      return actual === required;
    default:
      // Unobserved operator: fail open on the most common real-world case
      // (tarkov.dev's live data only ever showed ">=","<","<=" as of the
      // 2026-07-10 schema check) rather than silently locking a quest.
      return actual >= required;
  }
}

export interface TraderRequirementCheckResult {
  met: boolean;
  unmet: readonly TraderRequirement[];
}

/**
 * Real trader-loyalty/reputation gating backed by tarkov.dev's live
 * `traderRequirements` data (see `src/shared/lib/tarkov-api/constants.ts`).
 * `requirementType: "reputation"` reads from `traderReputation` (default
 * `0` when unset, matching legacy's Fence/scav-karma default); anything
 * else (currently only the observed `"level"`) reads from `traderLevels`
 * (default `1`).
 */
export function meetsTraderRequirements(
  task: NormalizedTask,
  progress: ProfileProgress,
): TraderRequirementCheckResult {
  const unmet: TraderRequirement[] = [];
  for (const requirement of task.traderRequirements) {
    const actual =
      requirement.requirementType === "reputation"
        ? (progress.traderReputation[requirement.traderId] ?? 0)
        : (progress.traderLevels[requirement.traderId] ?? 1);
    if (!compareValue(actual, requirement.compareMethod, requirement.value)) {
      unmet.push(requirement);
    }
  }
  return { met: unmet.length === 0, unmet };
}

export interface QuestAvailability {
  taskId: string;
  status: TaskStatus;
  /** `notstarted` AND every gate (prerequisites, player level, trader requirements, faction, Prestige) is met. */
  isAvailable: boolean;
  /** `notstarted` but at least one gate is unmet. */
  isLocked: boolean;
  unmetPrereqTaskIds: readonly string[];
  unmetTraderRequirements: readonly TraderRequirement[];
  /** Set when the only reason a status-satisfied prerequisite doesn't count yet is the real-time delay window - see {@link DelayedUnlockInfo}. */
  delayedUnlock: DelayedUnlockInfo | null;
  /** `true` when this task belongs to the other faction (`factionName` is `"BEAR"`/`"USEC"` and doesn't match the profile's faction). */
  factionMismatch: boolean;
  /** `true` when the profile's `prestigeLevel` is below `task.requiredPrestigeLevel`. Always `false` for an ungated task. */
  prestigeUnmet: boolean;
}

/**
 * The single canonical availability computation for every quest-related
 * view (list, tree, trader board, analytics, recommendations). Replaces
 * what legacy independently re-implemented 6-7 times across
 * `QuestTracker.tsx`/`QuestTreeView.tsx`/`QuestNode.tsx`/`QuestCharts.tsx`/
 * `QuestRecommendations.tsx` - several of those copies had real, confirmed
 * bugs (see `arePrerequisitesMet`'s doc comment) that this consolidation
 * fixes for every consumer at once.
 *
 * `faction` gating and Prestige gating were added in the 2026-07-16
 * task-data audit - both are real tarkov.dev-enforced gates
 * (`task.factionName`/`task.requiredPrestigeLevel`) that had no consumer
 * anywhere in this app before, confirmed via a full grep across `src/`.
 */
export function getQuestAvailability(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
  faction: ProfileFaction,
): ReadonlyMap<string, QuestAvailability> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  const result = new Map<string, QuestAvailability>();
  for (const task of tasks) {
    const status = progress.taskStatus[task.id]?.status ?? "notstarted";
    const prereqResult = arePrerequisitesMet(task, tasksById, progress.taskStatus);
    const levelMet = task.minPlayerLevel <= progress.playerLevel;
    const traderResult = meetsTraderRequirements(task, progress);
    const factionMet = meetsFactionRequirement(task, faction);
    const prestigeMet = meetsPrestigeRequirement(task, progress.prestigeLevel);

    const isAvailable =
      status === "notstarted" &&
      prereqResult.met &&
      levelMet &&
      traderResult.met &&
      factionMet &&
      prestigeMet;
    const isLocked = status === "notstarted" && !isAvailable;

    result.set(task.id, {
      taskId: task.id,
      status,
      isAvailable,
      isLocked,
      unmetPrereqTaskIds: prereqResult.unmetTaskIds,
      unmetTraderRequirements: traderResult.unmet,
      delayedUnlock: prereqResult.delayedUnlock,
      factionMismatch: !factionMet,
      prestigeUnmet: !prestigeMet,
    });
  }
  return result;
}

/** Single-task convenience wrapper around the same checks {@link getQuestAvailability} performs for a whole list. */
export function isQuestAvailable(
  task: NormalizedTask,
  tasksById: ReadonlyMap<string, NormalizedTask>,
  progress: ProfileProgress,
  faction: ProfileFaction,
): boolean {
  const status = progress.taskStatus[task.id]?.status ?? "notstarted";
  if (status !== "notstarted") return false;
  return (
    arePrerequisitesMet(task, tasksById, progress.taskStatus).met &&
    task.minPlayerLevel <= progress.playerLevel &&
    meetsTraderRequirements(task, progress).met &&
    meetsFactionRequirement(task, faction) &&
    meetsPrestigeRequirement(task, progress.prestigeLevel)
  );
}

/** Every task currently `notstarted` with all availability gates met. */
export function getAvailableQuests(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
  faction: ProfileFaction,
): readonly NormalizedTask[] {
  const availability = getQuestAvailability(tasks, progress, faction);
  return tasks.filter((task) => availability.get(task.id)?.isAvailable === true);
}

/** Every task currently `notstarted` with at least one availability gate unmet. */
export function getLockedQuests(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
  faction: ProfileFaction,
): readonly NormalizedTask[] {
  const availability = getQuestAvailability(tasks, progress, faction);
  return tasks.filter((task) => availability.get(task.id)?.isLocked === true);
}

/**
 * Derives "what does completing this quest unlock" ON THE FLY from
 * `taskRequirements` (id-based, correct) instead of trusting any persisted
 * names-based field - fixes the confirmed legacy bug where
 * `Quest.unlocks` stored quest *names*, which the tree view's ID-based
 * lookups (and a recommendation-scoring bonus) then silently never
 * matched. No `unlocks` field exists anywhere in this app's data model.
 */
export function getQuestDependents(
  taskId: string,
  tasks: readonly NormalizedTask[],
): readonly NormalizedTask[] {
  return tasks.filter((task) =>
    task.taskRequirements.some((requirement) => requirement.taskId === taskId),
  );
}

function buildDependentsIndex(
  tasks: readonly NormalizedTask[],
): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const task of tasks) {
    for (const requirement of task.taskRequirements) {
      const dependents = index.get(requirement.taskId);
      if (dependents) dependents.push(task.id);
      else index.set(requirement.taskId, [task.id]);
    }
  }
  return index;
}

/**
 * Every task gated behind `taskId` transitively - not just its direct
 * `getQuestDependents`, but everything further down every chain that
 * branches from those. Memoized DFS over a taskId->direct-dependents index
 * built once for the whole list: `cache` stores each task's fully-resolved
 * descendant set so a descendant reachable through more than one branch
 * (a diamond in the dependency graph) is walked once and still counted once,
 * not once per incoming branch. `inProgress` breaks cycles the same
 * defensive way `quest-tree-layout.ts`'s `resolveLayer` does (real tarkov.dev
 * task data has none, but nothing here assumes that) - an ancestor still
 * being resolved contributes no further descendants rather than recursing
 * forever.
 */
function collectTransitiveDependents(
  taskId: string,
  dependentsIndex: ReadonlyMap<string, readonly string[]>,
  cache: Map<string, ReadonlySet<string>>,
  inProgress: Set<string>,
): ReadonlySet<string> {
  const cached = cache.get(taskId);
  if (cached) return cached;
  if (inProgress.has(taskId)) return new Set();
  inProgress.add(taskId);

  const result = new Set<string>();
  for (const dependentId of dependentsIndex.get(taskId) ?? []) {
    result.add(dependentId);
    for (const nested of collectTransitiveDependents(
      dependentId,
      dependentsIndex,
      cache,
      inProgress,
    )) {
      result.add(nested);
    }
  }

  inProgress.delete(taskId);
  cache.set(taskId, result);
  return result;
}

/**
 * taskId -> count of every quest transitively gated behind it (the size of
 * {@link collectTransitiveDependents}'s result), for `QuestList`'s "most
 * tasks behind it first" default sort - a foundational early quest that
 * gates a whole branch of the tree should sort above a late quest that only
 * gates its own one-off follow-up, which a direct-dependents-only count
 * (`getQuestDependents.length`) wouldn't distinguish since most real chains
 * are linear (each part requires only the part directly before it).
 */
export function getTasksBehindCounts(
  tasks: readonly NormalizedTask[],
): ReadonlyMap<string, number> {
  const dependentsIndex = buildDependentsIndex(tasks);
  const cache = new Map<string, ReadonlySet<string>>();
  const counts = new Map<string, number>();
  for (const task of tasks) {
    counts.set(
      task.id,
      collectTransitiveDependents(task.id, dependentsIndex, cache, new Set()).size,
    );
  }
  return counts;
}

/** Exported so `QuestRecommendations` can describe this same factor in its reason chips without duplicating the magic number. */
export const HIGH_VALUE_REWARD_THRESHOLD_RUB = 50_000;

/**
 * A 0-100 priority score (legacy's `calculateImpactScore` capped at 15
 * despite every filter UI assuming a 0-100 range - a confirmed dead-slider
 * bug this rescale fixes). Same weighted factors as legacy: XP, whether the
 * task is Kappa-required, whether it unlocks a trader, whether it grants a
 * meaningful standing gain, whether any finish-reward item is high-value,
 * plus a bonus for how many other quests this one unlocks.
 */
export function getQuestPriorityScore(
  task: NormalizedTask,
  dependents: readonly NormalizedTask[],
): number {
  let score = 0;
  score += Math.min(task.experience / 1000, 20);
  if (task.kappaRequired) score += 25;
  if ((task.finishRewards?.traderUnlock.length ?? 0) > 0) score += 15;
  const hasStandingGain = (task.finishRewards?.traderStanding ?? []).some(
    (entry) => entry.standing > 0.02,
  );
  if (hasStandingGain) score += 10;
  const hasHighValueReward = (task.finishRewards?.items ?? []).some(
    (entry) => entry.item.basePrice > HIGH_VALUE_REWARD_THRESHOLD_RUB,
  );
  if (hasHighValueReward) score += 10;
  score += Math.min(dependents.length * 4, 20);
  return Math.min(Math.round(score), 100);
}
