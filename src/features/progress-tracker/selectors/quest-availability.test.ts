import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import {
  arePrerequisitesMet,
  getAvailableQuests,
  getLockedQuests,
  getQuestAvailability,
  getQuestDependents,
  getQuestPriorityScore,
  meetsFactionRequirement,
  meetsPrestigeRequirement,
  meetsTraderRequirements,
} from "./quest-availability";

import type { ProfileProgress, TaskProgress, TaskStatus } from "../types";
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

function tasksById(tasks: readonly NormalizedTask[]): ReadonlyMap<string, NormalizedTask> {
  return new Map(tasks.map((task) => [task.id, task]));
}

function makeProgress(overrides: Partial<ProfileProgress> = {}): ProfileProgress {
  return { ...emptyProfileProgress(), ...overrides };
}

function progressOf(status: TaskStatus, overrides: Partial<TaskProgress> = {}): TaskProgress {
  return { status, ...overrides };
}

describe("arePrerequisitesMet", () => {
  it("is met when a requirement has an empty status array", () => {
    const task = makeTask({ taskRequirements: [{ taskId: "other", status: [] }] });
    const result = arePrerequisitesMet(task, tasksById([task]), {});
    expect(result.met).toBe(true);
  });

  it("is met (fail-open) when the prerequisite task isn't in the live dataset", () => {
    const task = makeTask({ taskRequirements: [{ taskId: "missing", status: ["complete"] }] });
    const result = arePrerequisitesMet(task, tasksById([task]), {});
    expect(result.met).toBe(true);
  });

  it("is UNMET when the prerequisite is a real task that hasn't reached the required status yet - the fix for the confirmed legacy stub bug (QuestNode.tsx's `.every(() => true)`)", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const result = arePrerequisitesMet(task, tasksById([prereq, task]), {
      prereq: progressOf("inprog"),
    });
    expect(result.met).toBe(false);
    expect(result.unmetTaskIds).toEqual(["prereq"]);
  });

  it("is met once the prerequisite reaches the required wire status", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const result = arePrerequisitesMet(task, tasksById([prereq, task]), {
      prereq: progressOf("done"),
    });
    expect(result.met).toBe(true);
  });

  it("maps inprog to the wire status 'active'", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["active"] }],
    });
    const result = arePrerequisitesMet(task, tasksById([prereq, task]), {
      prereq: progressOf("inprog"),
    });
    expect(result.met).toBe(true);
  });

  it("is met (OR semantics) when a real branch requirement accepts either complete or failed - matches live tarkov.dev data (24 real tasks, e.g. 'Debut' accepting 'Shooting Cans' complete OR failed)", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      taskRequirements: [{ taskId: "prereq", status: ["complete", "failed"] }],
    });
    expect(
      arePrerequisitesMet(task, tasksById([prereq, task]), { prereq: progressOf("failed") }).met,
    ).toBe(true);
    expect(
      arePrerequisitesMet(task, tasksById([prereq, task]), { prereq: progressOf("done") }).met,
    ).toBe(true);
    expect(
      arePrerequisitesMet(task, tasksById([prereq, task]), { prereq: progressOf("inprog") }).met,
    ).toBe(false);
  });

  describe("real-time delay gating (availableDelaySecondsMin/Max)", () => {
    // Real values confirmed against tarkov.dev + the wiki's own infobox
    // annotation during the 2026-07-16 audit: "The Door"'s prerequisite
    // ("Signal - Part 3") is wiki-documented as "(+2hr)", matching its live
    // availableDelaySecondsMin/Max of 7200/7700 exactly.
    const THE_DOOR_DELAY_MIN = 7200;
    const THE_DOOR_DELAY_MAX = 7700;

    it("is UNMET (real in-game delay hasn't elapsed) when the prerequisite JUST completed", () => {
      const prereq = makeTask({ id: "signal-part-3" });
      const theDoor = makeTask({
        id: "the-door",
        availableDelaySecondsMin: THE_DOOR_DELAY_MIN,
        availableDelaySecondsMax: THE_DOOR_DELAY_MAX,
        taskRequirements: [{ taskId: "signal-part-3", status: ["complete"] }],
      });
      const result = arePrerequisitesMet(theDoor, tasksById([prereq, theDoor]), {
        "signal-part-3": progressOf("done", { completedAt: new Date().toISOString() }),
      });
      expect(result.met).toBe(false);
      expect(result.unmetTaskIds).toEqual(["signal-part-3"]);
      expect(result.delayedUnlock).not.toBeNull();
      expect(result.delayedUnlock?.prereqTaskId).toBe("signal-part-3");
    });

    it("is still UNMET once Min has elapsed but Max hasn't - confirms the gate uses the LATEST bound, not the earliest", () => {
      const prereq = makeTask({ id: "signal-part-3" });
      const theDoor = makeTask({
        id: "the-door",
        availableDelaySecondsMin: THE_DOOR_DELAY_MIN,
        availableDelaySecondsMax: THE_DOOR_DELAY_MAX,
        taskRequirements: [{ taskId: "signal-part-3", status: ["complete"] }],
      });
      // 60s past Min (7200s) but well short of Max (7700s).
      const pastMinNotMax = new Date(Date.now() - (THE_DOOR_DELAY_MIN + 60) * 1000).toISOString();
      const result = arePrerequisitesMet(theDoor, tasksById([prereq, theDoor]), {
        "signal-part-3": progressOf("done", { completedAt: pastMinNotMax }),
      });
      expect(result.met).toBe(false);
      expect(result.delayedUnlock).not.toBeNull();
    });

    it("is met once the real delay window has elapsed", () => {
      const prereq = makeTask({ id: "signal-part-3" });
      const theDoor = makeTask({
        id: "the-door",
        availableDelaySecondsMin: THE_DOOR_DELAY_MIN,
        availableDelaySecondsMax: THE_DOOR_DELAY_MAX,
        taskRequirements: [{ taskId: "signal-part-3", status: ["complete"] }],
      });
      const longAgo = new Date(Date.now() - (THE_DOOR_DELAY_MAX + 60) * 1000).toISOString();
      const result = arePrerequisitesMet(theDoor, tasksById([prereq, theDoor]), {
        "signal-part-3": progressOf("done", { completedAt: longAgo }),
      });
      expect(result.met).toBe(true);
      expect(result.delayedUnlock).toBeNull();
    });

    it("fails open (treats as elapsed) when completedAt is missing on an old pre-delay-field profile, rather than locking indefinitely", () => {
      const prereq = makeTask({ id: "signal-part-3" });
      const theDoor = makeTask({
        id: "the-door",
        availableDelaySecondsMin: THE_DOOR_DELAY_MIN,
        availableDelaySecondsMax: THE_DOOR_DELAY_MAX,
        taskRequirements: [{ taskId: "signal-part-3", status: ["complete"] }],
      });
      const result = arePrerequisitesMet(theDoor, tasksById([prereq, theDoor]), {
        "signal-part-3": progressOf("done"),
      });
      expect(result.met).toBe(true);
    });

    it("is unaffected by the delay fields when the task has no real delay (the common case, 486/510 real tasks)", () => {
      const prereq = makeTask({ id: "prereq" });
      const task = makeTask({
        id: "target",
        taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
      });
      const result = arePrerequisitesMet(task, tasksById([prereq, task]), {
        prereq: progressOf("done", { completedAt: new Date().toISOString() }),
      });
      expect(result.met).toBe(true);
      expect(result.delayedUnlock).toBeNull();
    });
  });
});

