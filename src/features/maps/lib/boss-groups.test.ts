import { describe, expect, it } from "vitest";

import { bossPillsFor, getBossStripData, isNightOnlyBoss } from "./boss-groups";

import type { RawMap, RawMapBoss } from "@/shared/lib/tarkov-api/types";

function boss(name: string, spawnChance: number): RawMapBoss {
  return { name, spawnChance, spawnLocations: [] };
}

function makeMap(overrides: Partial<RawMap> = {}): RawMap {
  return {
    name: "Test Map",
    normalizedName: "test-map",
    raidDuration: 45,
    players: "8-12",
    bosses: [],
    ...overrides,
  };
}

describe("isNightOnlyBoss", () => {
  it("matches cultists and any name containing 'night'", () => {
    expect(isNightOnlyBoss("Cultist Priest")).toBe(true);
    expect(isNightOnlyBoss("Night Tagilla")).toBe(true);
    expect(isNightOnlyBoss("Tagilla")).toBe(false);
    expect(isNightOnlyBoss("Reshala")).toBe(false);
  });
});

describe("bossPillsFor", () => {
  it("collapses Goons' 3 real entries into one pill using the highest chance", () => {
    const pills = bossPillsFor([
      boss("Knight", 0.35),
      boss("Big Pipe", 0.35),
      boss("Birdeye", 0.3),
    ]);
    expect(pills).toEqual([{ name: "Goons", chance: 0.35, count: 3, tone: "warm" }]);
  });

  it("keeps a solo boss (no matching group) as its own pill", () => {
    const pills = bossPillsFor([boss("Reshala", 0.15)]);
    expect(pills).toEqual([{ name: "Reshala", chance: 0.15, count: 1, tone: "cool" }]);
  });

  it("sorts pills by highest chance first", () => {
    const pills = bossPillsFor([boss("Reshala", 0.1), boss("Killa", 0.4), boss("Sanitar", 0.05)]);
    expect(pills.map((p) => p.name)).toEqual(["Killa", "Reshala", "Sanitar"]);
  });

  it("assigns tone thresholds correctly: hot >=50%, warm >=25%, cool >=10%, else mute", () => {
    const pills = bossPillsFor([boss("A", 0.5), boss("B", 0.25), boss("C", 0.1), boss("D", 0.05)]);
    expect(pills.map((p) => p.tone)).toEqual(["hot", "warm", "cool", "mute"]);
  });

  it("a Rogue variant name still collapses into the Rogues group", () => {
    const pills = bossPillsFor([boss("Rogue", 0.2), boss("Rogue Leader", 0.2)]);
    expect(pills).toEqual([{ name: "Rogues", chance: 0.2, count: 2, tone: "cool" }]);
  });

  it("matches Terminal Guards before the generic Guards fallback", () => {
    const pills = bossPillsFor([boss("Terminal Guard", 0.3)]);
    expect(pills[0]?.name).toBe("Terminal Guards");
  });

  it("returns an empty array for an empty boss list", () => {
    expect(bossPillsFor([])).toEqual([]);
  });

  it("treats a missing/zero spawnChance as 0", () => {
    const pills = bossPillsFor([boss("Reshala", 0)]);
    expect(pills[0]).toEqual({ name: "Reshala", chance: 0, count: 1, tone: "mute" });
  });
});

describe("getBossStripData", () => {
  it("uses Factory's real night-factory variant entry for the night side", () => {
    const maps = [
      makeMap({ normalizedName: "factory", bosses: [boss("Tagilla", 0.3)] }),
      makeMap({
        normalizedName: "night-factory",
        bosses: [boss("Tagilla", 0.3), boss("Cultist Priest", 0.5)],
      }),
    ];
    const result = getBossStripData("factory", maps);
    expect(result.day?.label).toBe("☀ Day");
    expect(result.day?.pills.map((p) => p.name)).toEqual(["Tagilla"]);
    expect(result.night?.label).toBe("☾ Night");
    // "Cultist Priest" matches the Cultists group pattern, collapsing to one pill.
    expect(result.night?.pills.map((p) => p.name).sort()).toEqual(["Cultists", "Tagilla"]);
  });

  it("Ground Zero's empty regular boss list produces a null day side, not an empty labeled one", () => {
    const maps = [
      makeMap({ normalizedName: "ground-zero", bosses: [] }),
      makeMap({ normalizedName: "ground-zero-21", bosses: [boss("Cultist Priest", 0.4)] }),
    ];
    const result = getBossStripData("ground-zero", maps);
    expect(result.day).toBeNull();
    expect(result.night?.label).toBe("★ Lvl 21+");
  });

  it("partitions night-only bosses client-side for a map with no distinct variant entry", () => {
    const maps = [
      makeMap({
        normalizedName: "reserve",
        bosses: [boss("Gluhar", 0.3), boss("Cultist Priest", 0.2)],
      }),
    ];
    const result = getBossStripData("reserve", maps);
    expect(result.day?.label).toBe("☀ Day");
    expect(result.day?.pills.map((p) => p.name)).toEqual(["Gluhar"]);
    expect(result.night?.label).toBe("☾ Night");
    expect(result.night?.pills.map((p) => p.name)).toEqual(["Cultists"]);
  });

  it("a map with only day bosses gets a single 'Bosses' side, no night side", () => {
    const maps = [makeMap({ normalizedName: "customs", bosses: [boss("Reshala", 0.3)] })];
    const result = getBossStripData("customs", maps);
    expect(result.day).toEqual({
      label: "Bosses",
      pills: [{ name: "Reshala", chance: 0.3, count: 1, tone: "warm" }],
    });
    expect(result.night).toBeNull();
  });

  it("a map with only night-only bosses gets a single night side, no day side", () => {
    const maps = [makeMap({ normalizedName: "shoreline", bosses: [boss("Cultist Priest", 0.2)] })];
    const result = getBossStripData("shoreline", maps);
    expect(result.day).toBeNull();
    expect(result.night?.pills.map((p) => p.name)).toEqual(["Cultists"]);
  });

  it("both sides are null for a map with no bosses at all", () => {
    const maps = [makeMap({ normalizedName: "woods", bosses: [] })];
    const result = getBossStripData("woods", maps);
    expect(result).toEqual({ day: null, night: null });
  });

  it("both sides are null when the map isn't found in the given list", () => {
    expect(getBossStripData("not-a-real-map", [])).toEqual({ day: null, night: null });
  });
});
