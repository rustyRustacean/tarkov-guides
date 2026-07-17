import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import { getBestMapRecommendation } from "./map-recommendation";

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

describe("getBestMapRecommendation", () => {
  it("picks the map with the most currently-available tasks", () => {
    const tasks = [
      makeTask({ id: "a", maps: ["customs"] }),
      makeTask({ id: "b", maps: ["customs"] }),
      makeTask({ id: "c", maps: ["woods"] }),
    ];
    const result = getBestMapRecommendation(tasks, makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual({ normalizedName: "customs", taskCount: 2 });
  });

  it("excludes Lightkeeper-required tasks by default", () => {
    const tasks = [makeTask({ id: "a", maps: ["woods"], lightkeeperRequired: true })];
    const result = getBestMapRecommendation(tasks, makeProgress(), "BEAR", defaultOptions);
    expect(result).toBeNull();
  });

  it("includes Lightkeeper-required tasks when includeLightkeeper is set", () => {
    const tasks = [makeTask({ id: "a", maps: ["woods"], lightkeeperRequired: true })];
    const result = getBestMapRecommendation(tasks, makeProgress(), "BEAR", {
      ...defaultOptions,
      includeLightkeeper: true,
    });
    expect(result).toEqual({ normalizedName: "woods", taskCount: 1 });
  });

  it("restricts to Kappa-required tasks when kappaOnly is set", () => {
    const tasks = [
      makeTask({ id: "a", maps: ["customs"], kappaRequired: false }),
      makeTask({ id: "b", maps: ["woods"], kappaRequired: true }),
    ];
    const result = getBestMapRecommendation(tasks, makeProgress(), "BEAR", {
      ...defaultOptions,
      kappaOnly: true,
    });
    expect(result).toEqual({ normalizedName: "woods", taskCount: 1 });
  });

  it("returns null when nothing qualifies", () => {
    const result = getBestMapRecommendation([], makeProgress(), "BEAR", defaultOptions);
    expect(result).toBeNull();
  });

  it("ignores a locked task even when it references a map", () => {
    const gate = makeTask({ id: "gate", maps: ["factory"] });
    const locked = makeTask({
      id: "locked",
      maps: ["woods"],
      taskRequirements: [{ taskId: "gate", status: ["complete"] }],
    });
    const result = getBestMapRecommendation([gate, locked], makeProgress(), "BEAR", defaultOptions);
    expect(result).toEqual({ normalizedName: "factory", taskCount: 1 });
  });
});