describe("meetsFactionRequirement", () => {
  // Real values confirmed live 2026-07-16: "Green Corridor" (Prapor) is
  // BEAR-exclusive, "Road Closed" (Peacekeeper) is USEC-exclusive - both
  // share the same prerequisite ("Spa Tour - Part 7"), confirming this is a
  // real faction fork in the quest line, not a data anomaly.
  it("is met for a faction-exclusive task when the profile's faction matches", () => {
    const greenCorridor = makeTask({ id: "green-corridor", factionName: "BEAR" });
    expect(meetsFactionRequirement(greenCorridor, "BEAR")).toBe(true);
  });

  it("is unmet for a faction-exclusive task when the profile's faction doesn't match", () => {
    const greenCorridor = makeTask({ id: "green-corridor", factionName: "BEAR" });
    expect(meetsFactionRequirement(greenCorridor, "USEC")).toBe(false);
  });

  it("is met for an 'Any' faction task regardless of profile faction", () => {
    const task = makeTask({ factionName: "Any" });
    expect(meetsFactionRequirement(task, "BEAR")).toBe(true);
    expect(meetsFactionRequirement(task, "USEC")).toBe(true);
  });

  it("fails open (treated like 'Any') for a null factionName - the wire type's nullability, never actually observed live (498 Any / 6 BEAR / 6 USEC across all 510 real tasks)", () => {
    const task = makeTask({ factionName: null });
    expect(meetsFactionRequirement(task, "BEAR")).toBe(true);
  });
});

