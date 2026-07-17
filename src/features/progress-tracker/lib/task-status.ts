import type { TaskProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/**
 * A requirement only cascades when every entry in its `status` array is
 * (case-insensitively) `"complete"` - a mixed/ambiguous requirement (e.g.
 * `["complete", "active"]`) is never auto-touched. Ported verbatim from
 * `old/TarkovTrackerWB-main/src/components/tasks/taskActions.js`'s
 * `autoCompletePrereqs`.
 */
function isStrictComplete(status: readonly string[]): boolean {
  return status.length > 0 && status.every((entry) => entry.toLowerCase() === "complete");
}

export interface AutoCompletePrereqsResult {
  /** taskId → the new `TaskProgress` to merge in. */
  patch: Readonly<Record<string, TaskProgress>>;
  /** ids of tasks that were auto-completed by this cascade, in cascade order - used for toast copy. */
  cascadedTaskIds: readonly string[];
}

/**
 * Walks `task.taskRequirements` recursively, auto-marking any strictly-complete
 * prerequisite as done. Never overwrites a prerequisite already `done`/`failed`.
 * Can cascade across traders (tarkov.dev's requirements carry no trader field,
 * confirmed via `taskActions.js`'s own comment). A `visited` set prevents
 * re-processing the same task twice within one cascade (diamond dependencies /
 * cyclic data).
 */
export function computeAutoCompletePrereqsPatch(
  task: NormalizedTask,
  tasksById: ReadonlyMap<string, NormalizedTask>,
  taskStatus: Readonly<Record<string, TaskProgress>>,
): AutoCompletePrereqsResult {
  const patch: Record<string, TaskProgress> = {};
  const cascadedTaskIds: string[] = [];
  const visited = new Set<string>();

  function walk(current: NormalizedTask): void {
    for (const requirement of current.taskRequirements) {
      if (visited.has(requirement.taskId)) continue;
      visited.add(requirement.taskId);
      if (!isStrictComplete(requirement.status)) continue;

      const prereqTask = tasksById.get(requirement.taskId);
      if (!prereqTask) continue;

      const existing = patch[requirement.taskId] ?? taskStatus[requirement.taskId];
      if (existing?.status === "done" || existing?.status === "failed") continue;

      patch[requirement.taskId] = { ...existing, status: "done", autoDone: true };
      cascadedTaskIds.push(requirement.taskId);

      walk(prereqTask);
    }
  }

  walk(task);
  return { patch, cascadedTaskIds };
}

export interface AutoStartUnlockedResult {
  patch: Readonly<Record<string, TaskProgress>>;
  startedTaskIds: readonly string[];
}

/**
 * Scans every `notstarted` task; auto-starts (`inprog`, `autoStarted: true`)
 * any whose ALL strict-complete requirements are now satisfied, including
 * the just-completed `doneTaskId`. No-op unless `autoStartNext` is true.
 * Ported from `taskActions.js`'s `autoStartUnlockedBy`.
 */
export function computeAutoStartUnlockedPatch(
  doneTaskId: string,
  tasks: readonly NormalizedTask[],
  taskStatus: Readonly<Record<string, TaskProgress>>,
  autoStartNext: boolean,
): AutoStartUnlockedResult {
  const patch: Record<string, TaskProgress> = {};
  const startedTaskIds: string[] = [];
  if (!autoStartNext) return { patch, startedTaskIds };

  for (const candidate of tasks) {
    const status = taskStatus[candidate.id]?.status ?? "notstarted";
    if (status !== "notstarted") continue;

    const strictRequirements = candidate.taskRequirements.filter((requirement) =>
      isStrictComplete(requirement.status),
    );
    if (strictRequirements.length === 0) continue;
    if (!strictRequirements.some((requirement) => requirement.taskId === doneTaskId)) continue;

    const allMet = strictRequirements.every(
      (requirement) => taskStatus[requirement.taskId]?.status === "done",
    );
    if (!allMet) continue;

    patch[candidate.id] = { ...taskStatus[candidate.id], status: "inprog", autoStarted: true };
    startedTaskIds.push(candidate.id);
  }

  return { patch, startedTaskIds };
}

/**
 * `have` counts for every item a task requires, captured at the moment it's
 * marked done so an `undoTask` can restore stash exactly. Ported from
 * `taskActions.js`'s `doneTask`'s `taskStatus[id].snap` - `have`-only,
 * `pending` deliberately untouched.
 */
export function buildTaskCompletionSnapshot(
  task: NormalizedTask,
  have: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const snapshot: Record<string, number> = {};
  for (const item of task.itemRequirements) {
    snapshot[item.id] = have[item.id] ?? 0;
  }
  return snapshot;
}
