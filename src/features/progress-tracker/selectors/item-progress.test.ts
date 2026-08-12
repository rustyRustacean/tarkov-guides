import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import { getTrackedItems } from "./item-progress";

import type { ProfileProgress } from "../types";
import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

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

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    wikiLink: null,
    basePrice: 100,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    traderSell: 0,
    traderSellVendor: "",
    traderBuy: 0,
    traderBuyVendor: "",
    buyOffers: [],
    avg24hPve: null,
    lastLowPve: null,
    changePve: null,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<ProfileProgress> = {}): ProfileProgress {
  return { ...emptyProfileProgress("BEAR"), ...overrides };
}

describe("getTrackedItems", () => {
  it("includes item requirements only from INPROG tasks, not notstarted/done/failed ones", () => {
    const inprogTask = makeTask({
      id: "inprog-task",
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 3, foundInRaid: true },
      ],
    });
    const notStartedTask = makeTask({
      id: "notstarted-task",
      itemRequirements: [
        { id: "item-b", name: "B", shortName: "B", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const progress = makeProgress({ taskStatus: { "inprog-task": { status: "inprog" } } });
    const rows = getTrackedItems([inprogTask, notStartedTask], [], progress);
    expect(rows.map((r) => r.id)).toEqual(["item-a"]);
  });

  it("dedupes the same item across two active tasks, taking the max need and ORing foundInRaid", () => {
    const taskA = makeTask({
      id: "task-a",
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 2, foundInRaid: true },
      ],
    });
    const taskB = makeTask({
      id: "task-b",
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 5, foundInRaid: false },
      ],
    });
    const progress = makeProgress({
      taskStatus: { "task-a": { status: "inprog" }, "task-b": { status: "inprog" } },
    });
    const rows = getTrackedItems([taskA, taskB], [], progress);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ need: 5, foundInRaid: true });
  });

  it("computes remaining as max(0, need - have)", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 5, foundInRaid: false },
      ],
    });
    const progress = makeProgress({
      taskStatus: { [task.id]: { status: "inprog" } },
      have: { "item-a": 3 },
    });
    const rows = getTrackedItems([task], [], progress);
    expect(rows[0]).toMatchObject({ have: 3, remaining: 2 });
  });

  it("includes every custom item", () => {
    const progress = makeProgress({
      customItems: [{ id: "custom-1", name: "Custom Thing", iconLink: null, need: 4 }],
    });
    const rows = getTrackedItems([], [], progress);
    expect(rows).toEqual([expect.objectContaining({ id: "custom-1", need: 4, source: "custom" })]);
  });

  it("includes pinned items not otherwise covered, resolved against the live item catalog", () => {
    const progress = makeProgress({ pinnedItemIds: ["item-a"] });
    const rows = getTrackedItems([], [makeItem({ id: "item-a" })], progress);
    expect(rows).toEqual([
      expect.objectContaining({ id: "item-a", source: "pinned", pinned: true }),
    ]);
  });

  it("drops a pinned item id that doesn't resolve against the live catalog", () => {
    const progress = makeProgress({ pinnedItemIds: ["unknown-item"] });
    expect(getTrackedItems([], [], progress)).toEqual([]);
  });

  it("still surfaces an item with leftover pending after its task is no longer inprog - regression test for an orphaned-pending bug", () => {
    // A task's item requirement only ever appears while the task is
    // `inprog` - completing/failing/un-starting it never clears `pending`,
    // so without this the row would silently vanish while the count stayed
    // live (and correctly still counted in RaidCommitBar's total, which
    // reads `progress.pending` directly rather than this function).
    const progress = makeProgress({ pending: { "item-a": 3 } });
    const rows = getTrackedItems([], [makeItem({ id: "item-a" })], progress);
    expect(rows).toEqual([
      expect.objectContaining({
        id: "item-a",
        need: 0,
        pending: 3,
        source: "orphaned-pending",
      }),
    ]);
  });

  it("does not add an orphaned-pending row for a zero pending count", () => {
    const progress = makeProgress({ pending: { "item-a": 0 } });
    expect(getTrackedItems([], [makeItem({ id: "item-a" })], progress)).toEqual([]);
  });

  it("drops an orphaned-pending item id that doesn't resolve against the live catalog", () => {
    const progress = makeProgress({ pending: { "unknown-item": 2 } });
    expect(getTrackedItems([], [], progress)).toEqual([]);
  });

  it("does not duplicate a row when an item has both leftover pending and another inclusion reason (e.g. still pinned)", () => {
    const progress = makeProgress({ pending: { "item-a": 3 }, pinnedItemIds: ["item-a"] });
    const rows = getTrackedItems([], [makeItem({ id: "item-a" })], progress);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "pinned", pending: 3 });
  });

  it("marks a task-sourced item as pinned when its id is also in pinnedItemIds", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const progress = makeProgress({
      taskStatus: { [task.id]: { status: "inprog" } },
      pinnedItemIds: ["item-a"],
    });
    const rows = getTrackedItems([task], [], progress);
    expect(rows[0]).toMatchObject({ pinned: true, source: "task" });
  });

  it("marks isCustom true even when a custom item's real id merges into an existing task-sourced row", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 2, foundInRaid: false },
      ],
    });
    const progress = makeProgress({
      taskStatus: { [task.id]: { status: "inprog" } },
      customItems: [{ id: "item-a", name: "A", iconLink: null, need: 5 }],
    });
    const rows = getTrackedItems([task], [], progress);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "item-a", source: "task", isCustom: true, need: 5 });
  });

  it("sets isCustom false for a plain task/pinned row that was never custom-added", () => {
    const task = makeTask({
      itemRequirements: [
        { id: "item-a", name: "A", shortName: "A", iconLink: null, count: 1, foundInRaid: false },
      ],
    });
    const progress = makeProgress({ taskStatus: { [task.id]: { status: "inprog" } } });
    const rows = getTrackedItems([task], [], progress);
    expect(rows[0]).toMatchObject({ isCustom: false });
  });
});
