import { describe, expect, it } from "vitest";

import { buildBarterCraftIndexes, buildItemIndexes, buildTasksByItemShortName } from "./indexes";

import type {
  NormalizedItem,
  NormalizedTask,
  RawBarter,
  RawCraft,
  TaskItemRequirement,
} from "./types";

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "item-1",
    name: "LEDX",
    shortName: "LEDX",
    iconLink: null,
    wikiLink: null,
    basePrice: 100_000,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    traderSell: 0,
    traderSellVendor: "",
    traderBuy: 0,
    traderBuyVendor: "",
    buyOffers: [],
    avg24hPve: null,
    lastLowPve: null,
    changePve: null,
    ...overrides,
  };
}

describe("buildItemIndexes", () => {
  it("indexes by id and lowercased shortName", () => {
    const item = makeItem({ id: "item-1", shortName: "LEDX" });
    const { byId, byShortName } = buildItemIndexes([item]);
    expect(byId["item-1"]).toBe(item);
    expect(byShortName.ledx).toBe(item);
  });

  it("keeps the first item on a shortName collision", () => {
    const first = makeItem({ id: "item-1", shortName: "Dup" });
    const second = makeItem({ id: "item-2", shortName: "Dup" });
    const { byShortName } = buildItemIndexes([first, second]);
    expect(byShortName.dup).toBe(first);
  });
});

function makeItemRef(id: string) {
  return { id, name: id, shortName: id, iconLink: null };
}

describe("buildBarterCraftIndexes", () => {
  it("indexes barters and crafts by required/reward item id", () => {
    const barter: RawBarter = {
      id: "barter-1",
      level: 1,
      trader: { name: "Prapor", normalizedName: "prapor" },
      requiredItems: [{ item: makeItemRef("input-item"), count: 1 }],
      rewardItems: [{ item: makeItemRef("reward-item"), count: 1 }],
    };
    const craft: RawCraft = {
      id: "craft-1",
      level: 1,
      duration: 100,
      station: { name: "Workbench", normalizedName: "workbench" },
      requiredItems: [{ item: makeItemRef("craft-input"), count: 1 }],
      rewardItems: [{ item: makeItemRef("craft-reward"), count: 1 }],
    };

    const { barterInputs, barterRewards, craftInputs, craftRewards } = buildBarterCraftIndexes(
      [barter],
      [craft],
    );

    expect(barterInputs["input-item"]).toEqual([barter]);
    expect(barterRewards["reward-item"]).toEqual([barter]);
    expect(craftInputs["craft-input"]).toEqual([craft]);
    expect(craftRewards["craft-reward"]).toEqual([craft]);
  });

  it("accumulates multiple barters/crafts referencing the same item", () => {
    const barterA: RawBarter = {
      id: "a",
      level: 1,
      trader: { name: "Prapor", normalizedName: "prapor" },
      requiredItems: [{ item: makeItemRef("shared-item"), count: 1 }],
      rewardItems: [],
    };
    const barterB: RawBarter = {
      id: "b",
      level: 1,
      trader: { name: "Skier", normalizedName: "skier" },
      requiredItems: [{ item: makeItemRef("shared-item"), count: 2 }],
      rewardItems: [],
    };
    const { barterInputs } = buildBarterCraftIndexes([barterA, barterB], []);
    expect(barterInputs["shared-item"]).toEqual([barterA, barterB]);
  });
});

function makeTask(
  overrides: Partial<NormalizedTask> & { itemRequirements: readonly TaskItemRequirement[] },
): NormalizedTask {
  return {
    id: "task-1",
    name: "Task",
    kappaRequired: false,
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
    ...overrides,
  };
}

describe("buildTasksByItemShortName", () => {
  it("buckets tasks by each required item's shortName", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "i1", name: "Cigs", shortName: "Cigs", iconLink: null, count: 5, foundInRaid: true },
      ],
    });
    const index = buildTasksByItemShortName([task]);
    expect(index.Cigs).toEqual([task]);
  });

  it("dedupes within a single task when two requirements share a shortName", () => {
    const task = makeTask({
      itemRequirements: [
        {
          id: "i1",
          name: "Cigs A",
          shortName: "Cigs",
          iconLink: null,
          count: 1,
          foundInRaid: false,
        },
        {
          id: "i2",
          name: "Cigs B",
          shortName: "Cigs",
          iconLink: null,
          count: 1,
          foundInRaid: false,
        },
      ],
    });
    const index = buildTasksByItemShortName([task]);
    expect(index.Cigs).toEqual([task]);
  });

  it("accumulates multiple tasks under the same shortName", () => {
    const taskA = makeTask({
      id: "task-a",
      itemRequirements: [
        { id: "i1", name: "Cigs", shortName: "Cigs", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const taskB = makeTask({
      id: "task-b",
      itemRequirements: [
        { id: "i1", name: "Cigs", shortName: "Cigs", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const index = buildTasksByItemShortName([taskA, taskB]);
    expect(index.Cigs).toEqual([taskA, taskB]);
  });
});
