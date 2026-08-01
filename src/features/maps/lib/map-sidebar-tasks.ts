import { getQuestAvailability } from "@/features/progress-tracker/selectors/quest-availability";

import { isForcedTaskDisplay } from "./task-markers";

import type {
  ProfileFaction,
  ProfileProgress,
  TaskStatus,
} from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** A task shows on a map if it explicitly lists it, or lists no maps at all (an "any map" task) - ported verbatim from `old/TarkovTrackerWB-main/src/components/maps/mapSidebar.js`'s `taskRelevantToMap`. */
export function taskRelevantToMap(task: NormalizedTask, normalizedName: string): boolean {
  return task.maps.length === 0 || task.maps.includes(normalizedName);
}

function statusOf(progress: ProfileProgress, taskId: string): TaskStatus {
  return progress.taskStatus[taskId]?.status ?? "notstarted";
}

function pinFirst(
  pinnedTaskIds: readonly string[],
): (a: NormalizedTask, b: NormalizedTask) => number {
  const pinned = new Set(pinnedTaskIds);
  return (a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id));
}

export interface MapTaskGroups {
  /** Tasks that explicitly list this map, pinned-first. */
  mapSpecific: readonly NormalizedTask[];
  /** Tasks with no `maps` at all - shown on every map, pinned-first. */
  anyMap: readonly NormalizedTask[];
}

/**
 * The sidebar's default (non-search) Tasks pane contents for one map -
 * ported from `mapSidebar.js`'s `renderMapTasks` default-mode filter. Three
 * categories, unioned then split by map-specificity:
 *
 * 1. `inprog` tasks relevant to this map.
 * 2. `notstarted` tasks whose only unmet prerequisites are themselves
 *    `inprog` - i.e. the specific next task(s) that unlock the moment a
 *    currently active task completes, not every future "available" task.
 *    Uses {@link getQuestAvailability}'s `unmetPrereqTaskIds` (the same
 *    canonical availability computation every other quest view in this app
 *    already relies on) rather than reimplementing prerequisite-status
 *    checking a second time.
 * 3. `failed` tasks relevant to this map, so their UNDO action stays reachable.
 * 4. Any task manually toggled "show on map" while not active
 *    ({@link isForcedTaskDisplay}), so a marker you placed always has a
 *    matching, reachable list row - otherwise a not-started show-on-map task
 *    would draw a pin with no way to find or un-toggle it here.
 */
export function getDefaultMapTasks(
  tasks: readonly NormalizedTask[],
  normalizedName: string,
  progress: ProfileProgress,
  faction: ProfileFaction,
  taskDisplayOverrides: Readonly<Record<string, boolean>> = {},
): MapTaskGroups {
  const availability = getQuestAvailability(tasks, progress, faction);

  const inprog = tasks.filter(
    (task) => statusOf(progress, task.id) === "inprog" && taskRelevantToMap(task, normalizedName),
  );
  const nextAfterActive = tasks.filter((task) => {
    if (statusOf(progress, task.id) !== "notstarted") return false;
    if (!taskRelevantToMap(task, normalizedName)) return false;
    const info = availability.get(task.id);
    if (!info?.isLocked) return false;
    return (
      info.unmetPrereqTaskIds.length > 0 &&
      info.unmetPrereqTaskIds.every((id) => statusOf(progress, id) === "inprog")
    );
  });
  const failed = tasks.filter(
    (task) => statusOf(progress, task.id) === "failed" && taskRelevantToMap(task, normalizedName),
  );
  const forcedShown = tasks.filter(
    (task) =>
      taskRelevantToMap(task, normalizedName) &&
      isForcedTaskDisplay(statusOf(progress, task.id), taskDisplayOverrides[task.id]),
  );

  // Dedupe by id (a task can qualify under more than one category, e.g. a
  // failed task also toggled show-on-map) while preserving first-seen order.
  const seen = new Set<string>();
  const combined = [...inprog, ...nextAfterActive, ...failed, ...forcedShown].filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
  const sortPinFirst = pinFirst(progress.pinnedTaskIds);

  return {
    mapSpecific: combined
      .filter((task) => task.maps.length > 0 && task.maps.includes(normalizedName))
      .sort(sortPinFirst),
    anyMap: combined.filter((task) => task.maps.length === 0).sort(sortPinFirst),
  };
}

const STATUS_RANK: Readonly<Record<TaskStatus, number>> = {
  inprog: 0,
  notstarted: 1,
  failed: 2,
  done: 3,
};

function parseSearchTerms(query: string): readonly string[] {
  return query
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}

/** Loose match against name/trader/map (normalizedName or its space-separated form)/item name/"kappa". */
function taskMatchesTerm(task: NormalizedTask, term: string): boolean {
  if (task.name.toLowerCase().includes(term)) return true;
  if (task.trader.name.toLowerCase().includes(term)) return true;
  if (
    task.maps.some(
      (map) => map.toLowerCase().includes(term) || map.replace(/-/g, " ").includes(term),
    )
  ) {
    return true;
  }
  if (task.itemRequirements.some((item) => item.name.toLowerCase().includes(term))) return true;
  if (term === "kappa" && task.kappaRequired) return true;
  return false;
}

/**
 * Full-app-wide task search (ignores map scoping entirely) - ported from
 * `mapSidebar.js`'s search-mode branch of `renderMapTasks`. Comma-separated
 * terms are OR'd together, matched loosely against name/trader/map/item
 * name/the literal word "kappa". Results are sorted by status (active tasks
 * first) then name, matching legacy's `matches.sort(...)`.
 */
export function searchTasks(
  tasks: readonly NormalizedTask[],
  query: string,
  progress: ProfileProgress,
): readonly NormalizedTask[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  return tasks
    .filter((task) => terms.some((term) => taskMatchesTerm(task, term)))
    .slice()
    .sort((a, b) => {
      const rankDiff =
        STATUS_RANK[statusOf(progress, a.id)] - STATUS_RANK[statusOf(progress, b.id)];
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
    });
}

/**
 * The first map (other than `normalizedName`) this task is relevant to, for
 * a search result's "go to {map}" jump button - ported from `mapSidebar.js`'s
 * `renderMapTaskRow`'s `otherMaps`/`goBtn` logic. `null` for an any-map task
 * (already visible everywhere, no jump needed) or one already relevant to
 * the current map.
 */
export function firstOtherMap(task: NormalizedTask, normalizedName: string): string | null {
  if (task.maps.length === 0 || task.maps.includes(normalizedName)) return null;
  return task.maps[0] ?? null;
}
