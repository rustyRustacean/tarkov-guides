import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import { getMapRecommendations } from "./map-recommendation";

import type { ProfileProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
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
    itemRequirements: [],
    ...overrides,
  };
}

function makeProgress(overrides: Partial<ProfileProgress> = {}): ProfileProgress {
  return { ...emptyProfileProgress(), ...overrides };
}

const defaultOptions = { kappaOnly: false, includeLightkeeper: false };

describe("getMapRecommendations", () => {
  it("sorts maps by most currently-available tasks first, best pick at [0]", () => {
    const tasks = [
      makeTask({ id: "a", maps: ["customs"] }),
      makeTask({ id: "b", maps: ["customs"] }),
      makeTask({ id: "c", maps: ["woods"] }),
    ];
    const result = getMapRecommendations(tasks, makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([
      { normalizedName: "customs", taskCount: 2, tasks: [tasks[0], tasks[1]] },
      { normalizedName: "woods", taskCount: 1, tasks: [tasks[2]] },
    ]);
  });

  it("excludes Lightkeeper-required tasks by default", () => {
    const tasks = [makeTask({ id: "a", maps: ["woods"], lightkeeperRequired: true })];
    const result = getMapRecommendations(tasks, makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([]);
  });

  it("includes Lightkeeper-required tasks when includeLightkeeper is set", () => {
    const tasks = [makeTask({ id: "a", maps: ["woods"], lightkeeperRequired: true })];
    const result = getMapRecommendations(tasks, makeProgress(), "BEAR", {
      ...defaultOptions,
      includeLightkeeper: true,
    });
    expect(result).toEqual([{ normalizedName: "woods", taskCount: 1, tasks: [tasks[0]] }]);
  });

  it("restricts to Kappa-required tasks when kappaOnly is set", () => {
    const tasks = [
      makeTask({ id: "a", maps: ["customs"], kappaRequired: false }),
      makeTask({ id: "b", maps: ["woods"], kappaRequired: true }),
    ];
    const result = getMapRecommendations(tasks, makeProgress(), "BEAR", {
      ...defaultOptions,
      kappaOnly: true,
    });
    expect(result).toEqual([{ normalizedName: "woods", taskCount: 1, tasks: [tasks[1]] }]);
  });

  it("returns an empty array when nothing qualifies", () => {
    const result = getMapRecommendations([], makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([]);
  });

  it("ignores a locked task even when it references a map", () => {
    const gate = makeTask({ id: "gate", maps: ["factory"] });
    const locked = makeTask({
      id: "locked",
      maps: ["woods"],
      taskRequirements: [{ taskId: "gate", status: ["complete"] }],
    });
    const result = getMapRecommendations([gate, locked], makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([{ normalizedName: "factory", taskCount: 1, tasks: [gate] }]);
  });

  it("lists a task under every map it references", () => {
    const multiMap = makeTask({ id: "a", maps: ["customs", "woods"] });
    const result = getMapRecommendations([multiMap], makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([
      { normalizedName: "customs", taskCount: 1, tasks: [multiMap] },
      { normalizedName: "woods", taskCount: 1, tasks: [multiMap] },
    ]);
  });

  it("folds a level-gated map variant into its base map instead of a duplicate card", () => {
    // Real tarkov.dev data: Ground Zero tasks commonly list both "ground-zero"
    // and its level-21+ variant "ground-zero-21" in the same `maps` array.
    const task = makeTask({ id: "a", maps: ["ground-zero", "ground-zero-21"] });
    const result = getMapRecommendations([task], makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual([{ normalizedName: "ground-zero", taskCount: 1, tasks: [task] }]);
  });
});
