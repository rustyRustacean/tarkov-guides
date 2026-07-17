import { omitKey } from "@/shared/lib/record-utils";

import { hideoutBuiltKey } from "../types";

import type { HideoutBuiltKey } from "../types";
import type { NormalizedTask, RawHideoutStation } from "@/shared/lib/tarkov-api/types";

/**
 * Finds the single task literally named "Collector" (case-insensitive) -
 * NOT an aggregate of every `kappaRequired` task. Confirmed exact legacy
 * scoping via `old/TarkovTrackerWB-main/src/components/kappa/kappa.js`,
 * whose own comment explains this was fixed after aggregating every kappa
 * task's items caused 3-4x overcounting.
 */
export function getCollectorTask(tasks: readonly NormalizedTask[]): NormalizedTask | undefined {
  return tasks.find((task) => /^collector$/i.test(task.name.trim()));
}

export interface KappaItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  need: number;
  got: boolean;
}

/** The Kappa item checklist - every item the Collector task requires, with `got` state from the profile's `kappaGot`. Empty if the Collector task isn't present in the live dataset. */
export function getKappaItems(
  tasks: readonly NormalizedTask[],
  kappaGot: Readonly<Record<string, true>>,
): readonly KappaItem[] {
  const collectorTask = getCollectorTask(tasks);
  if (!collectorTask) return [];
  return collectorTask.itemRequirements.map((item) => ({
    id: item.id,
    name: item.name,
    shortName: item.shortName,
    iconLink: item.iconLink,
    need: item.count,
    got: kappaGot[item.id] === true,
  }));
}

/** Flips one item's Kappa "got" state. */
export function toggleKappaGotPatch(
  kappaGot: Readonly<Record<string, true>>,
  itemId: string,
): Readonly<Record<string, true>> {
  if (kappaGot[itemId] === true) {
    return omitKey(kappaGot, itemId);
  }
  return { ...kappaGot, [itemId]: true };
}

/**
 * Every item still needed across every not-yet-built hideout level,
 * aggregated across the whole hideout (not scoped to a `hideoutGoal`) -
 * summed when an item repeats across multiple levels. Shares `kappaGot`'s
 * keyspace with {@link getKappaItems} (see `types.ts`'s `kappaGot` doc
 * comment): the same physical stash item can satisfy both a hideout
 * upgrade and the Collector task, so checking it off in either tab marks
 * it everywhere.
 */
export function getHideoutKappaItems(
  stations: readonly RawHideoutStation[],
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>,
  kappaGot: Readonly<Record<string, true>>,
): readonly KappaItem[] {
  const needByItem = new Map<
    string,
    { name: string; shortName: string; iconLink: string | null; need: number }
  >();

  for (const station of stations) {
    for (const level of station.levels) {
      if (hideoutBuilt[hideoutBuiltKey(station.normalizedName, level.level)] === true) continue;
      for (const requirement of level.itemRequirements) {
        const existing = needByItem.get(requirement.item.id);
        if (existing) {
          existing.need += requirement.count;
        } else {
          needByItem.set(requirement.item.id, {
            name: requirement.item.name,
            shortName: requirement.item.shortName,
            iconLink: requirement.item.iconLink,
            need: requirement.count,
          });
        }
      }
    }
  }

  return Array.from(needByItem, ([id, entry]) => ({
    id,
    name: entry.name,
    shortName: entry.shortName,
    iconLink: entry.iconLink,
    need: entry.need,
    got: kappaGot[id] === true,
  }));
}

/**
 * Un-got first (remaining work surfaces at the top), then by `need`
 * descending, then alphabetically - got items sink to the bottom, EXCEPT an
 * item in `justGotIds` (mid transition-hold), which sorts as if still
 * un-got so it doesn't visually jump away the instant it's clicked. Ported
 * from `kappa.js`'s `sortGot`/comparator (the real 1.5s hold duration -
 * despite that file's own comments saying "3 seconds" - see
 * `hooks/use-kappa-tracker.ts`).
 */
export function sortKappaItems(
  items: readonly KappaItem[],
  justGotIds: ReadonlySet<string>,
): readonly KappaItem[] {
  function isSunk(item: KappaItem): boolean {
    return item.got && !justGotIds.has(item.id);
  }
  return [...items].sort((a, b) => {
    const aSunk = isSunk(a);
    const bSunk = isSunk(b);
    if (aSunk !== bSunk) return aSunk ? 1 : -1;
    if (a.need !== b.need) return b.need - a.need;
    return a.name.localeCompare(b.name);
  });
}
