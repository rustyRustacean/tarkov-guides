import { describe, expect, it } from "vitest";

import { getTaskMarkersForMap, isForcedTaskDisplay, shouldDisplayTaskOnMap } from "./task-markers";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: "task-1",
    name: "Test Task",
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

describe("shouldDisplayTaskOnMap", () => {
  it("defaults to showing only in-progress tasks", () => {
    expect(shouldDisplayTaskOnMap("inprog", undefined)).toBe(true);
    expect(shouldDisplayTaskOnMap("notstarted", undefined)).toBe(false);
    expect(shouldDisplayTaskOnMap("done", undefined)).toBe(false);
    expect(shouldDisplayTaskOnMap("failed", undefined)).toBe(false);
  });

  it("a manual override always wins over the default", () => {
    expect(shouldDisplayTaskOnMap("inprog", false)).toBe(false);
    expect(shouldDisplayTaskOnMap("notstarted", true)).toBe(true);
  });
});

describe("isForcedTaskDisplay", () => {
  it("is true only when a non-active task is force-shown via override", () => {
    expect(isForcedTaskDisplay("notstarted", true)).toBe(true);
    expect(isForcedTaskDisplay("failed", true)).toBe(true);
    expect(isForcedTaskDisplay("done", true)).toBe(true);
  });

  it("is false for an active task even with the override on (it'd show anyway)", () => {
    expect(isForcedTaskDisplay("inprog", true)).toBe(false);
  });

  it("is false without an explicit show override", () => {
    expect(isForcedTaskDisplay("notstarted", undefined)).toBe(false);
    expect(isForcedTaskDisplay("notstarted", false)).toBe(false);
  });
});

describe("getTaskMarkersForMap", () => {
  it("returns a marker for a real zone position on the requested map", () => {
    const task = makeTask({
      id: "t1",
      name: "Debut",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "Locate the thing",
          optional: false,
          maps: [{ normalizedName: "customs" }],
          zones: [
            { id: "z1", map: { normalizedName: "customs" }, position: { x: 10, y: 5, z: 20 } },
          ],
        },
      ],
    });

    const markers = getTaskMarkersForMap([task], "customs", { t1: "inprog" }, {});
    expect(markers).toEqual([
      {
        taskId: "t1",
        taskName: "Debut",
        taskImageLink: null,
        objectiveId: "obj-1",
        objectiveDescription: "Locate the thing",
        x: 10,
        z: 20,
        forced: false,
      },
    ]);
  });

  it("flags a marker shown only via a manual override (not active) as forced", () => {
    const task = makeTask({
      id: "t1",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "d",
          optional: false,
          maps: [{ normalizedName: "customs" }],
          zones: [{ id: "z1", map: { normalizedName: "customs" }, position: { x: 1, y: 0, z: 2 } }],
        },
      ],
    });
    // notstarted + override true -> shown, and forced.
    const [marker] = getTaskMarkersForMap([task], "customs", { t1: "notstarted" }, { t1: true });
    expect(marker?.forced).toBe(true);
    // inprog + override true -> shown, but NOT forced (it'd show anyway).
    const [active] = getTaskMarkersForMap([task], "customs", { t1: "inprog" }, { t1: true });
    expect(active?.forced).toBe(false);
  });

  it("excludes zones belonging to a different map", () => {
    const task = makeTask({
      id: "t1",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "d",
          optional: false,
          maps: [],
          zones: [{ id: "z1", map: { normalizedName: "woods" }, position: { x: 1, y: 0, z: 1 } }],
        },
      ],
    });

    expect(getTaskMarkersForMap([task], "customs", { t1: "inprog" }, {})).toEqual([]);
  });

  it("excludes zones with no position", () => {
    const task = makeTask({
      id: "t1",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "d",
          optional: false,
          maps: [],
          zones: [{ id: "z1", map: { normalizedName: "customs" }, position: null }],
        },
      ],
    });

    expect(getTaskMarkersForMap([task], "customs", { t1: "inprog" }, {})).toEqual([]);
  });

  it("excludes a not-in-progress task with no override", () => {
    const task = makeTask({
      id: "t1",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "d",
          optional: false,
          maps: [],
          zones: [{ id: "z1", map: { normalizedName: "customs" }, position: { x: 1, y: 0, z: 1 } }],
        },
      ],
    });

    expect(getTaskMarkersForMap([task], "customs", { t1: "notstarted" }, {})).toEqual([]);
  });

  it("includes a notstarted task with an explicit true override", () => {
    const task = makeTask({
      id: "t1",
      objectives: [
        {
          id: "obj-1",
          type: "visit",
          description: "d",
          optional: false,
          maps: [],
          zones: [{ id: "z1", map: { normalizedName: "customs" }, position: { x: 1, y: 0, z: 1 } }],
        },
      ],
    });

    expect(
      getTaskMarkersForMap([task], "customs", { t1: "notstarted" }, { t1: true }),
    ).toHaveLength(1);
  });

  it("handles an objective with no zones at all", () => {
    const task = makeTask({
      id: "t1",
      objectives: [{ id: "obj-1", type: "give", description: "d", optional: false, maps: [] }],
    });

    expect(getTaskMarkersForMap([task], "customs", { t1: "inprog" }, {})).toEqual([]);
  });
});
