import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOP_DOLLAR_THRESHOLD_RUB,
  getMapValuables,
  QUEST_SIGNATURE_MIN,
} from "./map-valuables";

import type { NormalizedItem, NormalizedTask } from "@/shared/lib/tarkov-api/types";

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
    types: ["barter"],
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

function itemReq(id: string) {
  return { id, name: id, shortName: id, iconLink: null, count: 1, foundInRaid: false };
}

describe("getMapValuables", () => {
  describe("mapSignature", () => {
    it("includes a barter item referenced by >= QUEST_SIGNATURE_MIN of the map's own tasks", () => {
      const item = makeItem({ id: "item-a", avg24hPrice: 1000 });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
        makeTask({ id: `t${String(i)}`, maps: ["reserve"], itemRequirements: [itemReq("item-a")] }),
      );
      const result = getMapValuables(tasks, [item], "reserve", 0);
      expect(result.mapSignature.map((v) => v.id)).toEqual(["item-a"]);
      expect(result.mapSignature[0]?.refs).toBe(QUEST_SIGNATURE_MIN);
    });

    it("excludes an item referenced fewer than QUEST_SIGNATURE_MIN times", () => {
      const item = makeItem({ id: "item-a" });
      const tasks = [
        makeTask({ id: "t0", maps: ["reserve"], itemRequirements: [itemReq("item-a")] }),
      ];
      const result = getMapValuables(tasks, [item], "reserve", 0);
      expect(result.mapSignature).toEqual([]);
    });

    it("does not count an any-map task's item requirements toward any map's signature", () => {
      const item = makeItem({ id: "item-a" });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
        makeTask({ id: `t${String(i)}`, maps: [], itemRequirements: [itemReq("item-a")] }),
      );
      const result = getMapValuables(tasks, [item], "reserve", 0);
      expect(result.mapSignature).toEqual([]);
    });

    it("excludes a non-barter item even with enough references", () => {
      const item = makeItem({ id: "item-a", types: ["ammo"] });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
        makeTask({ id: `t${String(i)}`, maps: ["reserve"], itemRequirements: [itemReq("item-a")] }),
      );
      const result = getMapValuables(tasks, [item], "reserve", 0);
      expect(result.mapSignature).toEqual([]);
    });

    it("excludes a dogtag even though it carries the barter type", () => {
      const item = makeItem({ id: "item-a", name: "Dogtag Killa", types: ["barter"] });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
        makeTask({ id: `t${String(i)}`, maps: ["reserve"], itemRequirements: [itemReq("item-a")] }),
      );
      const result = getMapValuables(tasks, [item], "reserve", 0);
      expect(result.mapSignature).toEqual([]);
    });

    it("sorts by avg24hPrice descending", () => {
      const cheap = makeItem({ id: "cheap", avg24hPrice: 100 });
      const expensive = makeItem({ id: "expensive", avg24hPrice: 9000 });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) => [
        makeTask({ id: `c${String(i)}`, maps: ["reserve"], itemRequirements: [itemReq("cheap")] }),
        makeTask({
          id: `e${String(i)}`,
          maps: ["reserve"],
          itemRequirements: [itemReq("expensive")],
        }),
      ]).flat();
      const result = getMapValuables(tasks, [cheap, expensive], "reserve", 0);
      expect(result.mapSignature.map((v) => v.id)).toEqual(["expensive", "cheap"]);
    });
  });

  describe("topDollar", () => {
    it("includes a barter item at or above the threshold", () => {
      const item = makeItem({ id: "item-a", avg24hPrice: 50_000 });
      const result = getMapValuables([], [item], "reserve", 45_000);
      expect(result.topDollar.map((v) => v.id)).toEqual(["item-a"]);
    });

    it("excludes an item below the threshold", () => {
      const item = makeItem({ id: "item-a", avg24hPrice: 10_000 });
      const result = getMapValuables([], [item], "reserve", 45_000);
      expect(result.topDollar).toEqual([]);
    });

    it("treats a null avg24hPrice as 0", () => {
      const item = makeItem({ id: "item-a", avg24hPrice: null });
      const result = getMapValuables([], [item], "reserve", 1);
      expect(result.topDollar).toEqual([]);
    });

    it("excludes a non-barter item, a quest tool, and a dogtag even above the threshold", () => {
      const ammo = makeItem({ id: "ammo-1", types: ["ammo"], avg24hPrice: 100_000 });
      const questTool = makeItem({
        id: "qt-1",
        name: "MS2000 Marker",
        types: ["barter"],
        avg24hPrice: 100_000,
      });
      const dogtag = makeItem({
        id: "dt-1",
        name: "Dogtag Killa",
        types: ["barter"],
        avg24hPrice: 100_000,
      });
      const result = getMapValuables([], [ammo, questTool, dogtag], "reserve", 45_000);
      expect(result.topDollar).toEqual([]);
    });

    it("excludes an item already surfaced in mapSignature", () => {
      const item = makeItem({ id: "item-a", avg24hPrice: 50_000 });
      const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
        makeTask({ id: `t${String(i)}`, maps: ["reserve"], itemRequirements: [itemReq("item-a")] }),
      );
      const result = getMapValuables(tasks, [item], "reserve", 45_000);
      expect(result.mapSignature.map((v) => v.id)).toEqual(["item-a"]);
      expect(result.topDollar).toEqual([]);
    });

    it("sorts by avg24hPrice descending", () => {
      const cheap = makeItem({ id: "cheap", avg24hPrice: 50_000 });
      const expensive = makeItem({ id: "expensive", avg24hPrice: 200_000 });
      const result = getMapValuables([], [cheap, expensive], "reserve", 45_000);
      expect(result.topDollar.map((v) => v.id)).toEqual(["expensive", "cheap"]);
    });
  });

  it("resolves a real curated location hint via ITEM_LOCATIONS for a known item/map pair", () => {
    const item = makeItem({
      id: "ledx-1",
      shortName: "LEDX",
      name: "LEDX Skin Transilluminator",
      avg24hPrice: 100_000,
    });
    const result = getMapValuables([], [item], "customs", 45_000);
    expect(result.topDollar[0]?.locationHint).toEqual(expect.any(String));
  });

  it("reports a null location hint for an item with no curated entry", () => {
    const item = makeItem({
      id: "unknown-1",
      shortName: "totally-fake-item-xyz",
      name: "Totally Fake Item Xyz",
      avg24hPrice: 100_000,
    });
    const result = getMapValuables([], [item], "customs", 45_000);
    expect(result.topDollar[0]?.locationHint).toBeNull();
  });

  it("DEFAULT_TOP_DOLLAR_THRESHOLD_RUB matches legacy's default", () => {
    expect(DEFAULT_TOP_DOLLAR_THRESHOLD_RUB).toBe(45_000);
  });
});
