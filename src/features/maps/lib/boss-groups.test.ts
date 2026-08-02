import { describe, expect, it } from "vitest";

import { bossPillsFor, getBossStripData, isNightOnlyBoss } from "./boss-groups";

import type { RawMap, RawMapBoss } from "@/shared/lib/tarkov-api/types";

function boss(
  name: string,
  spawnChance: number,
  imagePortraitLink: string | null = null,
): RawMapBoss {
  return {
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink,
    spawnChance,
  };
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
  it("collapses a faction's many entries into one pill (presence only, no count)", () => {
    const pills = bossPillsFor([
      boss("Rogue", 0.35),
      boss("Rogue Leader", 0.3),
      boss("Rogue", 0.3),
    ]);
    expect(pills).toEqual([
      { name: "Rogues", chance: 0.35, tone: "warm", imagePortraitLink: null },
    ]);
  });

  it("keeps a solo boss (no matching group) as its own pill", () => {
    const pills = bossPillsFor([boss("Reshala", 0.15)]);
    expect(pills).toEqual([
      { name: "Reshala", chance: 0.15, tone: "cool", imagePortraitLink: null },
    ]);
  });

  it("does NOT group the Goons - Knight shows under his own name", () => {
    // The API lists only Knight; Big Pipe / Birdeye are added per-map in
    // getBossStripData, not collapsed into a "Goons" pill here.
    const pills = bossPillsFor([boss("Knight", 0.2)]);
    expect(pills).toEqual([{ name: "Knight", chance: 0.2, tone: "cool", imagePortraitLink: null }]);
    expect(pills.map((p) => p.name)).not.toContain("Goons");
  });

  it("carries a solo boss's portrait onto its pill", () => {
    const pills = bossPillsFor([
      boss("Killa", 0.4, "https://assets.tarkov.dev/killa-portrait.png"),
    ]);
    expect(pills[0]?.imagePortraitLink).toBe("https://assets.tarkov.dev/killa-portrait.png");
  });

  it("a grouped pill wears its highest-chance member's portrait", () => {
    const pills = bossPillsFor([
      boss("Rogue", 0.2, "https://assets.tarkov.dev/rogue.png"),
      boss("Rogue Leader", 0.35, "https://assets.tarkov.dev/rogue-leader.png"),
    ]);
    expect(pills).toHaveLength(1);
    expect(pills[0]?.name).toBe("Rogues");
    expect(pills[0]?.imagePortraitLink).toBe("https://assets.tarkov.dev/rogue-leader.png");
  });

  it("sorts pills by highest chance first", () => {
    const pills = bossPillsFor([boss("Reshala", 0.1), boss("Killa", 0.4), boss("Sanitar", 0.05)]);
    expect(pills.map((p) => p.name)).toEqual(["Killa", "Reshala", "Sanitar"]);
  });

  it("assigns tone thresholds correctly: hot >=50%, warm >=25%, cool >=10%, else mute", () => {
    const pills = bossPillsFor([boss("A", 0.5), boss("B", 0.25), boss("C", 0.1), boss("D", 0.05)]);
    expect(pills.map((p) => p.tone)).toEqual(["hot", "warm", "cool", "mute"]);
  });

  it("matches Terminal Guards before the generic Guards fallback", () => {
    const pills = bossPillsFor([boss("Terminal Guard", 0.3)]);
    expect(pills[0]?.name).toBe("Terminal Guards");
  });

  it("collapses a repeated unique boss into one pill (The Wedge x12 spawn points = one boss)", () => {
    const wedges = Array.from({ length: 12 }, () => boss("The Wedge", 0.25));
    const pills = bossPillsFor(wedges);
    // 12 API entries are 12 spawn points for the same single boss - one pill,
    // presence only.
    expect(pills).toEqual([
      { name: "The Wedge", chance: 0.25, tone: "warm", imagePortraitLink: null },
    ]);
  });

  it("returns an empty array for an empty boss list", () => {
    expect(bossPillsFor([])).toEqual([]);
  });

  it("treats a missing/zero spawnChance as 0", () => {
    const pills = bossPillsFor([boss("Reshala", 0)]);
    expect(pills[0]).toEqual({
      name: "Reshala",
      chance: 0,
      tone: "mute",
      imagePortraitLink: null,
    });
  });
});

