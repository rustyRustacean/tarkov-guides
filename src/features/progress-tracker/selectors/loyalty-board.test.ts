import { describe, expect, it } from "vitest";

import {
  buildLoyaltyBoard,
  loyaltyBucketLabel,
  loyaltyBucketLayer,
  LOYALTY_BUCKET_ORDER,
  resolveLoyaltyBoardEntry,
} from "./loyalty-board";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: "task-1",
    name: "Task",
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
    trader: { id: "prapor-id", name: "Prapor", imageLink: null },
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

describe("LOYALTY_BUCKET_ORDER / loyaltyBucketLayer / loyaltyBucketLabel", () => {
  it("orders Essential first, then LL1-4, then Unconfirmed last", () => {
    expect(LOYALTY_BUCKET_ORDER).toEqual(["essential", 1, 2, 3, 4, "unconfirmed"]);
  });

  it("maps each bucket to its position in the row order", () => {
    expect(loyaltyBucketLayer("essential")).toBe(0);
    expect(loyaltyBucketLayer(1)).toBe(1);
    expect(loyaltyBucketLayer(4)).toBe(4);
    expect(loyaltyBucketLayer("unconfirmed")).toBe(5);
  });

  it("gives every bucket a human label", () => {
    expect(loyaltyBucketLabel("essential")).toBe("Essential");
    expect(loyaltyBucketLabel(2)).toBe("Loyalty Level 2");
    expect(loyaltyBucketLabel("unconfirmed")).toBe("Unconfirmed");
  });
});

describe("resolveLoyaltyBoardEntry", () => {
  it("uses the curated override's loyaltyLevel when present (Prapor's real Debut, LL1)", () => {
    const task = makeTask({ id: "5936d90786f7742b1420ba5b" });
    expect(resolveLoyaltyBoardEntry(task)).toEqual({
      taskId: "5936d90786f7742b1420ba5b",
      bucket: 1,
      essential: false,
      source: "curated",
    });
  });

  it("routes a curated essential:true override to the essential bucket (Prapor's real Big Customer)", () => {
    const task = makeTask({ id: "597a171586f77405ba6887d3", kappaRequired: true });
    expect(resolveLoyaltyBoardEntry(task)).toEqual({
      taskId: "597a171586f77405ba6887d3",
      bucket: "essential",
      essential: true,
      source: "curated",
    });
  });

  it("falls back to the task's own traderRequirements level entry when there is no curated override", () => {
    const task = makeTask({
      id: "not-curated",
      trader: { id: "trader-1", name: "Skier", imageLink: null },
      traderRequirements: [
        {
          traderId: "trader-1",
          traderName: "Skier",
          requirementType: "level",
          compareMethod: ">=",
          value: 3,
        },
      ],
    });
    expect(resolveLoyaltyBoardEntry(task)).toEqual({
      taskId: "not-curated",
      bucket: 3,
      essential: false,
      source: "api",
    });
  });

  it("ignores a traderRequirements level entry that belongs to a different trader", () => {
    const task = makeTask({
      id: "not-curated",
      trader: { id: "trader-1", name: "Skier", imageLink: null },
      traderRequirements: [
        {
          traderId: "other-trader",
          traderName: "Prapor",
          requirementType: "level",
          compareMethod: ">=",
          value: 2,
        },
      ],
    });
    expect(resolveLoyaltyBoardEntry(task).source).toBe("unconfirmed");
  });

  it("ignores a traderRequirements entry that is a reputation gate, not a level gate", () => {
    const task = makeTask({
      id: "not-curated",
      trader: { id: "trader-1", name: "Fence", imageLink: null },
      traderRequirements: [
        {
          traderId: "trader-1",
          traderName: "Fence",
          requirementType: "reputation",
          compareMethod: ">=",
          value: 3,
        },
      ],
    });
    expect(resolveLoyaltyBoardEntry(task).source).toBe("unconfirmed");
  });

  it("never falls back to minPlayerLevel: a high-level task with no gate at all is unconfirmed, not LL4", () => {
    const task = makeTask({ id: "not-curated", minPlayerLevel: 40 });
    expect(resolveLoyaltyBoardEntry(task)).toEqual({
      taskId: "not-curated",
      bucket: "unconfirmed",
      essential: false,
      source: "unconfirmed",
    });
  });
});

describe("buildLoyaltyBoard", () => {
  it("resolves an entry for every task, keyed by task id", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    const board = buildLoyaltyBoard(tasks);
    expect(board.size).toBe(2);
    expect(board.get("a")?.taskId).toBe("a");
    expect(board.get("b")?.taskId).toBe("b");
  });
});
