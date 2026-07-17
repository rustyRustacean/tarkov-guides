import { getAvailableQuests } from "./quest-availability";

import type { ProfileFaction, ProfileProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface MapRecommendationOptions {
  kappaOnly: boolean;
  includeLightkeeper: boolean;
}

export interface MapRecommendation {
  normalizedName: string;
  taskCount: number;
}

/**
 * The map with the most currently-available (`notstarted`, every gate met -
 * see `getAvailableQuests`) tasks referencing it, after the given filters.
 * Lightkeeper-required tasks are excluded unless `includeLightkeeper` is
 * set (a late-game/optional task set many players don't want counted by
 * default); `kappaOnly` restricts to Kappa-required tasks. Both filters are
 * independent (neither excludes the other), so any combination - neither,
 * either, or both - is valid. Ties keep whichever map was inserted first
 * (task iteration order). Returns `null` when nothing qualifies (no
 * available tasks reference any specific map after filtering).
 */
export function getBestMapRecommendation(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
  faction: ProfileFaction,
  options: MapRecommendationOptions,
): MapRecommendation | null {
  const availableTasks = getAvailableQuests(tasks, progress, faction).filter((task) => {
    if (options.kappaOnly && !task.kappaRequired) return false;
    if (!options.includeLightkeeper && task.lightkeeperRequired) return false;
    return true;
  });

  const countByMap = new Map<string, number>();
  for (const task of availableTasks) {
    for (const mapName of task.maps) {
      countByMap.set(mapName, (countByMap.get(mapName) ?? 0) + 1);
    }
  }

  let best: MapRecommendation | null = null;
  for (const [normalizedName, taskCount] of countByMap) {
    if (!best || taskCount > best.taskCount) best = { normalizedName, taskCount };
  }
  return best;
}
