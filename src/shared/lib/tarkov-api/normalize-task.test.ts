import { describe, expect, it, vi } from "vitest";

import { deriveTaskItemRequirements, normalizeTask } from "./normalize-task";

import type { RawItemRef, RawTask, RawTaskObjective, RawTraderRequirement } from "./types";

const cigarettes: RawItemRef = {
  id: "item-cigs",
  name: "Malboro cigarettes",
  shortName: "Cigs",
  iconLink: null,
};
const marker: RawItemRef = {
  id: "item-marker",
  name: "MS2000 Marker",
  shortName: "Marker",
  iconLink: null,
};
const camera: RawItemRef = {
  id: "item-cam",
  name: "WI-FI Camera",
  shortName: "Cam",
  iconLink: null,
};

function makeObjective(overrides: Partial<RawTaskObjective> = {}): RawTaskObjective {
  return {
    id: "obj-1",
    type: "findItem",
    description: "Find 5 Malboro cigarettes in raid",
    optional: false,
    maps: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Bad Habit",
    kappaRequired: true,
    hasHiddenRequirement: false,
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

function makeTraderRequirement(
  overrides: Partial<RawTraderRequirement> = {},
): RawTraderRequirement {
  return {
    id: "req-1",
    trader: { id: "trader-prapor", name: "Prapor" },
    requirementType: "level",
    compareMethod: ">=",
    value: 2,
    ...overrides,
  };
}

describe("deriveTaskItemRequirements", () => {
  it("dedupes the same item across objectives, taking the max count and ORing foundInRaid", () => {
    const task = makeTask({
      objectives: [
        makeObjective({
          id: "obj-1",
          description: "Find 5 Malboro cigarettes in raid",
          item: cigarettes,
          count: 5,
          foundInRaid: true,
        }),
        makeObjective({
          id: "obj-2",
          description: "Hand over 5 Malboro cigarettes",
          item: cigarettes,
          count: 5,
          foundInRaid: false,
        }),
      ],
    });
    const requirements = deriveTaskItemRequirements(task);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toEqual({
      id: "item-cigs",
      name: "Malboro cigarettes",
      shortName: "Cigs",
      iconLink: null,
      count: 5,
      foundInRaid: true,
    });
  });

  it("takes the higher count when counts differ across objectives for the same item", () => {
    const task = makeTask({
      objectives: [
        makeObjective({ id: "obj-1", item: cigarettes, count: 2 }),
        makeObjective({ id: "obj-2", item: cigarettes, count: 5 }),
      ],
    });
    expect(deriveTaskItemRequirements(task)[0]?.count).toBe(5);
  });

  it("skips MARK objectives entirely", () => {
    const task = makeTask({
      objectives: [makeObjective({ description: "Mark the location", markerItem: marker })],
    });
    expect(deriveTaskItemRequirements(task)).toEqual([]);
  });

  it("skips plantItem/buildWeapon objectives - not a hoard-and-hand-over item, even when .item is set", () => {
    const task = makeTask({
      objectives: [
        makeObjective({
          type: "plantItem",
          description: "Plant the device",
          item: camera,
          count: 1,
        }),
        makeObjective({
          type: "buildWeapon",
          description: "Modify the weapon",
          item: camera,
          count: 1,
        }),
      ],
    });
    expect(deriveTaskItemRequirements(task)).toEqual([]);
  });

  it("excludes isQuestTool items even when the objective type/description doesn't flag them", () => {
    const task = makeTask({
      objectives: [makeObjective({ description: "Find the marker", item: marker, count: 1 })],
    });
    expect(deriveTaskItemRequirements(task)).toEqual([]);
  });

  it("passes through ordinary find/hand-over objectives", () => {
    const task = makeTask({
      objectives: [
        makeObjective({
          description: "Find 5 Malboro cigarettes in raid",
          item: cigarettes,
          count: 5,
          foundInRaid: true,
        }),
      ],
    });
    expect(deriveTaskItemRequirements(task)).toEqual([
      {
        id: "item-cigs",
        name: "Malboro cigarettes",
        shortName: "Cigs",
        iconLink: null,
        count: 5,
        foundInRaid: true,
      },
    ]);
  });

  it("defaults count to 1 and foundInRaid to false when the objective omits them", () => {
    const task = makeTask({
      objectives: [makeObjective({ description: "Hand over the item", item: cigarettes })],
    });
    expect(deriveTaskItemRequirements(task)[0]).toMatchObject({ count: 1, foundInRaid: false });
  });
});

describe("normalizeTask", () => {
  it("unions the task's own map with every objective's maps, deduped", () => {
    const task = makeTask({
      map: { name: "Customs", normalizedName: "customs" },
      objectives: [
        makeObjective({ maps: [{ normalizedName: "customs" }, { normalizedName: "woods" }] }),
        makeObjective({ maps: [{ normalizedName: "woods" }] }),
      ],
    });
    expect([...normalizeTask(task).maps].sort()).toEqual(["customs", "woods"]);
  });

  it("maps taskRequirements to {taskId, status}", () => {
    const task = makeTask({
      taskRequirements: [{ task: { id: "task-0" }, status: ["complete"] }],
    });
    expect(normalizeTask(task).taskRequirements).toEqual([
      { taskId: "task-0", status: ["complete"] },
    ]);
  });

  it("passes objectives and finishRewards through unchanged", () => {
    const objective = makeObjective();
    const task = makeTask({ objectives: [objective], finishRewards: null });
    const result = normalizeTask(task);
    expect(result.objectives).toEqual([objective]);
    expect(result.finishRewards).toBeNull();
  });

  it("a wiki-verified correction fully replaces minPlayerLevel and/or taskRequirements for that task only", async () => {
    vi.resetModules();
    vi.doMock("./task-corrections-overrides", () => ({
      TASK_CORRECTIONS_OVERRIDES: {
        "task-1": {
          minPlayerLevel: 20,
          taskRequirements: [{ taskId: "task-corrected", status: ["complete"] }],
        },
      },
    }));
    const { normalizeTask: normalizeTaskWithOverride } = await import("./normalize-task");

    const correctedTask = makeTask({
      id: "task-1",
      minPlayerLevel: 10,
      taskRequirements: [{ task: { id: "task-0" }, status: ["complete"] }],
    });
    const uncorrectedTask = makeTask({
      id: "task-2",
      minPlayerLevel: 10,
      taskRequirements: [{ task: { id: "task-0" }, status: ["complete"] }],
    });

    const correctedResult = normalizeTaskWithOverride(correctedTask);
    expect(correctedResult.minPlayerLevel).toBe(20);
    expect(correctedResult.taskRequirements).toEqual([
      { taskId: "task-corrected", status: ["complete"] },
    ]);

    const uncorrectedResult = normalizeTaskWithOverride(uncorrectedTask);
    expect(uncorrectedResult.minPlayerLevel).toBe(10);
    expect(uncorrectedResult.taskRequirements).toEqual([
      { taskId: "task-0", status: ["complete"] },
    ]);

    vi.doUnmock("./task-corrections-overrides");
    vi.resetModules();
  });

  it("normalizes a fully-populated traderRequirements entry", () => {
    const task = makeTask({
      traderRequirements: [
        makeTraderRequirement({
          trader: { id: "trader-prapor", name: "Prapor" },
          requirementType: "level",
          compareMethod: ">=",
          value: 2,
        }),
      ],
    });
    expect(normalizeTask(task).traderRequirements).toEqual([
      {
        traderId: "trader-prapor",
        traderName: "Prapor",
        requirementType: "level",
        compareMethod: ">=",
        value: 2,
      },
    ]);
  });

  it("drops a traderRequirements entry with a null requirementType, compareMethod, or value", () => {
    const task = makeTask({
      traderRequirements: [
        makeTraderRequirement({ requirementType: null }),
        makeTraderRequirement({ compareMethod: null }),
        makeTraderRequirement({ value: null }),
      ],
    });
    expect(normalizeTask(task).traderRequirements).toEqual([]);
  });

  it("normalizes multiple valid traderRequirements entries (e.g. a task gated by two different traders)", () => {
    const task = makeTask({
      traderRequirements: [
        makeTraderRequirement({
          trader: { id: "trader-peacekeeper", name: "Peacekeeper" },
          value: 4,
        }),
        makeTraderRequirement({ trader: { id: "trader-mechanic", name: "Mechanic" }, value: 3 }),
      ],
    });
    expect(normalizeTask(task).traderRequirements).toHaveLength(2);
  });
});
