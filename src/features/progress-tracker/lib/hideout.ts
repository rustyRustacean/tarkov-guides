import { omitKey } from "@/shared/lib/record-utils";

import { hideoutBuiltKey } from "../types";

import type { HideoutBuiltKey } from "../types";
import type { RawHideoutStation } from "@/shared/lib/tarkov-api/types";

/**
 * Toggles one hideout level's built state.
 *
 * Building a level cascades DOWN - every lower level of the SAME station is
 * also force-marked built, so a player who's already ahead in-game can jump
 * straight to level 3 without clicking 1 and 2 first. Un-building only
 * undoes the exact level clicked (no cascade). Matches legacy's
 * `toggleHideoutBuilt` in `old/TarkovTrackerWB-main/src/lib/tarkovData.js`.
 */
export function toggleHideoutBuiltPatch(
  stations: readonly RawHideoutStation[],
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  stationNormalizedName: string,
  level: number,
): Readonly<Record<HideoutBuiltKey, true>> {
  const key = hideoutBuiltKey(stationNormalizedName, level);

  if (hideoutBuilt[key] === true) {
    return omitKey(hideoutBuilt, key);
  }

  const next: Record<HideoutBuiltKey, true> = { ...hideoutBuilt };
  const station = stations.find((candidate) => candidate.normalizedName === stationNormalizedName);
  if (!station) {
    next[key] = true;
    return next;
  }
  for (const stationLevel of station.levels) {
    if (stationLevel.level <= level) {
      next[hideoutBuiltKey(stationNormalizedName, stationLevel.level)] = true;
    }
  }
  return next;
}

export interface HideoutGoalStep {
  stationNormalizedName: string;
  stationName: string;
  level: number;
  /** True only for the final target of the goal path - every prerequisite step is `false`. */
  isGoal: boolean;
}

function isLevelBuilt(
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  stationNormalizedName: string,
  level: number,
): boolean {
  return hideoutBuilt[hideoutBuiltKey(stationNormalizedName, level)] === true;
}

/**
 * Resolves the ordered build path (in "do this first" order, target last)
 * to reach `(stationNormalizedName, level)`. Same-station lower levels are
 * resolved strictly sequentially (L1 before L2 before L3, matching Tarkov's
 * real "fully build each tier" rule) before cross-station
 * `stationLevelRequirements`. Returns `[]` if the level is already built.
 * `visited` (keyed `station:level`) prevents infinite recursion on
 * cyclic/duplicate dependency data and also means a diamond dependency
 * (two branches converging on the same prerequisite) is only resolved once,
 * at its first occurrence.
 *
 * Ported as a pure algorithm from `hideoutGoalPath` in
 * `old/TarkovTrackerWB-main/src/components/hideout/hideoutGoal.js` -
 * verified correct via research, safe to port close to as-is.
 */
export function getHideoutGoalPath(
  stations: readonly RawHideoutStation[],
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  stationNormalizedName: string,
  level: number,
  visited = new Set<string>(),
): readonly HideoutGoalStep[] {
  const steps = resolveHideoutPath(stations, hideoutBuilt, stationNormalizedName, level, visited);
  if (steps.length === 0) return steps;

  const lastStep = steps[steps.length - 1];
  if (!lastStep) return steps;
  return [...steps.slice(0, -1), { ...lastStep, isGoal: true }];
}

function resolveHideoutPath(
  stations: readonly RawHideoutStation[],
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  stationNormalizedName: string,
  level: number,
  visited: Set<string>,
): HideoutGoalStep[] {
  const dedupeKey = `${stationNormalizedName}:${String(level)}`;
  if (visited.has(dedupeKey)) return [];
  visited.add(dedupeKey);

  if (isLevelBuilt(hideoutBuilt, stationNormalizedName, level)) return [];

  const station = stations.find((candidate) => candidate.normalizedName === stationNormalizedName);
  if (!station) return [];
  const targetLevel = station.levels.find((candidate) => candidate.level === level);
  if (!targetLevel) return [];

  const steps: HideoutGoalStep[] = [];

  const lowerLevels = station.levels
    .filter((candidate) => candidate.level < level)
    .sort((a, b) => a.level - b.level);
  for (const lowerLevel of lowerLevels) {
    steps.push(
      ...resolveHideoutPath(
        stations,
        hideoutBuilt,
        stationNormalizedName,
        lowerLevel.level,
        visited,
      ),
    );
  }

  for (const requirement of targetLevel.stationLevelRequirements) {
    steps.push(
      ...resolveHideoutPath(
        stations,
        hideoutBuilt,
        requirement.station.normalizedName,
        requirement.level,
        visited,
      ),
    );
  }

  steps.push({ stationNormalizedName, stationName: station.name, level, isGoal: false });

  return dedupeSteps(steps);
}

export type HideoutLevelStatus = "done" | "locked" | "started";

/**
 * Categorizes a level's build status by reusing {@link getHideoutGoalPath}
 * rather than a second traversal: an empty path means already built; a
 * path containing only the target step itself (no prerequisites) means
 * immediately buildable; anything longer means real unbuilt blockers.
 * The non-goal steps in that same path ARE the "what's blocking this"
 * list (a caller wanting that text calls `getHideoutGoalPath(...).filter(
 * (step) => !step.isGoal)` directly) - ported from legacy's
 * `hideoutLevelStatus`/`hideoutLevelBlockers` (`tarkovData.js`) as one
 * function instead of two, since both derive from the same path.
 */
export function getHideoutLevelStatus(
  stations: readonly RawHideoutStation[],
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  stationNormalizedName: string,
  level: number,
): HideoutLevelStatus {
  const path = getHideoutGoalPath(stations, hideoutBuilt, stationNormalizedName, level);
  if (path.length === 0) return "done";
  if (path.length === 1) return "started";
  return "locked";
}

function dedupeSteps(steps: readonly HideoutGoalStep[]): HideoutGoalStep[] {
  const seen = new Set<string>();
  const deduped: HideoutGoalStep[] = [];
  for (const step of steps) {
    const key = `${step.stationNormalizedName}:${String(step.level)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(step);
  }
  return deduped;
}
