import { isQuestTool } from "../flea-market/item-predicates";

import type { NormalizedTask, RawTask, TaskItemRequirement, TraderRequirement } from "./types";

/**
 * The only objective `type`s that represent a real "find/hoard this item,
 * then hand it over" requirement. Confirmed against the JSON API's real
 * objective taxonomy: `plantItem` (place a bought/found item at a spot) and
 * `mark` (place a trader-supplied marker device) are excluded on purpose,
 * same as `buildWeapon`/`findQuestItem`/etc., which `join-json-api-data.ts`
 * never resolves an `.item` for in the first place.
 */
const HOARD_AND_HAND_OVER_OBJECTIVE_TYPES = new Set(["findItem", "giveItem", "sellItem"]);

/**
 * Every distinct item this task requires the player to find/hand over,
 * deduped by item id. Ported from `tarkovData.js`'s `adaptTask`, then
 * revised for the JSON API migration:
 * - A task can reference the SAME item across multiple objectives (e.g.
 *   "find 5 in raid" + "hand over 5"). Deduping takes the MAX count (not
 *   the sum) and ORs the found-in-raid flag, so the two objectives don't
 *   double the requirement.
 * - Only `findItem`/`giveItem`/`sellItem` objectives count. This used to
 *   be guessed via a regex on the objective description's leading verb
 *   ("install"/"plant"/"place"), a heuristic inherited from the old
 *   GraphQL schema's coarser objective-type taxonomy. The JSON API's
 *   explicit per-objective `type` field makes this exact, so the regex is
 *   gone.
 * - `isQuestTool` is an explicit belt-and-suspenders exclusion for items
 *   (MS2000 markers, signal jammers, wifi cameras) that slip past the
 *   type filter above when tarkov.dev labels them as a plain 'find' item.
 */
export function deriveTaskItemRequirements(rawTask: RawTask): readonly TaskItemRequirement[] {
  const itemsById = new Map<string, TaskItemRequirement>();

  for (const objective of rawTask.objectives) {
    if (!HOARD_AND_HAND_OVER_OBJECTIVE_TYPES.has(objective.type)) continue;
    if (!objective.item) continue;
    if (isQuestTool(objective.item)) continue;

    const count = objective.count ?? 1;
    const foundInRaid = objective.foundInRaid ?? false;
    const existing = itemsById.get(objective.item.id);
    if (existing) {
      itemsById.set(objective.item.id, {
        ...existing,
        count: Math.max(existing.count, count),
        foundInRaid: existing.foundInRaid || foundInRaid,
      });
      continue;
    }
    itemsById.set(objective.item.id, {
      id: objective.item.id,
      name: objective.item.name,
      shortName: objective.item.shortName,
      iconLink: objective.item.iconLink,
      count,
      foundInRaid,
    });
  }

  return Array.from(itemsById.values());
}

/**
 * Drops any `traderRequirements` entry with a null `requirementType`,
 * `compareMethod`, or `value`. The wire schema marks all three nullable but
 * an entry missing any of them can't be evaluated by a comparator, so it's
 * excluded rather than defaulted (silently guessing a default `value`/
 * `compareMethod` would be worse than just not gating on that entry).
 */
function deriveTraderRequirements(rawTask: RawTask): readonly TraderRequirement[] {
  const requirements: TraderRequirement[] = [];
  for (const requirement of rawTask.traderRequirements) {
    if (
      requirement.requirementType === null ||
      requirement.compareMethod === null ||
      requirement.value === null
    ) {
      continue;
    }
    requirements.push({
      traderId: requirement.trader.id,
      traderName: requirement.trader.name,
      requirementType: requirement.requirementType,
      compareMethod: requirement.compareMethod,
      value: requirement.value,
    });
  }
  return requirements;
}

/** Deduped `normalizedName` set: the task's own map plus every objective's maps. */
function deriveTaskMaps(rawTask: RawTask): readonly string[] {
  const maps = new Set<string>();
  if (rawTask.map) maps.add(rawTask.map.normalizedName);
  for (const objective of rawTask.objectives) {
    for (const map of objective.maps) {
      maps.add(map.normalizedName);
    }
  }
  return Array.from(maps);
}

/** Normalizes one raw tarkov.dev task, deriving its deduped item requirements and map set. */
export function normalizeTask(rawTask: RawTask): NormalizedTask {
  return {
    id: rawTask.id,
    name: rawTask.name,
    kappaRequired: rawTask.kappaRequired,
    minPlayerLevel: rawTask.minPlayerLevel ?? 0,
    experience: rawTask.experience,
    wikiLink: rawTask.wikiLink,
    factionName: rawTask.factionName,
    taskImageLink: rawTask.taskImageLink,
    availableDelaySecondsMin: rawTask.availableDelaySecondsMin ?? 0,
    availableDelaySecondsMax: rawTask.availableDelaySecondsMax ?? 0,
    restartable: rawTask.restartable ?? false,
    lightkeeperRequired: rawTask.lightkeeperRequired ?? false,
    requiredPrestigeLevel: rawTask.requiredPrestige?.prestigeLevel ?? null,
    trader: rawTask.trader,
    maps: deriveTaskMaps(rawTask),
    taskRequirements: rawTask.taskRequirements.map((requirement) => ({
      taskId: requirement.task.id,
      status: requirement.status,
    })),
    traderRequirements: deriveTraderRequirements(rawTask),
    objectives: rawTask.objectives,
    failConditions: rawTask.failConditions,
    startRewards: rawTask.startRewards,
    finishRewards: rawTask.finishRewards,
    failureOutcome: rawTask.failureOutcome,
    itemRequirements: deriveTaskItemRequirements(rawTask),
  };
}
