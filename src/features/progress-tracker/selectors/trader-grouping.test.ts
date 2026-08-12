import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import {
  getTraderOutlineColor,
  groupTasksByTrader,
  sortTraderNames,
  TRADER_OUTLINE_LEGEND,
} from "./trader-grouping";

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

function makeProgress(overrides: Partial<ProfileProgress> = {}): ProfileProgress {
  return { ...emptyProfileProgress("BEAR"), ...overrides };
}

describe("groupTasksByTrader", () => {
  it("groups tasks by trader.name", () => {
    const prapor = makeTask({
      id: "p1",
      trader: { id: "prapor-id", name: "Prapor", imageLink: null },
    });
    const skier = makeTask({
      id: "s1",
      trader: { id: "skier-id", name: "Skier", imageLink: null },
    });
    const groups = groupTasksByTrader([prapor, skier], makeProgress());
    expect(groups.get("Prapor")?.map((t) => t.id)).toEqual(["p1"]);
    expect(groups.get("Skier")?.map((t) => t.id)).toEqual(["s1"]);
  });

  it("sorts pinned tasks first within a trader group", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const progress = makeProgress({ pinnedTaskIds: ["b"] });
    const groups = groupTasksByTrader([a, b], progress);
    expect(groups.get("Prapor")?.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("sorts by status bucket order {inprog, notstarted, failed, done}", () => {
    const done = makeTask({ id: "done" });
    const inprog = makeTask({ id: "inprog" });
    const failed = makeTask({ id: "failed" });
    const notstarted = makeTask({ id: "notstarted" });
    const progress = makeProgress({
      taskStatus: {
        done: { status: "done" },
        inprog: { status: "inprog" },
        failed: { status: "failed" },
      },
    });
    const groups = groupTasksByTrader([done, inprog, failed, notstarted], progress);
    expect(groups.get("Prapor")?.map((t) => t.id)).toEqual([
      "inprog",
      "notstarted",
      "failed",
      "done",
    ]);
  });
});

describe("sortTraderNames", () => {
  it("sorts known traders into canonical roster order", () => {
    expect(sortTraderNames(["Fence", "Prapor", "Skier", "Therapist"])).toEqual([
      "Prapor",
      "Therapist",
      "Skier",
      "Fence",
    ]);
  });

  it("sinks unrecognized trader names after all known ones", () => {
    expect(sortTraderNames(["Unknown", "Prapor"])).toEqual(["Prapor", "Unknown"]);
  });

  it("tie-breaks two unrecognized names alphabetically", () => {
    expect(sortTraderNames(["Zeta Corp", "Alpha Traders"])).toEqual(["Alpha Traders", "Zeta Corp"]);
  });

  it("is case-insensitive when matching the canonical roster", () => {
    expect(sortTraderNames(["THERAPIST", "prapor"])).toEqual(["prapor", "THERAPIST"]);
  });
});

describe("getTraderOutlineColor", () => {
  it("returns a distinct color for a known trader, matching any casing", () => {
    expect(getTraderOutlineColor("Prapor")).toBe(getTraderOutlineColor("PRAPOR"));
    expect(getTraderOutlineColor("Prapor")).not.toBe(getTraderOutlineColor("Therapist"));
  });

  it("falls back to a neutral color for an unrecognized trader", () => {
    expect(getTraderOutlineColor("Some Modded Trader")).toBe("var(--color-border)");
  });
});

describe("TRADER_OUTLINE_LEGEND", () => {
  it("covers the full canonical roster, in roster order, matching getTraderOutlineColor", () => {
    expect(TRADER_OUTLINE_LEGEND.map((entry) => entry.name)).toEqual([
      "Prapor",
      "Therapist",
      "Skier",
      "Peacekeeper",
      "Mechanic",
      "Ragman",
      "Jaeger",
      "Fence",
      "Ref",
      "BTR Driver",
      "Lightkeeper",
    ]);
    for (const entry of TRADER_OUTLINE_LEGEND) {
      expect(entry.colorVar).toBe(getTraderOutlineColor(entry.name));
    }
  });
});