describe("meetsPrestigeRequirement", () => {
  // Real values confirmed via wiki cross-reference 2026-07-16: tarkov.dev's
  // `requiredPrestige.prestigeLevel: N` means "must already have Prestige
  // level N" - verified against all 4 real "New Beginning" tasks, whose
  // wiki requirement text ("Must have Prestige level N") matches exactly.
  it("is met when there is no Prestige requirement", () => {
    const task = makeTask({ requiredPrestigeLevel: null });
    expect(meetsPrestigeRequirement(task, 0)).toBe(true);
  });

  it("is unmet when the profile's Prestige level is below the requirement", () => {
    const newBeginningTier2 = makeTask({ requiredPrestigeLevel: 1 });
    expect(meetsPrestigeRequirement(newBeginningTier2, 0)).toBe(false);
  });

  it("is met once the profile's Prestige level meets or exceeds the requirement", () => {
    const newBeginningTier2 = makeTask({ requiredPrestigeLevel: 1 });
    expect(meetsPrestigeRequirement(newBeginningTier2, 1)).toBe(true);
    expect(meetsPrestigeRequirement(newBeginningTier2, 2)).toBe(true);
  });
});

describe("meetsTraderRequirements", () => {
  it("is met when there are no trader requirements", () => {
    const task = makeTask();
    expect(meetsTraderRequirements(task, makeProgress()).met).toBe(true);
  });

  it("checks a 'level' requirement against traderLevels, defaulting a missing entry to 1", () => {
    const task = makeTask({
      traderRequirements: [
        {
          traderId: "prapor",
          traderName: "Prapor",
          requirementType: "level",
          compareMethod: ">=",
          value: 2,
        },
      ],
    });
    expect(meetsTraderRequirements(task, makeProgress()).met).toBe(false);
    expect(meetsTraderRequirements(task, makeProgress({ traderLevels: { prapor: 2 } })).met).toBe(
      true,
    );
  });

  it("checks a 'reputation' requirement against traderReputation, defaulting a missing entry to 0", () => {
    const task = makeTask({
      traderRequirements: [
        {
          traderId: "fence",
          traderName: "Fence",
          requirementType: "reputation",
          compareMethod: ">=",
          value: 1,
        },
      ],
    });
    expect(meetsTraderRequirements(task, makeProgress()).met).toBe(false);
    expect(
      meetsTraderRequirements(task, makeProgress({ traderReputation: { fence: 1 } })).met,
    ).toBe(true);
  });

  it("supports <, <=, and >= compare methods against real observed tarkov.dev values", () => {
    const geTask = makeTask({
      traderRequirements: [
        { traderId: "t", traderName: "T", requirementType: "level", compareMethod: ">=", value: 4 },
      ],
    });
    const ltTask = makeTask({
      traderRequirements: [
        {
          traderId: "t",
          traderName: "T",
          requirementType: "reputation",
          compareMethod: "<",
          value: 0,
        },
      ],
    });
    expect(meetsTraderRequirements(geTask, makeProgress({ traderLevels: { t: 4 } })).met).toBe(
      true,
    );
    expect(meetsTraderRequirements(geTask, makeProgress({ traderLevels: { t: 3 } })).met).toBe(
      false,
    );
    expect(meetsTraderRequirements(ltTask, makeProgress({ traderReputation: { t: -1 } })).met).toBe(
      true,
    );
  });

  it("returns the unmet requirement entries", () => {
    const requirement = {
      traderId: "prapor",
      traderName: "Prapor",
      requirementType: "level",
      compareMethod: ">=" as const,
      value: 2,
    };
    const task = makeTask({ traderRequirements: [requirement] });
    expect(meetsTraderRequirements(task, makeProgress()).unmet).toEqual([requirement]);
  });
});

