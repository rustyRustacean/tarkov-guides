import { getTrackedItems } from "@/features/progress-tracker/selectors/item-progress";

import { taskRelevantToMap } from "./map-sidebar-tasks";

import type { TrackedItem } from "@/features/progress-tracker/selectors/item-progress";
import type { ProfileProgress } from "@/features/progress-tracker/types";
import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

/**
 * The sidebar's Items pane contents for one map, ported from
 * `mapSidebar.js`'s `renderMapItems`, reusing the shared
 * {@link getTrackedItems} selector rather than a parallel aggregator. Tasks
 * are pre-filtered to `inprog` + relevant to this map before being handed
 * to the selector, so item need/have/remaining math stays identical to
 * Progress Tracker's own Items tab. `getTrackedItems` always includes
 * custom items regardless of which tasks are passed in (matching legacy's
 * "custom items show on every map"), but also falls back to including
 * every pinned item app-wide even when unrelated to this map; those
 * fallback rows (`source === "pinned"`) are filtered back out here so
 * pinning an item on one map doesn't make it show on every other map too.
 */
export function getMapTrackedItems(
  tasks: readonly NormalizedTask[],
  items: readonly NormalizedItem[],
  progress: ProfileProgress,
  normalizedName: string,
): readonly TrackedItem[] {
  const relevantTasks = tasks.filter(
    (task) =>
      (progress.taskStatus[task.id]?.status ?? "notstarted") === "inprog" &&
      taskRelevantToMap(task, normalizedName),
  );
  return getTrackedItems(relevantTasks, items, progress).filter((row) => row.source !== "pinned");
}
