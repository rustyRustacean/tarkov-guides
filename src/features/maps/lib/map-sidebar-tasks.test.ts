import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "@/features/progress-tracker/types";

import {
  firstOtherMap,
  getDefaultMapTasks,
  searchTasks,
  taskRelevantToMap,
} from "./map-sidebar-tasks";

import type { ProfileProgress, TaskStatus } from "@/features/progress-tracker/types";
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
  return { ...emptyProfileProgress("BEAR"), ...overrides };
}

function withStatus(
  progress: ProfileProgress,
  statuses: Readonly<Record<string, TaskStatus>>,
): ProfileProgress {
  const taskStatus: Record<string, { status: TaskStatus }> = {};
  for (const [id, status] of Object.entries(statuses)) taskStatus[id] = { status };
  return { ...progress, taskStatus };
}

describe("taskRelevantToMap", () => {
  it("is true for a task with no maps (any-map task)", () => {
    expect(taskRelevantToMap(makeTask({ maps: [] }), "reserve")).toBe(true);
  });

  it("is true when the map is explicitly listed", () => {
    expect(taskRelevantToMap(makeTask({ maps: ["reserve", "woods"] }), "reserve")).toBe(true);
  });

  it("is false when the task lists other maps but not this one", () => {
    expect(taskRelevantToMap(makeTask({ maps: ["woods"] }), "reserve")).toBe(false);
  });
});