describe("getQuestAvailability / getAvailableQuests / getLockedQuests", () => {
  it("marks a notstarted task with all gates met as available", () => {
    const task = makeTask({ minPlayerLevel: 5 });
    const progress = makeProgress({ playerLevel: 5 });
    const availability = getQuestAvailability([task], progress, "BEAR").get(task.id);
    expect(availability?.isAvailable).toBe(true);
    expect(availability?.isLocked).toBe(false);
  });

  it("locks a notstarted task whose player-level gate isn't met", () => {
    const task = makeTask({ minPlayerLevel: 10 });
    const progress = makeProgress({ playerLevel: 5 });
    const availability = getQuestAvailability([task], progress, "BEAR").get(task.id);
    expect(availability?.isAvailable).toBe(false);
    expect(availability?.isLocked).toBe(true);
  });

  it("a task already inprog/done/failed is never available nor locked", () => {
    const task = makeTask();
    for (const status of ["inprog", "done", "failed"] satisfies TaskStatus[]) {
      const progress = makeProgress({ taskStatus: { [task.id]: { status } } });
      const availability = getQuestAvailability([task], progress, "BEAR").get(task.id);
      expect(availability?.isAvailable).toBe(false);
      expect(availability?.isLocked).toBe(false);
    }
  });

  it("locks a task whose factionName doesn't match the profile's faction, and flags factionMismatch - real gap found in the 2026-07-16 audit (factionName was fetched but never checked anywhere)", () => {
    const greenCorridor = makeTask({ id: "green-corridor", factionName: "BEAR" });
    const usecProgress = makeProgress({ playerLevel: 99 });
    const availability = getQuestAvailability([greenCorridor], usecProgress, "USEC").get(
      greenCorridor.id,
    );
    expect(availability?.isAvailable).toBe(false);
    expect(availability?.isLocked).toBe(true);
    expect(availability?.factionMismatch).toBe(true);
  });

  it("locks a Prestige-gated task until the profile's prestigeLevel meets the requirement", () => {
    const newBeginningTier2 = makeTask({ id: "new-beginning-2", requiredPrestigeLevel: 1 });
    const belowPrestige = makeProgress({ playerLevel: 99, prestigeLevel: 0 });
    const atPrestige = makeProgress({ playerLevel: 99, prestigeLevel: 1 });
    const lockedAvailability = getQuestAvailability([newBeginningTier2], belowPrestige, "BEAR").get(
      newBeginningTier2.id,
    );
    expect(lockedAvailability?.isAvailable).toBe(false);
    expect(lockedAvailability?.prestigeUnmet).toBe(true);
    const unlockedAvailability = getQuestAvailability([newBeginningTier2], atPrestige, "BEAR").get(
      newBeginningTier2.id,
    );
    expect(unlockedAvailability?.isAvailable).toBe(true);
    expect(unlockedAvailability?.prestigeUnmet).toBe(false);
  });

  it("locks a task with two simultaneously unmet gates (unmet prerequisite AND unmet player level), independently reporting both", () => {
    const prereq = makeTask({ id: "prereq" });
    const task = makeTask({
      id: "target",
      minPlayerLevel: 10,
      taskRequirements: [{ taskId: "prereq", status: ["complete"] }],
    });
    const progress = makeProgress({ playerLevel: 1 });
    const availability = getQuestAvailability([prereq, task], progress, "BEAR").get(task.id);
    expect(availability?.isAvailable).toBe(false);
    expect(availability?.isLocked).toBe(true);
    // Proves the prereq gate was independently evaluated (not short-circuited
    // by the level gate failing first) - task.minPlayerLevel (10) > progress
    // .playerLevel (1) proves the level gate is the other unmet condition.
    expect(availability?.unmetPrereqTaskIds).toEqual(["prereq"]);
  });

  it("accumulates every unmet prerequisite task id, not just the first", () => {
    const prereqA = makeTask({ id: "prereq-a" });
    const prereqB = makeTask({ id: "prereq-b" });
    const task = makeTask({
      id: "target",
      taskRequirements: [
        { taskId: "prereq-a", status: ["complete"] },
        { taskId: "prereq-b", status: ["complete"] },
      ],
    });
    const progress = makeProgress({ playerLevel: 99 });
    const availability = getQuestAvailability([prereqA, prereqB, task], progress, "BEAR").get(
      task.id,
    );
    expect(availability?.isAvailable).toBe(false);
    expect(availability?.unmetPrereqTaskIds).toEqual(["prereq-a", "prereq-b"]);
  });

  it("getAvailableQuests/getLockedQuests partition tasks correctly", () => {
    const available = makeTask({ id: "available" });
    const locked = makeTask({ id: "locked", minPlayerLevel: 99 });
    const progress = makeProgress({ playerLevel: 1 });
    expect(getAvailableQuests([available, locked], progress, "BEAR").map((t) => t.id)).toEqual([
      "available",
    ]);
    expect(getLockedQuests([available, locked], progress, "BEAR").map((t) => t.id)).toEqual([
      "locked",
    ]);
  });
});

