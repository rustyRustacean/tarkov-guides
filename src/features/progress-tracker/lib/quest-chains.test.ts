import { describe, expect, it } from "vitest";

import {
  aggregateChainStatus,
  detectQuestChains,
  getChainActiveTaskId,
  parseChainPartName,
} from "./quest-chains";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(overrides: Partial<NormalizedTask> & { id: string }): NormalizedTask {
  return {
    name: overrides.id,
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

function makeAvailability(
  status: QuestAvailability["status"],
  isAvailable = false,
): QuestAvailability {
  return {
    taskId: "unused",
    status,
    isAvailable,
    isLocked: status === "notstarted" && !isAvailable,
    unmetPrereqTaskIds: [],
    unmetTraderRequirements: [],
    delayedUnlock: null,
    factionMismatch: false,
    prestigeUnmet: false,
  };
}

describe("parseChainPartName", () => {
  it("parses a real chain-shaped name", () => {
    expect(parseChainPartName("Signal - Part 3")).toEqual({ baseName: "Signal", partNumber: 3 });
  });

  it("returns null for a name with no part suffix", () => {
    expect(parseChainPartName("Debut")).toBeNull();
  });

  it("returns null for a non-numeric or non-positive part number", () => {
    expect(parseChainPartName("Signal - Part Two")).toBeNull();
    expect(parseChainPartName("Signal - Part 0")).toBeNull();
    expect(parseChainPartName("Signal - Part -1")).toBeNull();
  });

  it("is case-sensitive on the literal ' - Part ' separator (real tarkov.dev names use this exact casing)", () => {
    expect(parseChainPartName("Signal - part 3")).toBeNull();
  });
});

describe("detectQuestChains", () => {
  it("detects a real linear chain (parts linked via taskRequirements in order)", () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ taskId: "signal-1", status: ["complete"] }],
    });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ taskId: "signal-2", status: ["complete"] }],
    });

    const chains = detectQuestChains([p1, p2, p3]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      baseName: "Signal",
      taskIds: ["signal-1", "signal-2", "signal-3"],
      partNumbers: [1, 2, 3],
      traderNames: ["Trader"],
      crossesTraders: false,
    });
    expect(chains[0]?.chainId).toBe("chain:signal-1");
  });

  it("reports the real 'Part N' numbers, not 1..N, when the chain's lowest part is excluded from the input - regression test for a mislabeling bug", () => {
    // Part 1 was never given to detectQuestChains (e.g. filtered out
    // upstream by a kappaOnly/showLocked view toggle), so this run
    // validly starts at real Part 2.
    const p2 = makeTask({ id: "signal-2", name: "Signal - Part 2" });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ taskId: "signal-2", status: ["complete"] }],
    });

    const chains = detectQuestChains([p2, p3]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.taskIds).toEqual(["signal-2", "signal-3"]);
    expect(chains[0]?.partNumbers).toEqual([2, 3]);
  });

  it("does NOT chain two same-name-pattern tasks that lack the real prerequisite link", () => {
    // Coincidental name collision ("Part 1"/"Part 2") but no taskRequirements
    // edge between them at all.
    const p1 = makeTask({ id: "a", name: "Foo - Part 1" });
    const p2 = makeTask({ id: "b", name: "Foo - Part 2" });
    expect(detectQuestChains([p1, p2])).toEqual([]);
  });

  it("truncates a chain broken mid-sequence rather than merging across the break", () => {
    // Part 3's sole same-base prerequisite is NOT part 2, so part 3 shouldn't
    // join the chain, and shouldn't merge anything incorrectly either.
    const p1 = makeTask({ id: "a1", name: "Foo - Part 1" });
    const p2 = makeTask({
      id: "a2",
      name: "Foo - Part 2",
      taskRequirements: [{ taskId: "a1", status: ["complete"] }],
    });
    const p3 = makeTask({ id: "a3", name: "Foo - Part 3" }); // no link to a2 at all

    const chains = detectQuestChains([p1, p2, p3]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.taskIds).toEqual(["a1", "a2"]);
  });

  it("drops candidates when two tasks claim the same part number (ambiguous)", () => {
    const p1 = makeTask({ id: "a1", name: "Foo - Part 1" });
    const p2a = makeTask({
      id: "a2a",
      name: "Foo - Part 2",
      taskRequirements: [{ taskId: "a1", status: ["complete"] }],
    });
    const p2b = makeTask({
      id: "a2b",
      name: "Foo - Part 2",
      taskRequirements: [{ taskId: "a1", status: ["complete"] }],
    });
    expect(detectQuestChains([p1, p2a, p2b])).toEqual([]);
  });

  it("does not treat a single matching task as a chain (run length < 2)", () => {
    const solo = makeTask({ id: "solo", name: "Solo - Part 1" });
    expect(detectQuestChains([solo])).toEqual([]);
  });

  it("detects a cross-trader chain (modeled on the real 'Colleagues' Peacekeeper->Prapor chain) and reports it via crossesTraders", () => {
    const p1 = makeTask({
      id: "colleagues-1",
      name: "Colleagues - Part 1",
      trader: { id: "peacekeeper", name: "Peacekeeper", imageLink: null },
    });
    const p2 = makeTask({
      id: "colleagues-2",
      name: "Colleagues - Part 2",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
      taskRequirements: [{ taskId: "colleagues-1", status: ["complete"] }],
    });

    const chains = detectQuestChains([p1, p2]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      taskIds: ["colleagues-1", "colleagues-2"],
      traderNames: ["Peacekeeper", "Prapor"],
      crossesTraders: true,
    });
  });

  it("hardcodes Gunsmith into one chain regardless of prerequisite linkage between its parts (uncommon real unlock structure for the first 3 parts)", () => {
    // Deliberately NOT linked via taskRequirements the way the generic
    // algorithm requires: part 2's only prerequisite is part 1's task id,
    // but part 3 has no taskRequirements link to part 2 at all, which would
    // ordinarily truncate the chain to just [part 1, part 2]. Gunsmith's
    // real in-game unlock structure doesn't follow the generic "part N-1"
    // rule, so this must still bundle all 3 (plus a 4th, normally-linked
    // part) into one chain via the HARDCODED_CHAIN_BASE_NAMES bypass.
    const p1 = makeTask({ id: "gunsmith-1", name: "Gunsmith - Part 1" });
    const p2 = makeTask({
      id: "gunsmith-2",
      name: "Gunsmith - Part 2",
      taskRequirements: [{ taskId: "gunsmith-1", status: ["complete"] }],
    });
    const p3 = makeTask({ id: "gunsmith-3", name: "Gunsmith - Part 3" }); // no link to part 2
    const p4 = makeTask({
      id: "gunsmith-4",
      name: "Gunsmith - Part 4",
      taskRequirements: [{ taskId: "gunsmith-3", status: ["complete"] }],
    });

    const chains = detectQuestChains([p1, p2, p3, p4]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      baseName: "Gunsmith",
      taskIds: ["gunsmith-1", "gunsmith-2", "gunsmith-3", "gunsmith-4"],
      partNumbers: [1, 2, 3, 4],
    });
  });

  it("ignores an out-of-scope prerequisite id when validating chain links (fail-open, matching quest-availability's convention)", () => {
    const p1 = makeTask({ id: "a1", name: "Foo - Part 1" });
    const p2 = makeTask({
      id: "a2",
      name: "Foo - Part 2",
      taskRequirements: [
        { taskId: "a1", status: ["complete"] },
        { taskId: "some-other-faction-task", status: ["complete"] },
      ],
    });
    const chains = detectQuestChains([p1, p2]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.taskIds).toEqual(["a1", "a2"]);
  });
});

