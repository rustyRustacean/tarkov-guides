import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTaskCompletionSnapshot,
  computeAutoCompletePrereqsPatch,
  computeAutoStartUnlockedPatch,
} from "./task-status";

import type { TaskProgress } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

const NOW = "2026-07-22T12:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

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

function tasksById(tasks: readonly NormalizedTask[]): ReadonlyMap<string, NormalizedTask> {
  return new Map(tasks.map((task) => [task.id, task]));
}

describe("computeAutoCompletePrereqsPatch", () => {
  it("cascades a strictly-complete prerequisite to done", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const result = computeAutoCompletePrereqsPatch(task, tasksById([prereq, task]), {});
    expect(result.patch.prereq).toEqual({ status: "done", autoDone: true, completedAt: NOW });
    expect(result.cascadedTaskIds).toEqual(["prereq"]);
  });

  it("does not cascade a requirement with a mixed/ambiguous status list", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete", "active"] }],
    });
    const result = computeAutoCompletePrereqsPatch(task, tasksById([prereq, task]), {});
    expect(result.patch).toEqual({});
  });

  it("never overwrites a prerequisite already done or failed", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const existingStatus: Record<string, TaskProgress> = { prereq: { status: "failed" } };
    const result = computeAutoCompletePrereqsPatch(task, tasksById([prereq, task]), existingStatus);
    expect(result.patch).toEqual({});
  });

  it("recurses across a chain, including cross-trader (no trader field on requirements)", () => {
    const grandparent = makeTask({ id: "grandparent" });
    const parent = makeTask({
      id: "parent",
      taskRequirements: [{ taskId: "grandparent", status: ["complete"] }],
    });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "parent", status: ["complete"] }],
    });
    const result = computeAutoCompletePrereqsPatch(
      task,
      tasksById([grandparent, parent, task]),
      {},
    );
    expect([...result.cascadedTaskIds].sort()).toEqual(["grandparent", "parent"]);
  });

  it("skips a requirement whose target task isn't in the live dataset", () => {
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "missing", status: ["complete"] }],
    });
    const result = computeAutoCompletePrereqsPatch(task, tasksById([task]), {});
    expect(result.patch).toEqual({});
  });

  it("terminates (and cascades each task at most once) on a cyclic dependency shape, instead of infinitely recursing", () => {
    const a = makeTask({ id: "a", taskRequirements: [{ taskId: "b", status: ["complete"] }] });
    const b = makeTask({ id: "b", taskRequirements: [{ taskId: "a", status: ["complete"] }] });
    const result = computeAutoCompletePrereqsPatch(a, tasksById([a, b]), {});
    // The mutual-requirement shape means both are legitimately reachable
    // once each - what matters is termination and no duplicate entries.
    expect(result.cascadedTaskIds).toEqual(["b", "a"]);
    expect(new Set(result.cascadedTaskIds).size).toBe(result.cascadedTaskIds.length);
  });

  it("still cascades a prerequisite reached via a strict requirement, even after an earlier ambiguous requirement for the same id - regression test for a premature-visited bug", () => {
    // "b" is a shared prerequisite of both p1 (ambiguous re: b, never
    // cascades on its own) and p2 (strict re: b). An earlier version marked
    // "b" as visited the first time ANY requirement referenced it - even
    // the ambiguous one that never actually got processed - permanently
    // blocking p2's later, genuinely strict encounter of the same id.
    const b = makeTask({ id: "b" });
    const p1 = makeTask({
      id: "p1",
      taskRequirements: [{ taskId: "b", status: ["complete", "active"] }],
    });
    const p2 = makeTask({ id: "p2", taskRequirements: [{ taskId: "b", status: ["complete"] }] });
    const target = makeTask({
      id: "target",
      taskRequirements: [
        { taskId: "p1", status: ["complete"] },
        { taskId: "p2", status: ["complete"] },
      ],
    });

    const result = computeAutoCompletePrereqsPatch(target, tasksById([b, p1, p2, target]), {});

    expect(result.patch.b).toEqual({ status: "done", autoDone: true, completedAt: NOW });
    expect(result.cascadedTaskIds).toContain("b");
  });
});

describe("computeAutoStartUnlockedPatch", () => {
  it("is a no-op when autoStartNext is false", () => {
    const unlocked = makeTask({
      id: "unlocked",
      taskRequirements: [{ taskId: "done-task", status: ["complete"] }],
    });
    const result = computeAutoStartUnlockedPatch("done-task", [unlocked], {}, false);
    expect(result.patch).toEqual({});
  });

  it("auto-starts a notstarted task whose sole strict requirement just became done", () => {
    const unlocked = makeTask({
      id: "unlocked",
      taskRequirements: [{ taskId: "done-task", status: ["complete"] }],
    });
    const taskStatus: Record<string, TaskProgress> = { "done-task": { status: "done" } };
    const result = computeAutoStartUnlockedPatch("done-task", [unlocked], taskStatus, true);
    expect(result.patch.unlocked).toEqual({ status: "inprog", autoStarted: true });
    expect(result.startedTaskIds).toEqual(["unlocked"]);
  });

  it("does not start a task if another of its strict requirements is still unmet", () => {
    const unlocked = makeTask({
      id: "unlocked",
      taskRequirements: [
        { taskId: "done-task", status: ["complete"] },
        { taskId: "other-task", status: ["complete"] },
      ],
    });
    const taskStatus: Record<string, TaskProgress> = { "done-task": { status: "done" } };
    const result = computeAutoStartUnlockedPatch("done-task", [unlocked], taskStatus, true);
    expect(result.patch).toEqual({});
  });

  it("ignores tasks that are not notstarted", () => {
    const alreadyStarted = makeTask({
      id: "already-started",
      taskRequirements: [{ taskId: "done-task", status: ["complete"] }],
    });
    const taskStatus: Record<string, TaskProgress> = {
      "done-task": { status: "done" },
      "already-started": { status: "inprog" },
    };
    const result = computeAutoStartUnlockedPatch("done-task", [alreadyStarted], taskStatus, true);
    expect(result.patch).toEqual({});
  });
});

describe("buildTaskCompletionSnapshot", () => {
  it("captures the current have count for every required item, defaulting missing entries to 0", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 1, foundInRaid: false },
        { id: "item-b", name: "B", shortName: "B", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const snapshot = buildTaskCompletionSnapshot(task, { "item-a": 3 });
    expect(snapshot).toEqual({ "item-a": 3, "item-b": 0 });
  });
});
