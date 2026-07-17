import { getRemaining } from "../lib/item-tracking";

import type { ProfileProgress } from "../types";
import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

export type TrackedItemSource = "task" | "custom" | "pinned";

export interface TrackedItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  need: number;
  have: number;
  pending: number;
  remaining: number;
  foundInRaid: boolean;
  pinned: boolean;
  source: TrackedItemSource;
  /**
   * True whenever the custom-items pass touched this row (new or merged
   * into an existing task/pinned row via the same real item id) - tracked
   * separately from `source`, since `source` is first-write-wins (tasks are
   * processed first) and would otherwise hide that a "Remove custom item"
   * action still applies to a row whose primary `source` reads `"task"`.
   */
  isCustom: boolean;
}

/**
 * Merges every item worth showing on the tracker into one list keyed by
 * real item id (custom items use their own synthetic id - see
 * {@link CustomItemEntry} - which is still a fine key here since `have`/
 * `pending` are plain string-keyed records, not restricted to catalog ids):
 *
 * - Every `itemRequirements` entry of a currently in-progress (`inprog`)
 *   task - matches the item-row semantics ported from
 *   `old/TarkovTrackerWB-main/src/components/items/itemRows.js`. If the
 *   same item is required by more than one active task, `need` takes the
 *   max (never summed) and `foundInRaid` is ORed, matching the same
 *   dedup rule already used for a single task's own requirements
 *   (`deriveTaskItemRequirements`).
 * - Every custom item the player added.
 * - Every pinned item not already covered by the above, resolved against
 *   the live item catalog.
 */
export function getTrackedItems(
  tasks: readonly NormalizedTask[],
  items: readonly NormalizedItem[],
  progress: ProfileProgress,
): readonly TrackedItem[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const rows = new Map<string, TrackedItem>();
  const pinnedItemIds = new Set(progress.pinnedItemIds);

  function upsert(
    id: string,
    name: string,
    shortName: string,
    iconLink: string | null,
    need: number,
    foundInRaid: boolean,
    source: TrackedItemSource,
    isCustom: boolean,
  ): void {
    const have = progress.have[id] ?? 0;
    const pending = progress.pending[id] ?? 0;
    const existing = rows.get(id);
    if (existing) {
      existing.need = Math.max(existing.need, need);
      existing.foundInRaid = existing.foundInRaid || foundInRaid;
      existing.remaining = getRemaining(existing.need, have);
      existing.isCustom = existing.isCustom || isCustom;
      return;
    }
    rows.set(id, {
      id,
      name,
      shortName,
      iconLink,
      need,
      have,
      pending,
      remaining: getRemaining(need, have),
      foundInRaid,
      pinned: pinnedItemIds.has(id),
      source,
      isCustom,
    });
  }

  for (const task of tasks) {
    const status = progress.taskStatus[task.id]?.status ?? "notstarted";
    if (status !== "inprog") continue;
    for (const item of task.itemRequirements) {
      upsert(
        item.id,
        item.name,
        item.shortName,
        item.iconLink,
        item.count,
        item.foundInRaid,
        "task",
        false,
      );
    }
  }

  for (const customItem of progress.customItems) {
    upsert(
      customItem.id,
      customItem.name,
      customItem.name,
      customItem.iconLink,
      customItem.need,
      false,
      "custom",
      true,
    );
  }

  for (const pinnedId of progress.pinnedItemIds) {
    if (rows.has(pinnedId)) continue;
    const item = itemsById.get(pinnedId);
    if (!item) continue;
    upsert(item.id, item.name, item.shortName, item.iconLink, 1, false, "pinned", false);
  }

  return Array.from(rows.values());
}