describe("getQuestDependents", () => {
  it("derives dependents purely from taskRequirements, never from a persisted names-based field", () => {
    const root = makeTask({ id: "root" });
    const dependent = makeTask({
      id: "dependent",
      taskRequirements: [{ taskId: "root", status: ["complete"] }],
    });
    const unrelated = makeTask({ id: "unrelated" });
    expect(getQuestDependents("root", [root, dependent, unrelated]).map((t) => t.id)).toEqual([
      "dependent",
    ]);
  });
});

describe("getQuestPriorityScore", () => {
  it("stays within 0-100 even for a maximally-weighted task", () => {
    const task = makeTask({
      experience: 1_000_000,
      kappaRequired: true,
      finishRewards: {
        items: [
          {
            item: { id: "i1", name: "LEDX", shortName: "LEDX", iconLink: null, basePrice: 500_000 },
            count: 1,
          },
        ],
        traderStanding: [
          { trader: { id: "prapor-id", name: "Prapor", imageLink: null }, standing: 0.1 },
        ],
        traderUnlock: [{ trader: { id: "prapor-id", name: "Prapor", imageLink: null } }],
        offerUnlock: [],
        skillLevelReward: [],
      },
    });
    const manyDependents = Array.from({ length: 20 }, (_, i) =>
      makeTask({ id: `dep-${String(i)}` }),
    );
    expect(getQuestPriorityScore(task, manyDependents)).toBe(100);
  });

  it("scores a bare-minimum task at 0", () => {
    expect(getQuestPriorityScore(makeTask(), [])).toBe(0);
  });
});
