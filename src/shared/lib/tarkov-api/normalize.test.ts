import { describe, expect, it } from "vitest";

import { normalizeTarkovApiResponse } from "./normalize";

import type { RawItem, RawTarkovApiResponseData, RawTask } from "./types";

function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-1",
    name: "LEDX",
    shortName: "LEDX",
    iconLink: null,
    wikiLink: null,
    basePrice: 100_000,
    avg24hPrice: 350_000,
    lastLowPrice: 340_000,
    changeLast48hPercent: 1,
    width: 1,
    height: 1,
    types: ["barter"],
    sellFor: [],
    buyFor: [],
    ...overrides,
  };
}

function makeRawTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Bad Habit",
    kappaRequired: true,
    minPlayerLevel: 10,
    experience: 5000,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestige: null,
    trader: { id: "trader-1", name: "Trader", imageLink: null },
    map: null,
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

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
    ...overrides,
  };
}

describe("normalizeTarkovApiResponse", () => {
  it("normalizes items and tasks while passing the other sections through unchanged", () => {
    const hideoutStations = [
      { id: "s1", name: "Workbench", normalizedName: "workbench", levels: [] },
    ];
    const traders = [{ id: "t1", name: "Prapor", normalizedName: "prapor", imageLink: null }];
    const barters = [
      {
        id: "b1",
        level: 1,
        trader: { name: "Prapor", normalizedName: "prapor" },
        requiredItems: [],
        rewardItems: [],
      },
    ];
    const crafts = [
      {
        id: "c1",
        level: 1,
        duration: 100,
        station: { name: "Workbench", normalizedName: "workbench" },
        requiredItems: [],
        rewardItems: [],
      },
    ];
    const maps = [
      { name: "Customs", normalizedName: "customs", raidDuration: 40, players: "5-12", bosses: [] },
    ];

    const raw = makeRawData({
      items: [makeRawItem()],
      itemsPve: [
        { id: "item-1", avg24hPrice: 400_000, lastLowPrice: 390_000, changeLast48hPercent: 2 },
      ],
      tasks: [makeRawTask()],
      hideoutStations,
      traders,
      barters,
      crafts,
      maps,
    });

    const result = normalizeTarkovApiResponse(raw);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.avg24hPve).toBe(400_000);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.id).toBe("task-1");
    // Pass-through sections are referentially the same arrays, not rebuilt.
    expect(result.hideoutStations).toBe(hideoutStations);
    expect(result.traders).toBe(traders);
    expect(result.barters).toBe(barters);
    expect(result.crafts).toBe(crafts);
    expect(result.maps).toBe(maps);
  });

  it("handles a fully empty response", () => {
    const result = normalizeTarkovApiResponse(makeRawData());
    expect(result).toEqual({
      tasks: [],
      hideoutStations: [],
      items: [],
      traders: [],
      barters: [],
      crafts: [],
      maps: [],
    });
  });
});
