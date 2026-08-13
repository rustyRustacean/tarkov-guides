import type { TaskStatus } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** One task objective's real in-raid position on a specific map. */
export interface TaskMarker {
  taskId: string;
  taskName: string;
  /** Task banner image, shown in the marker hover tooltip; `null` when the task has none. */
  taskImageLink: string | null;
  objectiveId: string;
  objectiveDescription: string;
  /** Unity world-space `x`/`z` (east/north). `y` (vertical) is intentionally dropped, matching legacy's own "we ignore vertical y" comment (`taskMarkers.js`). */
  x: number;
  z: number;
  /** `true` when this marker is on the map only because of a manual "show on map" override, not because the task is active; rendered with a distinct blue ring (see {@link isForcedTaskDisplay}). */
  forced: boolean;
}

/**
 * Whether a task's marker should show on the map, ported from legacy's
 * `shouldDisplayTaskOnMap` (`mapSidebar.js`): defaults to only `inprog`
 * tasks, but a per-task manual override always wins. Purely cosmetic;
 * never affects task status itself.
 */
export function shouldDisplayTaskOnMap(status: TaskStatus, override: boolean | undefined): boolean {
  if (override !== undefined) return override;
  return status === "inprog";
}

/**
 * Whether a task is on the map *only* because it was manually toggled "show
 * on map" while not active: a task you're watching (maybe for someone
 * else), distinct from your own in-progress work. `inprog` tasks are never
 * "forced" (they'd show anyway), so an override on an active task doesn't
 * mark it. Drives both the list highlight and the marker's blue ring.
 */
export function isForcedTaskDisplay(status: TaskStatus, override: boolean | undefined): boolean {
  return override === true && status !== "inprog";
}

/**
 * Every real, on-map marker for a given map: one per (task, objective,
 * zone) with a real position, gated by {@link shouldDisplayTaskOnMap}.
 * Positions come straight from tarkov.dev's `objectives[].zones[].position`
 * (added to the live query specifically for this feature; see
 * `src/shared/lib/tarkov-api/constants.ts`), not a heuristic.
 */
export function getTaskMarkersForMap(
  tasks: readonly NormalizedTask[],
  normalizedMapName: string,
  taskStatus: Readonly<Record<string, TaskStatus | undefined>>,
  taskDisplayOverrides: Readonly<Record<string, boolean>>,
): readonly TaskMarker[] {
  const markers: TaskMarker[] = [];

  for (const task of tasks) {
    const status = taskStatus[task.id] ?? "notstarted";
    const override = taskDisplayOverrides[task.id];
    if (!shouldDisplayTaskOnMap(status, override)) continue;
    const forced = isForcedTaskDisplay(status, override);

    for (const objective of task.objectives) {
      for (const zone of objective.zones ?? []) {
        if (zone.map?.normalizedName !== normalizedMapName) continue;
        if (!zone.position) continue;

        markers.push({
          taskId: task.id,
          taskName: task.name,
          taskImageLink: task.taskImageLink,
          objectiveId: objective.id,
          objectiveDescription: objective.description,
          x: zone.position.x,
          z: zone.position.z,
          forced,
        });
      }
    }
  }

  return markers;
}
