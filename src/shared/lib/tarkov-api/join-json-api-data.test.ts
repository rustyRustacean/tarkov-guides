import { describe, expect, it } from "vitest";

import { joinJsonApiData, type JsonApiFetchedResources } from "./join-json-api-data";

import type { JsonApiItem, JsonApiTask, JsonApiTrader } from "./json-api-types";

function makeItem(overrides: Partial<JsonApiItem> = {}): JsonApiItem {
  return {
    id: "item-1",
    name: "LEDX Skin Transilluminator",
    shortName: "LEDX",
    iconLink: "https://example.com/ledx.png",
    wikiLink: "https://example.com/wiki/ledx",
    basePrice: 100_000,
    width: 1,
    height: 1,
    avg24hPrice: 350_000,
    lastLowPrice: 340_000,
    changeLast48hPercent: 1.2,
    types: ["barter"],
    buyFromTrader: [],
    sellToTrader: [],
    ...overrides,
  };
}

function makeTrader(overrides: Partial<JsonApiTrader> = {}): JsonApiTrader {
  return {
    id: "trader-1",
    name: "Prapor",
    normalizedName: "prapor",
    imageLink: "https://example.com/prapor.png",
    ...overrides,
  };
}

function makeTask(overrides: Partial<JsonApiTask> = {}): JsonApiTask {
  return {
    id: "task-1",
    name: "First in Line",
    kappaRequired: false,
    minPlayerLevel: 1,
    experience: 100,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: null,
    availableDelaySecondsMax: null,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestige: null,
    trader: "trader-1",
    map: null,
    taskRequirements: [],
    traderRequirements: [],
    objectives: [],
    failConditions: [],
    startRewards: null,
    finishRewards: null,
    failureOutcome: null,
    ...overrides,
  };
}

function makeResources(overrides: Partial<JsonApiFetchedResources> = {}): JsonApiFetchedResources {
  return {
    items: { items: {} },
    itemsPve: { items: {} },
    tasks: { tasks: {}, prestige: [] },
    traders: {},
    hideout: {},
    maps: { maps: {} },
    barters: [],
    crafts: [],
    ...overrides,
  };
}