describe("aggregateChainStatus", () => {
  const chain = detectQuestChains([
    makeTask({ id: "a1", name: "Foo - Part 1" }),
    makeTask({
      id: "a2",
      name: "Foo - Part 2",
      taskRequirements: [{ taskId: "a1", status: ["complete"] }],
    }),
  ])[0];
  if (!chain) throw new Error("expected a chain to be detected");

  it("is 'done' when every part is done", () => {
    const availability = new Map([
      ["a1", makeAvailability("done")],
      ["a2", makeAvailability("done")],
    ]);
    expect(aggregateChainStatus(chain, availability)).toBe("done");
  });

  it("is 'failed' when any part failed, even if others are done", () => {
    const availability = new Map([
      ["a1", makeAvailability("done")],
      ["a2", makeAvailability("failed")],
    ]);
    expect(aggregateChainStatus(chain, availability)).toBe("failed");
  });

  it("is 'inprog' when the first not-done part is in progress", () => {
    const availability = new Map([
      ["a1", makeAvailability("done")],
      ["a2", makeAvailability("inprog")],
    ]);
    expect(aggregateChainStatus(chain, availability)).toBe("inprog");
  });

  it("is 'available' when the first not-done part is available", () => {
    const availability = new Map([
      ["a1", makeAvailability("notstarted", true)],
      ["a2", makeAvailability("notstarted", false)],
    ]);
    expect(aggregateChainStatus(chain, availability)).toBe("available");
  });

  it("is 'locked' when the first not-done part is locked", () => {
    const availability = new Map([
      ["a1", makeAvailability("notstarted", false)],
      ["a2", makeAvailability("notstarted", false)],
    ]);
    expect(aggregateChainStatus(chain, availability)).toBe("locked");
  });

  it("is 'locked', not 'done', when no member is present in availability at all - regression test for a vacuous-truth bug", () => {
    // Array.prototype.every on an empty array is vacuously true, so without
    // an explicit empty-map guard this would have reported "done" for a
    // chain with zero data instead of falling back to "locked" the way
    // `nodeStatusKey` does for a standalone task with no data.
    expect(aggregateChainStatus(chain, new Map())).toBe("locked");
  });
});

describe("getChainActiveTaskId", () => {
  const chain = detectQuestChains([
    makeTask({ id: "a1", name: "Foo - Part 1" }),
    makeTask({
      id: "a2",
      name: "Foo - Part 2",
      taskRequirements: [{ taskId: "a1", status: ["complete"] }],
    }),
  ])[0];
  if (!chain) throw new Error("expected a chain to be detected");

  it("returns the first not-done part", () => {
    const availability = new Map([
      ["a1", makeAvailability("done")],
      ["a2", makeAvailability("notstarted", true)],
    ]);
    expect(getChainActiveTaskId(chain, availability)).toBe("a2");
  });

  it("returns the last part when every part is done", () => {
    const availability = new Map([
      ["a1", makeAvailability("done")],
      ["a2", makeAvailability("done")],
    ]);
    expect(getChainActiveTaskId(chain, availability)).toBe("a2");
  });
});