describe("getBossStripData", () => {
  it("merges Factory's night-factory variant into one strip, badging its exclusive bosses", () => {
    const maps = [
      makeMap({ normalizedName: "factory", bosses: [boss("Tagilla", 0.3)] }),
      makeMap({
        normalizedName: "night-factory",
        bosses: [boss("Tagilla", 0.3), boss("Cultist Priest", 0.5)],
      }),
    ];
    const { pills } = getBossStripData("factory", maps);
    const tagilla = pills.find((p) => p.name === "Tagilla");
    const cultists = pills.find((p) => p.name === "Cultists");
    expect(tagilla?.badge).toBeUndefined();
    expect(cultists?.badge).toEqual({ icon: "☾", title: "Night" });
    expect(pills).toHaveLength(2);
  });

  it("badges Ground Zero's level-gated variant bosses with its own icon", () => {
    const maps = [
      makeMap({ normalizedName: "ground-zero", bosses: [] }),
      makeMap({ normalizedName: "ground-zero-21", bosses: [boss("Cultist Priest", 0.4)] }),
    ];
    const { pills } = getBossStripData("ground-zero", maps);
    expect(pills.map((p) => p.name)).toEqual(["Cultists"]);
    expect(pills[0]?.badge).toEqual({ icon: "★", title: "Lvl 21+" });
  });

  it("badges night-only bosses (cultists) with a moon, others left plain", () => {
    const maps = [
      makeMap({
        normalizedName: "reserve",
        bosses: [boss("Gluhar", 0.3), boss("Cultist Priest", 0.2)],
      }),
    ];
    const { pills } = getBossStripData("reserve", maps);
    expect(pills.map((p) => p.name)).toEqual(["Gluhar", "Cultists"]);
    expect(pills.find((p) => p.name === "Gluhar")?.badge).toBeUndefined();
    expect(pills.find((p) => p.name === "Cultists")?.badge).toEqual({
      icon: "☾",
      title: "night only",
    });
  });

  it("shows a plain (unbadged) pill for a map with a single boss", () => {
    const maps = [makeMap({ normalizedName: "the-lab", bosses: [boss("Sanitar", 0.3)] })];
    const { pills } = getBossStripData("the-lab", maps);
    expect(pills).toEqual([
      { name: "Sanitar", chance: 0.3, tone: "warm", imagePortraitLink: null },
    ]);
  });

  it("adds Big Pipe + Birdeye (with portraits) to a roaming-Goons map where Knight is present", () => {
    const maps = [makeMap({ normalizedName: "customs", bosses: [boss("Knight", 0.35)] })];
    const { pills } = getBossStripData("customs", maps);
    const names = pills.map((p) => p.name);
    expect(names).toContain("Knight");
    expect(names).toContain("Big Pipe");
    expect(names).toContain("Birdeye");
    expect(names).not.toContain("Goons");
    expect(pills.find((p) => p.name === "Big Pipe")?.imagePortraitLink).toBe(
      "https://assets.tarkov.dev/big-pipe-portrait.png",
    );
    expect(pills.find((p) => p.name === "Birdeye")?.imagePortraitLink).toBe(
      "https://assets.tarkov.dev/birdeye-portrait.png",
    );
  });

  it("Ice Breaker: lone Knight (not Goons, no Big Pipe/Birdeye), Rogues, Black Division, one Wedge", () => {
    // Mirrors the live json.tarkov.dev roster: only Knight of the squad, 6
    // Rogue entries, two Black Division bot types, and The Wedge listed once
    // per spawn point (x12).
    const maps = [
      makeMap({
        normalizedName: "icebreaker",
        bosses: [
          boss("Knight", 0.5),
          ...Array.from({ length: 6 }, () => boss("Rogue", 0.3)),
          ...Array.from({ length: 11 }, () => boss("Black Div. Boss", 0.4)),
          ...Array.from({ length: 10 }, () => boss("Black Div. Raider", 0.4)),
          ...Array.from({ length: 12 }, () => boss("The Wedge", 0.2)),
        ],
      }),
    ];
    const names = getBossStripData("icebreaker", maps).pills.map((p) => p.name);
    expect(names).toContain("Knight");
    expect(names).not.toContain("Goons");
    // Ice Breaker is not a roaming-Goons map - the squad is NOT added.
    expect(names).not.toContain("Big Pipe");
    expect(names).not.toContain("Birdeye");
    expect(names).toContain("Rogues");
    expect(names).toContain("Black Division");
    expect(names.filter((n) => n === "The Wedge")).toHaveLength(1);
  });

  it("returns no pills for a map with no bosses at all", () => {
    const maps = [makeMap({ normalizedName: "woods", bosses: [] })];
    expect(getBossStripData("woods", maps)).toEqual({ pills: [] });
  });

  it("returns no pills when the map isn't found in the given list", () => {
    expect(getBossStripData("not-a-real-map", [])).toEqual({ pills: [] });
  });
});