describe("joinJsonApiData", () => {
  it("resolves item trader offers into embedded vendor refs", () => {
    const resources = makeResources({
      items: {
        items: {
          "item-1": makeItem({
            sellToTrader: [{ trader: "trader-1", priceRUB: 9198 }],
            buyFromTrader: [
              {
                trader: "trader-1",
                priceRUB: 18397,
                currency: "RUB",
                minTraderLevel: 3,
                taskUnlock: "task-1",
                buyLimit: 5,
              },
            ],
          }),
        },
      },
      traders: { "trader-1": makeTrader() },
      tasks: { tasks: { "task-1": makeTask() }, prestige: [] },
    });

    const result = joinJsonApiData(resources);

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "item-1",
        sellFor: [{ priceRUB: 9198, vendor: { name: "Prapor", normalizedName: "prapor" } }],
        buyFor: [
          {
            priceRUB: 18397,
            currency: "RUB",
            vendor: {
              name: "Prapor",
              normalizedName: "prapor",
              minTraderLevel: 3,
              taskUnlock: { id: "task-1", name: "First in Line" },
              buyLimit: 5,
            },
          },
        ],
      }),
    ]);
  });

  it("doesn't crash when array fields the API sometimes omits are missing entirely", () => {
    // Regression test for a real bug found against the live API: a real
    // item can come back with no `sellToTrader`/`buyFromTrader` key at all
    // (not even an empty array), despite every sampled item at
    // implementation time having always included them - this API is
    // explicitly "still a work in progress" per tarkov.dev's own staff.
    const sparseItem: JsonApiItem = {
      id: "item-1",
      name: "LEDX Skin Transilluminator",
      shortName: "LEDX",
      iconLink: null,
      wikiLink: null,
      basePrice: 100_000,
      width: 1,
      height: 1,
      avg24hPrice: null,
      lastLowPrice: null,
      changeLast48hPercent: null,
      // `sellToTrader`/`buyFromTrader`/`types` deliberately omitted.
    };
    const sparseTask: JsonApiTask = {
      id: "task-1",
      name: "First in Line",
      kappaRequired: false,
      minPlayerLevel: 1,
      experience: 100,
      wikiLink: null,
      factionName: null,
      taskImageLink: null,
      availableDelaySecondsMin: null,
      availableDelaySecondsMax: null,
      restartable: false,
      lightkeeperRequired: false,
      requiredPrestige: null,
      trader: "trader-1",
      map: null,
      startRewards: null,
      finishRewards: null,
      failureOutcome: null,
      // `objectives`/`taskRequirements`/`traderRequirements`/`failConditions` deliberately omitted.
    };
    const resources = makeResources({
      items: { items: { "item-1": sparseItem } },
      tasks: { tasks: { "task-1": sparseTask } },
      maps: {
        maps: {
          "map-1": {
            name: "Factory",
            normalizedName: "factory",
            raidDuration: null,
            players: null,
          },
        },
      },
      hideout: {
        "station-a": { id: "station-a", name: "Medstation", normalizedName: "medstation" },
      },
    });

    expect(() => joinJsonApiData(resources)).not.toThrow();
    const result = joinJsonApiData(resources);
    expect(result.items[0]?.sellFor).toEqual([]);
    expect(result.tasks[0]?.objectives).toEqual([]);
    expect(result.maps[0]?.bosses).toEqual([]);
    expect(result.hideoutStations[0]?.levels).toEqual([]);
  });

  it("resolves each boss's mob code to a name + portrait via the mobs lookup", () => {
    const resources = makeResources({
      maps: {
        maps: {
          "map-1": {
            name: "Reserve",
            normalizedName: "reserve",
            raidDuration: null,
            players: null,
            bosses: [
              { mob: "bossGluhar", spawnChance: 1 },
              { mob: "unknownMob", spawnChance: 0.2 },
            ],
          },
        },
        mobs: {
          bossGluhar: {
            id: "bossGluhar",
            name: "Glukhar",
            normalizedName: "glukhar",
            imagePortraitLink: "https://assets.tarkov.dev/glukhar-portrait.png",
          },
        },
      },
    });

    const bosses = joinJsonApiData(resources).maps[0]?.bosses;
    expect(bosses?.[0]).toEqual({
      name: "Glukhar",
      normalizedName: "glukhar",
      imagePortraitLink: "https://assets.tarkov.dev/glukhar-portrait.png",
      spawnChance: 1,
    });
    // A mob missing from the lookup falls back to its raw code, never "undefined".
    expect(bosses?.[1]).toEqual({
      name: "unknownMob",
      normalizedName: "unknownMob",
      imagePortraitLink: null,
      spawnChance: 0.2,
    });
  });

  it("falls back to the bare id when a cross-reference doesn't resolve", () => {
    const resources = makeResources({
      items: {
        items: {
          "item-1": makeItem({
            sellToTrader: [{ trader: "missing-trader", priceRUB: 100 }],
          }),
        },
      },
    });

    const result = joinJsonApiData(resources);

    expect(result.items[0]?.sellFor).toEqual([
      { priceRUB: 100, vendor: { name: "missing-trader", normalizedName: "missing-trader" } },
    ]);
  });

  it("resolves hideout item requirements and cross-station level requirements", () => {
    const resources = makeResources({
      items: { items: { "item-1": makeItem() } },
      hideout: {
        "station-a": {
          id: "station-a",
          name: "Medstation",
          normalizedName: "medstation",
          levels: [
            {
              level: 1,
              itemRequirements: [{ item: "item-1", count: 2 }],
              stationLevelRequirements: [{ station: "station-b", level: 1 }],
            },
          ],
        },
        "station-b": {
          id: "station-b",
          name: "Generator",
          normalizedName: "generator",
          levels: [],
        },
      },
    });

    const result = joinJsonApiData(resources);

    expect(result.hideoutStations[0]?.levels[0]).toEqual({
      level: 1,
      itemRequirements: [
        {
          item: {
            id: "item-1",
            name: "LEDX Skin Transilluminator",
            shortName: "LEDX",
            iconLink: "https://example.com/ledx.png",
          },
          count: 2,
        },
      ],
      stationLevelRequirements: [{ station: { normalizedName: "generator" }, level: 1 }],
    });
  });

  it("wraps a barter's singular offeredItem into a rewardItems array", () => {
    const resources = makeResources({
      items: {
        items: { "item-1": makeItem(), "item-2": makeItem({ id: "item-2", name: "Bolts" }) },
      },
      traders: { "trader-1": makeTrader() },
      barters: [
        {
          id: "barter-1",
          level: 2,
          trader: "trader-1",
          requiredItems: [{ item: "item-1", count: 3 }],
          offeredItem: { item: "item-2", count: 1 },
        },
      ],
    });

    const result = joinJsonApiData(resources);

    expect(result.barters[0]).toEqual({
      id: "barter-1",
      level: 2,
      trader: { name: "Prapor", normalizedName: "prapor" },
      requiredItems: [
        {
          item: {
            id: "item-1",
            name: "LEDX Skin Transilluminator",
            shortName: "LEDX",
            iconLink: "https://example.com/ledx.png",
          },
          count: 3,
        },
      ],
      rewardItems: [
        {
          item: {
            id: "item-2",
            name: "Bolts",
            shortName: "LEDX",
            iconLink: "https://example.com/ledx.png",
          },
          count: 1,
        },
      ],
    });
  });

  it("resolves a craft's station via the hideout station index", () => {
    const resources = makeResources({
      items: { items: { "item-1": makeItem() } },
      hideout: {
        "station-a": {
          id: "station-a",
          name: "Workbench",
          normalizedName: "workbench",
          levels: [],
        },
      },
      crafts: [
        {
          id: "craft-1",
          level: 1,
          duration: 3600,
          station: "station-a",
          requiredItems: [{ item: "item-1", count: 1 }],
          productItem: { item: "item-1", count: 2 },
        },
      ],
    });

    const result = joinJsonApiData(resources);

    expect(result.crafts[0]?.station).toEqual({ name: "Workbench", normalizedName: "workbench" });
    expect(result.crafts[0]?.rewardItems).toEqual([
      {
        item: {
          id: "item-1",
          name: "LEDX Skin Transilluminator",
          shortName: "LEDX",
          iconLink: "https://example.com/ledx.png",
        },
        count: 2,
      },
    ]);
  });

  describe("tasks", () => {
    it("resolves trader/map refs, taskRequirements, and traderRequirements", () => {
      const resources = makeResources({
        traders: { "trader-1": makeTrader() },
        maps: {
          maps: {
            "map-1": {
              name: "Customs",
              normalizedName: "customs",
              raidDuration: 40,
              players: "5-8",
              bosses: [],
            },
          },
        },
        tasks: {
          tasks: {
            "task-1": makeTask(),
            "task-2": makeTask({
              id: "task-2",
              map: "map-1",
              taskRequirements: [{ task: "task-1", status: ["complete"] }],
              traderRequirements: [
                {
                  id: "req-1",
                  trader: "trader-1",
                  requirementType: "level",
                  compareMethod: ">=",
                  value: 2,
                },
              ],
            }),
          },
          prestige: [],
        },
      });

      const result = joinJsonApiData(resources);
      const task2 = result.tasks.find((t) => t.id === "task-2");

      expect(task2?.trader).toEqual({
        id: "trader-1",
        name: "Prapor",
        imageLink: "https://example.com/prapor.png",
      });
      expect(task2?.map).toEqual({ name: "Customs", normalizedName: "customs" });
      expect(task2?.taskRequirements).toEqual([{ task: { id: "task-1" }, status: ["complete"] }]);
      expect(task2?.traderRequirements).toEqual([
        {
          id: "req-1",
          trader: { id: "trader-1", name: "Prapor" },
          requirementType: "level",
          compareMethod: ">=",
          value: 2,
        },
      ]);
    });

    it("resolves requiredPrestige via the payload's prestige tier list", () => {
      const resources = makeResources({
        tasks: {
          tasks: { "task-1": makeTask({ requiredPrestige: "prestige-1" }) },
          prestige: [{ id: "prestige-1", prestigeLevel: 2 }],
        },
      });

      const result = joinJsonApiData(resources);

      expect(result.tasks[0]?.requiredPrestige).toEqual({ prestigeLevel: 2 });
    });

    it("takes items[0] as the representative item for findItem/giveItem/plantItem/sellItem objectives", () => {
      const resources = makeResources({
        items: { items: { "item-1": makeItem(), "item-2": makeItem({ id: "item-2" }) } },
        tasks: {
          tasks: {
            "task-1": makeTask({
              objectives: [
                {
                  id: "obj-1",
                  description: "Hand over any found in raid medicine items",
                  type: "giveItem",
                  optional: false,
                  count: 3,
                  foundInRaid: true,
                  items: ["item-1", "item-2"],
                  maps: [],
                },
              ],
            }),
          },
          prestige: [],
        },
      });

      const result = joinJsonApiData(resources);
      const objective = result.tasks[0]?.objectives[0];

      expect(objective?.item?.id).toBe("item-1");
      expect(objective?.count).toBe(3);
      expect(objective?.foundInRaid).toBe(true);
    });

    it("resolves a mark objective's markerItem", () => {
      const resources = makeResources({
        items: { items: { "marker-1": makeItem({ id: "marker-1", name: "MS2000 Marker" }) } },
        tasks: {
          tasks: {
            "task-1": makeTask({
              objectives: [
                {
                  id: "obj-1",
                  description: "Mark the fuel tank",
                  type: "mark",
                  optional: false,
                  markerItem: "marker-1",
                  maps: [],
                },
              ],
            }),
          },
          prestige: [],
        },
      });

      const result = joinJsonApiData(resources);

      expect(result.tasks[0]?.objectives[0]?.markerItem?.name).toBe("MS2000 Marker");
    });

    it("resolves zones[].map and synthesizes zones from findQuestItem's possibleLocations", () => {
      const resources = makeResources({
        maps: {
          maps: {
            "map-1": {
              name: "Customs",
              normalizedName: "customs",
              raidDuration: null,
              players: null,
              bosses: [],
            },
          },
        },
        tasks: {
          tasks: {
            "task-1": makeTask({
              objectives: [
                {
                  id: "obj-1",
                  description: "Locate the hard drive",
                  type: "findQuestItem",
                  optional: false,
                  questItem: "quest-item-1",
                  maps: ["map-1"],
                  possibleLocations: [
                    {
                      map: "map-1",
                      positions: [
                        { x: 1, y: 2, z: 3 },
                        { x: 4, y: 5, z: 6 },
                      ],
                    },
                  ],
                },
              ],
            }),
          },
          prestige: [],
        },
      });

      const result = joinJsonApiData(resources);
      const objective = result.tasks[0]?.objectives[0];

      expect(objective?.maps).toEqual([{ normalizedName: "customs" }]);
      expect(objective?.zones).toHaveLength(2);
      expect(objective?.zones?.[0]).toEqual({
        id: "obj-1-0-0",
        map: { normalizedName: "customs" },
        position: { x: 1, y: 2, z: 3 },
      });
      // findQuestItem never resolves a `.item` - matches the old GraphQL
      // port's behavior (no consumer ever reads a `questItem` field).
      expect(objective?.item).toBeUndefined();
    });

    it("resolves finishRewards' items/traderStanding/traderUnlock/offerUnlock/skillLevelReward", () => {
      const resources = makeResources({
        items: {
          items: { "item-1": makeItem({ basePrice: 5000 }), "item-2": makeItem({ id: "item-2" }) },
        },
        traders: { "trader-1": makeTrader() },
        tasks: {
          tasks: {
            "task-1": makeTask({
              finishRewards: {
                items: [{ item: "item-1", count: 1 }],
                traderStanding: [{ trader: "trader-1", standing: 0.04 }],
                traderUnlock: ["trader-1"],
                offerUnlock: [{ trader: "trader-1", item: "item-2", level: 2 }],
                skillLevelReward: [{ skill: "Charisma", level: 1 }],
              },
            }),
          },
          prestige: [],
        },
      });

      const result = joinJsonApiData(resources);
      const rewards = result.tasks[0]?.finishRewards;

      expect(rewards?.items).toEqual([
        {
          item: {
            id: "item-1",
            name: "LEDX Skin Transilluminator",
            shortName: "LEDX",
            iconLink: "https://example.com/ledx.png",
            basePrice: 5000,
          },
          count: 1,
        },
      ]);
      expect(rewards?.traderStanding).toEqual([{ trader: { name: "Prapor" }, standing: 0.04 }]);
      expect(rewards?.traderUnlock).toEqual([{ name: "Prapor" }]);
      expect(rewards?.offerUnlock).toEqual([
        {
          trader: { name: "Prapor" },
          level: 2,
          item: {
            id: "item-2",
            name: "LEDX Skin Transilluminator",
            shortName: "LEDX",
            iconLink: "https://example.com/ledx.png",
          },
        },
      ]);
      expect(rewards?.skillLevelReward).toEqual([{ name: "Charisma", level: 1 }]);
    });
  });
});
