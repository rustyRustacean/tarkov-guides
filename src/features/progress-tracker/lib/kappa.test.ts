import { describe, expect, it } from "vitest";

import {
  getCollectorTask,
  getHideoutKappaItems,
  getKappaItems,
  sortKappaItems,
  toggleKappaGotPatch,
} from "./kappa";

import type { KappaItem } from "./kappa";
import type { NormalizedTask, RawHideoutStation } from "@/shared/lib/tarkov-api/types";

function makeStation(overrides: Partial<RawHideoutStation> = {}): RawHideoutStation {
  return {
    id: "station-1",
    name: "Station",
    normalizedName: "station",
    levels: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<KappaItem> = {}): KappaItem {
  return {
    id: "item-a",
    name: "A",
    shortName: "A",
    iconLink: null,
    need: 1,
    got: false,
    ...overrides,
  };
}

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: "task-1",
    name: "Task",
    kappaRequired: false,
    hasHiddenRequirement: false,
    minPlayerLevel: 1,
    experience: 0,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestigeLevel: null,
    trader: { id: "trader-1", name: "Trader", imageLink: null },
    maps: [],
    taskRequirements: [],
    traderRequirements: [],
    objectives: [],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    itemRequirements: [],
    ...overrides,
  };
}

describe("getCollectorTask", () => {
  it("finds the task named exactly 'Collector' (case-insensitive)", () => {
    const collector = makeTask({ id: "collector-id", name: "collector" });
    const other = makeTask({ id: "other", name: "Some Kappa Task", kappaRequired: true });
    expect(getCollectorTask([other, collector])?.id).toBe("collector-id");
  });

  it("does NOT match other kappaRequired tasks that merely aren't named Collector", () => {
    const other = makeTask({ id: "other", name: "Postman Pat - Part 1", kappaRequired: true });
    expect(getCollectorTask([other])).toBeUndefined();
  });

  it("returns undefined if no task is named Collector", () => {
    expect(getCollectorTask([makeTask({ name: "Something Else" })])).toBeUndefined();
  });
});

describe("getKappaItems", () => {
  it("returns [] when the Collector task isn't present", () => {
    expect(getKappaItems([makeTask({ name: "Something Else" })], {})).toEqual([]);
  });

  it("maps the Collector task's item requirements with got state from kappaGot", () => {
    const collector = makeTask({
      name: "Collector",
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 2, foundInRaid: true },
      ],
    });
    const items = getKappaItems([collector], { "item-a": true });
    expect(items).toEqual([
      { id: "item-a", name: "A", shortName: "A", iconLink: null, need: 2, got: true },
    ]);
  });

  it("does NOT aggregate items from other kappaRequired tasks", () => {
    const collector = makeTask({
      id: "collector",
      name: "Collector",
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const otherKappaTask = makeTask({
      id: "other",
      name: "Other Kappa Task",
      kappaRequired: true,
      itemRequirements: [
        { id: "item-b", name: "B", shortName: "B", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const items = getKappaItems([collector, otherKappaTask], {});
    expect(items.map((item) => item.id)).toEqual(["item-a"]);
  });
});

describe("toggleKappaGotPatch", () => {
  it("marks an ungot item as got", () => {
    expect(toggleKappaGotPatch({}, "item-a")).toEqual({ "item-a": true });
  });
  it("unmarks a got item", () => {
    expect(toggleKappaGotPatch({ "item-a": true }, "item-a")).toEqual({});
  });
});

describe("getHideoutKappaItems", () => {
  it("sums need across multiple unbuilt levels requiring the same item", () => {
    const station = makeStation({
      normalizedName: "workbench",
      levels: [
        {
          level: 1,
          itemRequirements: [
            { item: { id: "item-a", name: "A", shortName: "A", iconLink: null }, count: 2 },
          ],
          stationLevelRequirements: [],
        },
        {
          level: 2,
          itemRequirements: [
            { item: { id: "item-a", name: "A", shortName: "A", iconLink: null }, count: 3 },
          ],
          stationLevelRequirements: [],
        },
      ],
    });
    const items = getHideoutKappaItems([station], {}, {});
    expect(items).toEqual([
      { id: "item-a", name: "A", shortName: "A", iconLink: null, need: 5, got: false },
    ]);
  });

  it("skips items whose only requiring levels are already built", () => {
    const station = makeStation({
      normalizedName: "workbench",
      levels: [
        {
          level: 1,
          itemRequirements: [
            { item: { id: "item-a", name: "A", shortName: "A", iconLink: null }, count: 2 },
          ],
          stationLevelRequirements: [],
        },
      ],
    });
    const items = getHideoutKappaItems([station], { "workbench:1": true }, {});
    expect(items).toEqual([]);
  });

  it("reads got state from the shared kappaGot map", () => {
    const station = makeStation({
      normalizedName: "workbench",
      levels: [
        {
          level: 1,
          itemRequirements: [
            { item: { id: "item-a", name: "A", shortName: "A", iconLink: null }, count: 1 },
          ],
          stationLevelRequirements: [],
        },
      ],
    });
    const items = getHideoutKappaItems([station], {}, { "item-a": true });
    expect(items[0]?.got).toBe(true);
  });
});

describe("sortKappaItems", () => {
  it("sorts un-got items before got items", () => {
    const gotItem = makeItem({ id: "got", got: true });
    const ungotItem = makeItem({ id: "ungot", got: false });
    const sorted = sortKappaItems([gotItem, ungotItem], new Set());
    expect(sorted.map((item) => item.id)).toEqual(["ungot", "got"]);
  });

  it("keeps a justGotIds-listed item sorted as if still un-got", () => {
    const gotItem = makeItem({ id: "got", got: true });
    const transitioningItem = makeItem({ id: "transitioning", got: true });
    const sorted = sortKappaItems([gotItem, transitioningItem], new Set(["transitioning"]));
    expect(sorted.map((item) => item.id)).toEqual(["transitioning", "got"]);
  });

  it("tie-breaks by need descending, then name", () => {
    const low = makeItem({ id: "low", name: "Zebra", need: 1 });
    const high = makeItem({ id: "high", name: "Alpha", need: 5 });
    const sameNeedA = makeItem({ id: "same-a", name: "Alpha", need: 3 });
    const sameNeedB = makeItem({ id: "same-b", name: "Beta", need: 3 });
    const sorted = sortKappaItems([low, high, sameNeedB, sameNeedA], new Set());
    expect(sorted.map((item) => item.id)).toEqual(["high", "same-a", "same-b", "low"]);
  });
});