describe("getDefaultMapTasks", () => {
  it("includes an inprog task relevant to the map in mapSpecific", () => {
    const task = makeTask({ id: "a", maps: ["reserve"] });
    const progress = withStatus(makeProgress(), { a: "inprog" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR");
    expect(result.mapSpecific.map((t) => t.id)).toEqual(["a"]);
    expect(result.anyMap).toEqual([]);
  });

  it("excludes an inprog task not relevant to the map", () => {
    const task = makeTask({ id: "a", maps: ["woods"] });
    const progress = withStatus(makeProgress(), { a: "inprog" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR");
    expect(result.mapSpecific).toEqual([]);
    expect(result.anyMap).toEqual([]);
  });

  it("puts an any-map inprog task in anyMap, not mapSpecific", () => {
    const task = makeTask({ id: "a", maps: [] });
    const progress = withStatus(makeProgress(), { a: "inprog" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR");
    expect(result.mapSpecific).toEqual([]);
    expect(result.anyMap.map((t) => t.id)).toEqual(["a"]);
  });

  it("includes a failed task relevant to the map", () => {
    const task = makeTask({ id: "a", maps: ["reserve"] });
    const progress = withStatus(makeProgress(), { a: "failed" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR");
    expect(result.mapSpecific.map((t) => t.id)).toEqual(["a"]);
  });

  it("includes a notstarted task force-shown via a display override so its marker stays reachable", () => {
    const task = makeTask({ id: "a", maps: ["reserve"] });
    const progress = withStatus(makeProgress(), { a: "notstarted" });
    // Without the override it wouldn't appear...
    expect(getDefaultMapTasks([task], "reserve", progress, "BEAR").mapSpecific).toEqual([]);
    // ...with "show on map" toggled on, it does.
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR", { a: true });
    expect(result.mapSpecific.map((t) => t.id)).toEqual(["a"]);
  });

  it("does not double-list a task that qualifies under two categories", () => {
    const task = makeTask({ id: "a", maps: ["reserve"] });
    const progress = withStatus(makeProgress(), { a: "failed" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR", { a: true });
    expect(result.mapSpecific.map((t) => t.id)).toEqual(["a"]);
  });

  it("includes a notstarted task blocked only by an inprog prerequisite (next after active)", () => {
    const prereq = makeTask({ id: "prereq", maps: ["reserve"] });
    const next = makeTask({
      id: "next",
      maps: ["reserve"],
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const progress = withStatus(makeProgress(), { prereq: "inprog" });
    const result = getDefaultMapTasks([prereq, next], "reserve", progress, "BEAR");
    expect(result.mapSpecific.map((t) => t.id).sort()).toEqual(["next", "prereq"]);
  });

  it("excludes a notstarted task whose prerequisite is not yet started at all", () => {
    const prereq = makeTask({ id: "prereq", maps: ["reserve"] });
    const next = makeTask({
      id: "next",
      maps: ["reserve"],
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const result = getDefaultMapTasks([prereq, next], "reserve", makeProgress(), "BEAR");
    expect(result.mapSpecific.map((t) => t.id)).toEqual([]);
  });

  it("excludes an already-available notstarted task with no prerequisites", () => {
    const available = makeTask({ id: "a", maps: ["reserve"] });
    const result = getDefaultMapTasks([available], "reserve", makeProgress(), "BEAR");
    expect(result.mapSpecific).toEqual([]);
  });

  it("excludes a done task", () => {
    const task = makeTask({ id: "a", maps: ["reserve"] });
    const progress = withStatus(makeProgress(), { a: "done" });
    const result = getDefaultMapTasks([task], "reserve", progress, "BEAR");
    expect(result.mapSpecific).toEqual([]);
  });

  it("sorts pinned tasks first within each group", () => {
    const a = makeTask({ id: "a", maps: ["reserve"] });
    const b = makeTask({ id: "b", maps: ["reserve"] });
    const progress = withStatus(makeProgress({ pinnedTaskIds: ["b"] }), {
      a: "inprog",
      b: "inprog",
    });
    const result = getDefaultMapTasks([a, b], "reserve", progress, "BEAR");
    expect(result.mapSpecific.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("searchTasks", () => {
  it("returns nothing for an empty query", () => {
    const task = makeTask({ id: "a", name: "Find the loot" });
    expect(searchTasks([task], "", makeProgress())).toEqual([]);
    expect(searchTasks([task], "   ", makeProgress())).toEqual([]);
  });

  it("matches by task name, case-insensitively", () => {
    const task = makeTask({ id: "a", name: "Find the loot" });
    expect(searchTasks([task], "the LOOT", makeProgress()).map((t) => t.id)).toEqual(["a"]);
  });

  it("matches by trader name", () => {
    const task = makeTask({ id: "a", trader: { id: "t1", name: "Prapor", imageLink: null } });
    expect(searchTasks([task], "prapor", makeProgress()).map((t) => t.id)).toEqual(["a"]);
  });

  it("matches by map, tolerating a hyphen-free query", () => {
    const task = makeTask({ id: "a", maps: ["ground-zero"] });
    expect(searchTasks([task], "ground zero", makeProgress()).map((t) => t.id)).toEqual(["a"]);
  });

  it("matches by required item name", () => {
    const task = makeTask({
      id: "a",
      itemRequirements: [
        {
          id: "i1",
          name: "Bolts",
          shortName: "Bolts",
          iconLink: null,
          count: 5,
          foundInRaid: false,
        },
      ],
    });
    expect(searchTasks([task], "bolts", makeProgress()).map((t) => t.id)).toEqual(["a"]);
  });

  it('matches the literal term "kappa" only against kappa-required tasks', () => {
    const kappaTask = makeTask({ id: "a", kappaRequired: true });
    const other = makeTask({ id: "b", kappaRequired: false });
    expect(searchTasks([kappaTask, other], "kappa", makeProgress()).map((t) => t.id)).toEqual([
      "a",
    ]);
  });

  it("treats comma-separated terms as OR", () => {
    const a = makeTask({ id: "a", name: "Zulu" });
    const b = makeTask({ id: "b", name: "Yankee" });
    const c = makeTask({ id: "c", name: "Unrelated" });
    const results = searchTasks([a, b, c], "zulu, yankee", makeProgress()).map((t) => t.id);
    expect(results.sort()).toEqual(["a", "b"]);
  });

  it("sorts by status rank (inprog, notstarted, failed, done) then name", () => {
    const done = makeTask({ id: "done", name: "Alpha match" });
    const notstarted = makeTask({ id: "notstarted", name: "Beta match" });
    const failed = makeTask({ id: "failed", name: "Gamma match" });
    const inprog = makeTask({ id: "inprog", name: "Zeta match" });
    const progress = withStatus(makeProgress(), {
      done: "done",
      notstarted: "notstarted",
      failed: "failed",
      inprog: "inprog",
    });
    const results = searchTasks([done, notstarted, failed, inprog], "match", progress).map(
      (t) => t.id,
    );
    expect(results).toEqual(["inprog", "notstarted", "failed", "done"]);
  });
});

describe("firstOtherMap", () => {
  it("returns null for an any-map task", () => {
    expect(firstOtherMap(makeTask({ maps: [] }), "reserve")).toBeNull();
  });

  it("returns null when the task is already relevant to the current map", () => {
    expect(firstOtherMap(makeTask({ maps: ["reserve", "woods"] }), "reserve")).toBeNull();
  });

  it("returns the first listed map when none match the current map", () => {
    expect(firstOtherMap(makeTask({ maps: ["woods", "customs"] }), "reserve")).toBe("woods");
  });
});
