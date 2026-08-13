import { MAP_VARIANT_SETS } from "@/features/maps/lib/boss-groups";

import { getAvailableQuests } from "./quest-availability";

import type { ProfileFaction, ProfileProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface MapRecommendationOptions {
  kappaOnly: boolean;
  includeLightkeeper: boolean;
}

/**
 * variant map id -> base map id (e.g. `"ground-zero-21"` -> `"ground-zero"`),
 * derived from {@link MAP_VARIANT_SETS}, the same table the Maps feature's
 * boss strip uses to merge a level-/time-gated variant into its base map's
 * single display. A task's `maps` frequently lists both the base id and the
 * variant id for the same physical location (e.g. every current Ground Zero
 * task lists `"ground-zero"` and `"ground-zero-21"` together), so without
 * this canonicalization step the variant would surface as its own
 * duplicate location card carrying the exact same tasks.
 */
const VARIANT_TO_BASE_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(MAP_VARIANT_SETS).map(([baseMapName, { variant }]) => [variant.id, baseMapName]),
);

export interface MapTaskRecommendation {
  normalizedName: string;
  taskCount: number;
  tasks: readonly NormalizedTask[];
}

/**
 * Every map referenced by at least one currently-available (`notstarted`,
 * every gate met; see `getAvailableQuests`) task, after the given filters,
 * each carrying the tasks that reference it. Sorted most-available-tasks
 * first, so `[0]` is always the single best pick (what
 * `getBestMapRecommendation` used to return alone). Lightkeeper-required
 * tasks are excluded unless `includeLightkeeper` is set (a late-game/
 * optional task set many players don't want counted by default);
 * `kappaOnly` restricts to Kappa-required tasks. Both filters are
 * independent (neither excludes the other), so any combination (neither,
 * either, or both) is valid. A task referencing multiple maps (`task.maps`)
 * appears under each of them. Ties keep whichever map was inserted first
 * (task iteration order) since `Array.prototype.sort` is stable. Returns an
 * empty array when nothing qualifies (no available tasks reference any
 * specific map after filtering).
 */
export function getMapRecommendations(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
  faction: ProfileFaction,
  options: MapRecommendationOptions,
): readonly MapTaskRecommendation[] {
  const availableTasks = getAvailableQuests(tasks, progress, faction).filter((task) => {
    if (options.kappaOnly && !task.kappaRequired) return false;
    if (!options.includeLightkeeper && task.lightkeeperRequired) return false;
    return true;
  });

  const tasksByMap = new Map<string, NormalizedTask[]>();
  for (const task of availableTasks) {
    // Canonicalize through `VARIANT_TO_BASE_MAP` and dedupe per task first,
    // so a task listing both a base map and its variant (e.g. "ground-zero"
    // + "ground-zero-21") only counts once against the base map's card.
    const canonicalMapNames = new Set(
      task.maps.map((mapName) => VARIANT_TO_BASE_MAP.get(mapName) ?? mapName),
    );
    for (const mapName of canonicalMapNames) {
      const existing = tasksByMap.get(mapName);
      if (existing) existing.push(task);
      else tasksByMap.set(mapName, [task]);
    }
  }

  return Array.from(tasksByMap, ([normalizedName, mapTasks]) => ({
    normalizedName,
    taskCount: mapTasks.length,
    tasks: mapTasks,
  })).sort((a, b) => b.taskCount - a.taskCount);
}
