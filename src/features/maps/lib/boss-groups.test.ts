import { describe, expect, it } from "vitest";

import { bossPillsFor, getBossStripData, groundZeroQueueFor, isNightOnlyBoss } from "./boss-groups";

import type { RawMap, RawMapBoss, RawMapBossEscort } from "@/shared/lib/tarkov-api/types";

function boss(
  name: string,
  spawnChance: number,
  imagePortraitLink: string | null = null,
  mobId = `mob-${name.toLowerCase().replace(/\s+/g, "-")}`,
): RawMapBoss {
  return {
    mobId,
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink,
    spawnChance,
    escorts: [],
  };
}

function makeMap(overrides: Partial<RawMap> = {}): RawMap {
  return {
    name: "Test Map",
    normalizedName: "test-map",
    nameId: null,
    raidDuration: 45,
    players: "8-12",
    bosses: [],
    ...overrides,
  };
}

describe("groundZeroQueueFor", () => {
  it("puts level 21 and up in the high queue, everyone else (or unknown) in the low one", () => {
    expect(groundZeroQueueFor(undefined)).toBe("low");
    expect(groundZeroQueueFor(1)).toBe("low");
    expect(groundZeroQueueFor(20)).toBe("low");
    expect(groundZeroQueueFor(21)).toBe("high");
    expect(groundZeroQueueFor(64)).toBe("high");
  });
});

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
    expect(pills).toMatchObject([
      {
        name: "Rogues",
        chance: 0.35,
        tone: "warm",
        imagePortraitLink: null,
        mobIds: ["mob-rogue", "mob-rogue-leader"],
        guards: [],
        groupSize: null,
      },
    ]);
  });

  it("lists a grouped pill's distinct mob ids, highest-chance member first", () => {
    const pills = bossPillsFor([
      boss("Black Div.", 0.2, null, "blackDivision"),
      boss("Black Div.", 0.4, null, "bossBullyBlackDiv"),
      boss("Black Div.", 0.2, null, "blackDivision"),
    ]);
    expect(pills[0]?.mobIds).toEqual(["bossBullyBlackDiv", "blackDivision"]);
  });

  it("keeps a solo boss (no matching group) as its own pill", () => {
    const pills = bossPillsFor([boss("Reshala", 0.15)]);
    expect(pills).toMatchObject([
      {
        name: "Reshala",
        chance: 0.15,
        tone: "cool",
        imagePortraitLink: null,
        mobIds: ["mob-reshala"],
        guards: [],
        groupSize: null,
      },
    ]);
  });

  it("does NOT group the Goons - Knight shows under his own name", () => {
    // The API lists only Knight; Big Pipe / Birdeye are added per-map in
    // getBossStripData, not collapsed into a "Goons" pill here.
    const pills = bossPillsFor([boss("Knight", 0.2)]);
    expect(pills).toMatchObject([
      {
        name: "Knight",
        chance: 0.2,
        tone: "cool",
        imagePortraitLink: null,
        mobIds: ["mob-knight"],
        guards: [],
        groupSize: null,
      },
    ]);
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
    // 12 API entries are 12 spawn points for the same single boss, one
    // pill, presence only.
    expect(pills).toMatchObject([
      {
        name: "The Wedge",
        chance: 0.25,
        tone: "warm",
        imagePortraitLink: null,
        mobIds: ["mob-the-wedge"],
        guards: [],
        groupSize: null,
      },
    ]);
  });

  it("returns an empty array for an empty boss list", () => {
    expect(bossPillsFor([])).toEqual([]);
  });

  it("treats a missing/zero spawnChance as 0", () => {
    const pills = bossPillsFor([boss("Reshala", 0)]);
    expect(pills[0]).toMatchObject({
      name: "Reshala",
      chance: 0,
      tone: "mute",
      imagePortraitLink: null,
      mobIds: ["mob-reshala"],
      guards: [],
      groupSize: null,
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

  it("reads one Ground Zero queue at a time instead of merging the 21+ entry in", () => {
    const maps = [
      makeMap({ normalizedName: "ground-zero", bosses: [boss("Killa", 0.1)] }),
      makeMap({
        normalizedName: "ground-zero-21",
        bosses: [boss("Killa", 0.3), boss("Cultist Priest", 0.4)],
      }),
    ];
    const low = getBossStripData("ground-zero", maps);
    expect(low.pills.map((p) => [p.name, p.chance])).toEqual([["Killa", 0.1]]);

    const high = getBossStripData("ground-zero", maps, { rosterEntry: "ground-zero-21" });
    expect(high.pills.map((p) => [p.name, p.chance])).toEqual([
      ["Killa", 0.3],
      ["Cultists", 0.4],
    ]);
  });

  it("reads the roster for the active game mode", () => {
    const blackDiv = boss("Black Div.", 0.38, null, "pmcBotBlackDivSeason");
    const maps = [
      makeMap({
        normalizedName: "woods",
        bosses: [boss("Shturman", 0.57)],
        bossesPve: [boss("Shturman", 0.71), boss("USEC", 0.94), boss("BEAR", 0.94)],
        bossesSeason: [boss("Shturman", 0.57), blackDiv],
      }),
    ];
    const names = (mode: "PVP" | "PVE" | "PVP_SEASONAL") =>
      getBossStripData("woods", maps, { mode }).pills.map((p) => p.name);

    expect(names("PVP")).toEqual(["Shturman"]);
    // PvE's AI PMCs stay two separate pills.
    expect(names("PVE")).toEqual(["USEC", "BEAR", "Shturman"]);
    expect(names("PVP_SEASONAL")).toEqual(["Shturman", "Black Division"]);
  });

  it("falls back to the regular roster when a mode's list is missing", () => {
    const maps = [makeMap({ normalizedName: "woods", bosses: [boss("Shturman", 0.57)] })];
    expect(
      getBossStripData("woods", maps, { mode: "PVP_SEASONAL" }).pills.map((p) => p.name),
    ).toEqual(["Shturman"]);
  });

  it("names the untranslated event zombies and badges every event mob, last", () => {
    const maps = [
      makeMap({
        normalizedName: "factory",
        bosses: [
          boss("infectedScreamer", 0.94, null, "infectedScreamer"),
          boss("infectedScreamer", 0.94, null, "infectedScreamer"),
          boss("Infected Tagilla", 0.03, null, "infectedTagilla"),
          boss("Tagilla", 0.3),
        ],
      }),
    ];
    const { pills } = getBossStripData("factory", maps);
    expect(pills.map((p) => p.name)).toEqual(["Tagilla", "Infected", "Infected Tagilla"]);
    expect(pills.find((p) => p.name === "Tagilla")?.badge).toBeUndefined();
    for (const name of ["Infected", "Infected Tagilla"]) {
      expect(pills.find((p) => p.name === name)?.badge).toEqual({
        icon: "🎃",
        title: "Halloween event",
      });
    }
  });

  it("notes Partisan's karma dependence in PvP and Seasonal only", () => {
    const maps = [
      makeMap({ normalizedName: "customs", bosses: [boss("Partisan", 0, null, "bossPartisan")] }),
    ];
    const note = (mode: "PVP" | "PVE" | "PVP_SEASONAL") =>
      getBossStripData("customs", maps, { mode }).pills[0]?.note;
    expect(note("PVP")).toBe("higher with low-karma PMCs in the raid");
    expect(note("PVP_SEASONAL")).toBe("higher with low-karma PMCs in the raid");
    expect(note("PVE")).toBeUndefined();
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
    expect(pills).toMatchObject([
      {
        name: "Sanitar",
        chance: 0.3,
        tone: "warm",
        imagePortraitLink: null,
        mobIds: ["mob-sanitar"],
        guards: [],
        groupSize: null,
      },
    ]);
    expect(pills[0]).not.toHaveProperty("badge");
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
    // Their real tarkov.dev mob ids, so their gear and loot card resolves.
    expect(pills.find((p) => p.name === "Big Pipe")?.mobIds).toEqual(["followerBigPipe"]);
    expect(pills.find((p) => p.name === "Birdeye")?.mobIds).toEqual(["followerBirdEye"]);
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
    // Ice Breaker is not a roaming-Goons map: the squad is NOT added.
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

function escort(
  mobId: string,
  name: string,
  amounts: RawMapBossEscort["amounts"],
  imagePortraitLink: string | null = null,
): RawMapBossEscort {
  return { mobId, name, imagePortraitLink, amounts };
}

function escorted(base: RawMapBoss, ...escorts: readonly RawMapBossEscort[]): RawMapBoss {
  return { ...base, escorts };
}

describe("guards and group size", () => {
  it("lists a boss's guards with their portrait and squad size", () => {
    const reshala = escorted(
      boss("Reshala", 0.35, null, "bossBully"),
      escort(
        "followerBully",
        "Reshala Guard",
        [
          { count: 2, chance: 0.25 },
          { count: 3, chance: 0.25 },
          { count: 4, chance: 0.5 },
        ],
        "https://assets.tarkov.dev/reshala-guard-portrait.png",
      ),
    );
    const [pill] = bossPillsFor([reshala]);
    expect(pill?.guards).toEqual([
      {
        mobId: "followerBully",
        name: "Reshala Guard",
        imagePortraitLink: "https://assets.tarkov.dev/reshala-guard-portrait.png",
        amounts: [
          { count: 2, chance: 0.25 },
          { count: 3, chance: 0.25 },
          { count: 4, chance: 0.5 },
        ],
      },
    ]);
    expect(pill?.groupSize).toBeNull();
  });

  it("keeps several guard types in upstream's order", () => {
    const glukhar = escorted(
      boss("Glukhar", 0.3, null, "bossGluhar"),
      escort("followerGluharAssault", "Glukhar Guard (Assault)", [{ count: 1, chance: 1 }]),
      escort("followerGluharSecurity", "Glukhar Guard (Security)", [{ count: 1, chance: 1 }]),
      escort("followerGluharScout", "Glukhar Guard (Scout)", [{ count: 1, chance: 1 }]),
    );
    const [pill] = bossPillsFor([glukhar]);
    expect(pill?.guards.map((guard) => guard.mobId)).toEqual([
      "followerGluharAssault",
      "followerGluharSecurity",
      "followerGluharScout",
    ]);
  });

  it("adds up a guard listed more than once on the same spawn", () => {
    const boar = escorted(
      boss("Kaban", 0.6, null, "bossBoar"),
      escort("bossBoarSniper", "Kaban Guard (Sniper)", [
        { count: 1, chance: 0.5 },
        { count: 2, chance: 0.5 },
      ]),
      escort("bossBoarSniper", "Kaban Guard (Sniper)", [{ count: 1, chance: 1 }]),
    );
    const [pill] = bossPillsFor([boar]);
    expect(pill?.guards).toHaveLength(1);
    expect(pill?.guards[0]?.amounts).toEqual([
      { count: 2, chance: 0.5 },
      { count: 3, chance: 0.5 },
    ]);
  });

  it("averages a guard's squad size over the spawns that bring it", () => {
    const guard = (count: number) =>
      escorted(
        boss("Black Div. Boss", 0.4, null, "bossBullyBlackDiv"),
        escort("followerBullyBlackDiv", "Black Div. Guard", [{ count, chance: 1 }]),
      );
    const [pill] = bossPillsFor([guard(2), guard(4), guard(4), guard(4)]);
    expect(pill?.guards[0]?.amounts).toEqual([
      { count: 2, chance: 0.25 },
      { count: 4, chance: 0.75 },
    ]);
  });

  it("turns a faction escorting its own kind into a group size, leader included", () => {
    const raiders = escorted(
      boss("Raider", 0.4, null, "PmcBot"),
      escort("PmcBot", "Raider", [
        { count: 2, chance: 0.8 },
        { count: 3, chance: 0.2 },
      ]),
    );
    const [pill] = bossPillsFor([raiders, raiders]);
    expect(pill?.name).toBe("Raiders");
    expect(pill?.guards).toEqual([]);
    expect(pill?.groupSize).toEqual([
      { count: 3, chance: 0.8 },
      { count: 4, chance: 0.2 },
    ]);
  });

  it("adds up a faction's own kind listed several times on one spawn, and averages across spawns", () => {
    const one = escort("blackDivision", "Black Div.", [{ count: 1, chance: 1 }]);
    const pair = escorted(boss("Black Div.", 0.4, null, "blackDivision"), one, one);
    const trio = escorted(boss("Black Div.", 0.4, null, "blackDivision"), one, one, one);
    const [pill] = bossPillsFor([pair, trio, trio, trio]);
    expect(pill?.groupSize).toEqual([
      { count: 3, chance: 0.25 },
      { count: 4, chance: 0.75 },
    ]);
  });

  it("drops a named boss listing itself as its own escort", () => {
    const wedge = escorted(
      boss("The Wedge", 0.2, null, "bossWedge"),
      escort("bossWedge", "The Wedge", [{ count: 1, chance: 1 }]),
    );
    const [pill] = bossPillsFor([wedge]);
    expect(pill?.guards).toEqual([]);
    expect(pill?.groupSize).toBeNull();
  });

  it("skips an escort with no squad size data", () => {
    const sanitar = escorted(
      boss("Sanitar", 0.3, null, "bossSanitar"),
      escort("followerSanitar", "Sanitar Guard", []),
    );
    expect(bossPillsFor([sanitar])[0]?.guards).toEqual([]);
  });

  it("never shows the Goons as Knight's guards, but keeps Ice Breaker Knight's Rogues", () => {
    const goons = escorted(
      boss("Knight", 0.35, null, "bossKnight"),
      escort("followerBigPipe", "Big Pipe", [{ count: 1, chance: 1 }]),
      escort("followerBirdEye", "Birdeye", [{ count: 1, chance: 1 }]),
    );
    const customs = getBossStripData("customs", [
      makeMap({ normalizedName: "customs", bosses: [goons] }),
    ]).pills;
    expect(customs.find((p) => p.name === "Knight")?.guards).toEqual([]);
    expect(customs.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Knight", "Big Pipe", "Birdeye"]),
    );

    const icebreakerKnight = escorted(
      boss("Knight", 0.5, null, "bossKnight"),
      escort("ExUsec", "Rogue", [{ count: 2, chance: 1 }]),
    );
    const icebreaker = getBossStripData("icebreaker", [
      makeMap({ normalizedName: "icebreaker", bosses: [icebreakerKnight] }),
    ]).pills;
    expect(icebreaker.find((p) => p.name === "Knight")?.guards.map((g) => g.name)).toEqual([
      "Rogue",
    ]);
  });

  it("takes a variant map's bosses' guards from the variant's own entry", () => {
    const priest = escorted(
      boss("Cultist Priest", 0.5, null, "sectantPriest"),
      escort("sectantWarrior", "Cultist Warrior", [
        { count: 2, chance: 0.5 },
        { count: 3, chance: 0.5 },
      ]),
    );
    const { pills } = getBossStripData("factory", [
      makeMap({ normalizedName: "factory", bosses: [boss("Tagilla", 0.3)] }),
      makeMap({ normalizedName: "night-factory", bosses: [boss("Tagilla", 0.3), priest] }),
    ]);
    const cultists = pills.find((p) => p.name === "Cultists");
    expect(cultists?.guards.map((g) => g.name)).toEqual(["Cultist Warrior"]);
    expect(cultists?.guards[0]?.amounts).toEqual([
      { count: 2, chance: 0.5 },
      { count: 3, chance: 0.5 },
    ]);
  });
});

describe("pill spawns (where and when)", () => {
  const stronghold = { key: "ZoneScavBase", name: "Stronghold", chance: 0.33 };
  const dorms = { key: "ZoneDormitory", name: "Dorms", chance: 0.33 };
  const strongholdSpots = [
    { x: 1, z: 2 },
    { x: 3, z: 4 },
  ];

  it("carries one spawn per upstream entry, its zones resolved to the map's spots", () => {
    const reshala: RawMapBoss = {
      ...boss("Reshala", 0.57),
      spawnZones: [dorms, stronghold],
      spawnTiming: { kind: "start" },
    };
    const { pills } = getBossStripData("customs", [
      makeMap({
        normalizedName: "customs",
        bosses: [reshala],
        bossSpawnSpots: { ZoneScavBase: strongholdSpots },
      }),
    ]);
    expect(pills[0]?.spawns).toEqual([
      {
        chance: 0.57,
        zones: [
          { ...dorms, spots: [] },
          { ...stronghold, spots: strongholdSpots },
        ],
        timing: { kind: "start" },
        trigger: null,
        groupSize: null,
      },
    ]);
  });

  it("gives a boss with no spawn data empty zones and no timing or trigger", () => {
    expect(bossPillsFor([boss("Killa", 0.3)])[0]?.spawns).toEqual([
      { chance: 0.3, zones: [], timing: null, trigger: null, groupSize: null },
    ]);
  });

  it("keeps every entry of a faction as its own spawn, each with its group size", () => {
    const raider = (seconds: number, size: number): RawMapBoss => ({
      ...escorted(
        boss("Raider", 0.6, null, "pmcBot"),
        escort("pmcBot", "Raider", [{ count: size, chance: 1 }]),
      ),
      spawnTiming: { kind: "timed", seconds },
    });
    const pill = bossPillsFor([raider(300, 2), raider(900, 1)])[0];
    expect(pill?.name).toBe("Raiders");
    expect(pill?.spawns.map((spawn) => [spawn.timing, spawn.groupSize])).toEqual([
      [{ kind: "timed", seconds: 300 }, [{ count: 3, chance: 1 }]],
      [{ kind: "timed", seconds: 900 }, [{ count: 2, chance: 1 }]],
    ]);
  });

  it("carries a switch trigger onto the spawn", () => {
    const raider: RawMapBoss = {
      ...boss("Raider", 0.29, null, "pmcBot"),
      spawnTrigger: { switchName: "D-2 Power Switch" },
      spawnTiming: { kind: "start" },
    };
    expect(bossPillsFor([raider])[0]?.spawns[0]?.trigger).toEqual({
      switchName: "D-2 Power Switch",
    });
  });

  it("resolves a Ground Zero queue's zones against that queue's own entry", () => {
    const priest: RawMapBoss = {
      ...boss("Cultist Priest", 0.2, null, "sectantPriest"),
      spawnZones: [{ key: "BotZone", name: "Any scav spawn", chance: 1 }],
    };
    const { pills } = getBossStripData(
      "ground-zero",
      [
        makeMap({ normalizedName: "ground-zero", bosses: [] }),
        makeMap({
          normalizedName: "ground-zero-21",
          bosses: [priest],
          bossSpawnSpots: { BotZone: [{ x: 5, z: 6 }] },
        }),
      ],
      { rosterEntry: "ground-zero-21" },
    );
    expect(pills[0]?.spawns[0]?.zones[0]?.spots).toEqual([{ x: 5, z: 6 }]);
  });

  it("resolves a night variant's exclusive bosses against the variant's own entry", () => {
    const priest: RawMapBoss = {
      ...boss("Cultist Priest", 0.5, null, "sectantPriest"),
      spawnZones: [{ key: "BotZone", name: "Any scav spawn", chance: 1 }],
    };
    const { pills } = getBossStripData("factory", [
      makeMap({
        normalizedName: "factory",
        bosses: [boss("Tagilla", 0.3)],
        bossSpawnSpots: { BotZone: [{ x: 1, z: 1 }] },
      }),
      makeMap({
        normalizedName: "night-factory",
        bosses: [boss("Tagilla", 0.3), priest],
        bossSpawnSpots: { BotZone: [{ x: 9, z: 9 }] },
      }),
    ]);
    const cultists = pills.find((p) => p.name === "Cultists");
    expect(cultists?.spawns[0]?.zones[0]?.spots).toEqual([{ x: 9, z: 9 }]);
  });

  it("gives Big Pipe and Birdeye Knight's zones and timing, since the Goons roam together", () => {
    const knight: RawMapBoss = {
      ...boss("Knight", 0.35, null, "bossKnight"),
      spawnZones: [{ key: "ZoneCustoms", name: "Customs", chance: 1 }],
      spawnTiming: { kind: "random" },
    };
    const { pills } = getBossStripData("customs", [
      makeMap({ normalizedName: "customs", bosses: [knight] }),
    ]);
    for (const name of ["Knight", "Big Pipe", "Birdeye"]) {
      const spawn = pills.find((p) => p.name === name)?.spawns[0];
      expect(spawn?.timing).toEqual({ kind: "random" });
      expect(spawn?.zones.map((zone) => zone.name)).toEqual(["Customs"]);
    }
  });
});
