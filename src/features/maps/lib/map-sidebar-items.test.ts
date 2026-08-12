import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "@/features/progress-tracker/types";

import { getMapTrackedItems } from "./map-sidebar-items";

import type { ProfileProgress } from "@/features/progress-tracker/types";
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

function findObjectiveItem(id: string, count: number) {
  return { id, name: id, shortName: id, iconLink: null, count, foundInRaid: false };
}

describe("getMapTrackedItems", () => {
  it("includes items from an inprog task relevant to the map", () => {
    const task = makeTask({
      id: "t1",
      maps: ["reserve"],
      itemRequirements: [findObjectiveItem("item-a", 2)],
    });
    const progress = makeProgress({ taskStatus: { t1: { status: "inprog" } } });
    const rows = getMapTrackedItems([task], [], progress, "reserve");
    expect(rows.map((r) => r.id)).toEqual(["item-a"]);
    expect(rows[0]?.need).toBe(2);
  });

  it("excludes items from an inprog task not relevant to the map", () => {
    const task = makeTask({
      id: "t1",
      maps: ["woods"],
      itemRequirements: [findObjectiveItem("item-a", 2)],
    });
    const progress = makeProgress({ taskStatus: { t1: { status: "inprog" } } });
    expect(getMapTrackedItems([task], [], progress, "reserve")).toEqual([]);
  });

  it("excludes items from a relevant but notstarted task", () => {
    const task = makeTask({
      id: "t1",
      maps: ["reserve"],
      itemRequirements: [findObjectiveItem("item-a", 2)],
    });
    expect(getMapTrackedItems([task], [], makeProgress(), "reserve")).toEqual([]);
  });

  it("includes items from an any-map inprog task on every map", () => {
    const task = makeTask({
      id: "t1",
      maps: [],
      itemRequirements: [findObjectiveItem("item-a", 1)],
    });
    const progress = makeProgress({ taskStatus: { t1: { status: "inprog" } } });
    expect(getMapTrackedItems([task], [], progress, "reserve").map((r) => r.id)).toEqual([
      "item-a",
    ]);
  });

  it("always includes custom items, regardless of map", () => {
    const progress = makeProgress({
      customItems: [{ id: "custom-1", name: "Custom", iconLink: null, need: 3 }],
    });
    const rows = getMapTrackedItems([], [], progress, "reserve");
    expect(rows.map((r) => r.id)).toEqual(["custom-1"]);
    expect(rows[0]?.source).toBe("custom");
  });

  it("drops the pinned-item fallback rows that getTrackedItems would otherwise add for every map", () => {
    const item = makeItem({ id: "pinned-item" });
    const progress = makeProgress({ pinnedItemIds: ["pinned-item"] });
    expect(getMapTrackedItems([], [item], progress, "reserve")).toEqual([]);
  });

  it("keeps a pinned flag true on a row that's also needed by a relevant inprog task", () => {
    const task = makeTask({
      id: "t1",
      maps: ["reserve"],
      itemRequirements: [findObjectiveItem("item-a", 2)],
    });
    const progress = makeProgress({
      taskStatus: { t1: { status: "inprog" } },
      pinnedItemIds: ["item-a"],
    });
    const rows = getMapTrackedItems([task], [], progress, "reserve");
    expect(rows).toEqual([expect.objectContaining({ id: "item-a", pinned: true, source: "task" })]);
  });
});
