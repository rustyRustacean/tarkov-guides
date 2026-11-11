import { describe, expect, it } from "vitest";

import {
  buildSpawnTimeline,
  describeTiming,
  formatRaidClock,
  hasSpawnTimeline,
  isPastRaid,
  listNames,
  possessive,
  spawnSpotsFor,
  summarizeTiming,
  summarizeZones,
  timingNeedsTimeline,
  unnamedSwitchesFor,
} from "./boss-spawns";

import type { BossPill, BossSpawn, BossSpawnZone } from "./boss-groups";

function zone(name: string, chance: number, spots: BossSpawnZone["spots"] = []): BossSpawnZone {
  return { key: `Zone${name.replace(/\s+/g, "")}`, name, chance, spots };
}

function spawn(overrides: Partial<BossSpawn> = {}): BossSpawn {
  return { chance: 0.5, zones: [], timing: null, trigger: null, groupSize: null, ...overrides };
}

function pill(
  name: string,
  spawns: readonly BossSpawn[],
  overrides: Partial<BossPill> = {},
): BossPill {
  return {
    name,
    chance: Math.max(0, ...spawns.map((s) => s.chance)),
    tone: "warm",
    imagePortraitLink: null,
    mobIds: [`mob-${name}`],
    guards: [],
    groupSize: null,
    spawns,
    ...overrides,
  };
}

const start = { kind: "start" } as const;
const random = { kind: "random" } as const;
const scripted = { kind: "scripted" } as const;
const at = (seconds: number) => ({ kind: "timed", seconds }) as const;
const onSwitch = (switchName: string | null) => ({ switchName });

describe("formatRaidClock", () => {
  it("writes minutes and two-digit seconds, minutes uncapped", () => {
    expect(formatRaidClock(3)).toBe("0:03");
    expect(formatRaidClock(900)).toBe("15:00");
    expect(formatRaidClock(800)).toBe("13:20");
    expect(formatRaidClock(5790)).toBe("96:30");
  });
});

describe("isPastRaid", () => {
  it("is only past a known raid length", () => {
    expect(isPastRaid(5790, 50)).toBe(true);
    expect(isPastRaid(2845, 50)).toBe(false);
    expect(isPastRaid(3000, 50)).toBe(false);
    expect(isPastRaid(5790, null)).toBe(false);
  });
});

describe("possessive and listNames", () => {
  it("adds an apostrophe after a final s, 's otherwise", () => {
    expect(possessive("Reshala")).toBe("Reshala's");
    expect(possessive("Raiders")).toBe("Raiders'");
  });

  it("joins names for a sentence", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["Dorms"])).toBe("Dorms");
    expect(listNames(["Dorms", "New Gas Station"])).toBe("Dorms and New Gas Station");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("summarizeZones", () => {
  it("gives one spawn's zones their chances, likeliest first, then by name", () => {
    const zones = summarizeZones([
      spawn({
        zones: [zone("Stronghold", 0.33), zone("Dorms", 0.33), zone("New Gas Station", 0.34)],
      }),
      spawn(),
    ]);
    expect(zones).toEqual([
      { name: "New Gas Station", chance: 0.34 },
      { name: "Dorms", chance: 0.33 },
      { name: "Stronghold", chance: 0.33 },
    ]);
  });

  it("lists several spawns' zones without a chance, by the best odds of one spawn landing there", () => {
    const zones = summarizeZones([
      spawn({ chance: 0.6, zones: [zone("Second Floor", 1)] }),
      spawn({ chance: 0.45, zones: [zone("Basement", 1)] }),
      spawn({ chance: 0.35, zones: [zone("First Floor", 0.5), zone("Hangar Gate", 0.5)] }),
      spawn({ chance: 0.6, zones: [zone("First Floor", 1)] }),
    ]);
    expect(zones).toEqual([
      { name: "First Floor", chance: null },
      { name: "Second Floor", chance: null },
      { name: "Basement", chance: null },
      { name: "Hangar Gate", chance: null },
    ]);
  });

  it("is empty for a boss with no zones", () => {
    expect(summarizeZones([spawn()])).toEqual([]);
  });
});

describe("summarizeTiming", () => {
  it("passes one shared timing through, a timer as 'from'", () => {
    expect(summarizeTiming([spawn({ timing: start })])).toEqual(start);
    expect(summarizeTiming([spawn({ timing: random }), spawn({ timing: random })])).toEqual(random);
    expect(summarizeTiming([spawn({ timing: scripted })])).toEqual(scripted);
    expect(summarizeTiming([spawn({ timing: at(900) })])).toEqual({ kind: "from", seconds: 900 });
  });

  it("calls any switch trigger 'triggered', whatever else the spawns do", () => {
    expect(
      summarizeTiming([
        spawn({ timing: at(300) }),
        spawn({ timing: start, trigger: onSwitch("X") }),
      ]),
    ).toEqual({ kind: "triggered" });
  });

  it("calls different timings 'several' (waves, or a start plus a timer)", () => {
    expect(summarizeTiming([spawn({ timing: at(40) }), spawn({ timing: at(600) })])).toEqual({
      kind: "several",
    });
    expect(summarizeTiming([spawn({ timing: start }), spawn({ timing: at(600) })])).toEqual({
      kind: "several",
    });
  });

  it("ignores spawns with no time, and is null when none has one", () => {
    expect(summarizeTiming([spawn(), spawn({ timing: at(900) })])).toEqual({
      kind: "from",
      seconds: 900,
    });
    expect(summarizeTiming([spawn()])).toBeNull();
  });
});

describe("describeTiming", () => {
  it("words each timing for the card", () => {
    expect(describeTiming(start, 35)).toBe("At raid start");
    expect(describeTiming(random, 35)).toBe("At a random time during the raid");
    expect(describeTiming(scripted, 50)).toBe("Scripted, not on a timer");
    expect(describeTiming({ kind: "from", seconds: 900 }, 35)).toBe("Can appear from 15:00");
    expect(describeTiming({ kind: "triggered" }, 30)).toBe("Some spawns are triggered by switches");
    expect(describeTiming({ kind: "several" }, 50)).toBe("Spawns at several different times");
  });

  it("flags a timer past the raid's end", () => {
    expect(describeTiming({ kind: "from", seconds: 5790 }, 50)).toBe(
      "Can appear from 96:30, after the 50 min raid ends",
    );
    expect(describeTiming({ kind: "from", seconds: 5790 }, null)).toBe("Can appear from 96:30");
  });

  it("points only triggered and several-times spawns at the timeline", () => {
    expect(timingNeedsTimeline({ kind: "triggered" })).toBe(true);
    expect(timingNeedsTimeline({ kind: "several" })).toBe(true);
    expect(timingNeedsTimeline({ kind: "from", seconds: 900 })).toBe(false);
    expect(timingNeedsTimeline(start)).toBe(false);
  });
});

describe("spawnSpotsFor", () => {
  it("dedupes spots across spawns and lists the zones with none, likeliest first", () => {
    const stronghold = zone("Stronghold", 0.33, [
      { x: 1, z: 2 },
      { x: 3, z: 4 },
    ]);
    const result = spawnSpotsFor(
      pill("Reshala", [
        spawn({ zones: [zone("Dorms", 0.33), zone("New Gas Station", 0.33), stronghold] }),
        spawn({ zones: [stronghold] }),
      ]),
    );
    expect(result.spots).toEqual([
      { x: 1, z: 2, zone: "Stronghold" },
      { x: 3, z: 4, zone: "Stronghold" },
    ]);
    expect(result.zonesWithoutSpots).toEqual(["Dorms", "New Gas Station"]);
  });

  it("is empty for a boss with no zones", () => {
    expect(spawnSpotsFor(pill("Partisan", [spawn()]))).toEqual({
      spots: [],
      zonesWithoutSpots: [],
    });
  });
});

describe("hasSpawnTimeline", () => {
  it("is true for a timed, random or triggered spawn", () => {
    expect(hasSpawnTimeline([pill("A", [spawn({ timing: at(900) })])])).toBe(true);
    expect(hasSpawnTimeline([pill("A", [spawn({ timing: random })])])).toBe(true);
    expect(hasSpawnTimeline([pill("A", [spawn({ timing: start, trigger: onSwitch(null) })])])).toBe(
      true,
    );
  });

  it("is false for raid-start, scripted and untimed spawns only", () => {
    expect(
      hasSpawnTimeline([
        pill("A", [spawn({ timing: start })]),
        pill("B", [spawn({ timing: scripted })]),
        pill("C", [spawn()]),
      ]),
    ).toBe(false);
    expect(hasSpawnTimeline([])).toBe(false);
  });
});

describe("buildSpawnTimeline", () => {
  it("lays timed spawns out earliest first, sharing a row per time and flagging past-raid times", () => {
    const blackDiv = pill("Black Division", [
      spawn({ chance: 0.4, timing: at(1800), zones: [zone("Warehouse", 1)] }),
      spawn({ chance: 0.2, timing: at(40), zones: [zone("Gate", 1)] }),
    ]);
    const killa = pill("Killa", [spawn({ chance: 0.2, timing: at(5790) })]);
    const af = pill("AF", [spawn({ chance: 0.3, timing: at(1800), zones: [zone("Port", 1)] })]);
    const { timed } = buildSpawnTimeline([blackDiv, killa, af], 50);
    expect(
      timed.map((row) => [row.seconds, row.pastRaid, row.subjects.map((s) => s.name)]),
    ).toEqual([
      [40, false, ["Black Division"]],
      [1800, false, ["Black Division", "AF"]],
      [5790, true, ["Killa"]],
    ]);
  });

  it("keeps each spawn at the same time on its own line, with the pill's badge", () => {
    const raiders = pill(
      "Raiders",
      [
        spawn({ chance: 0.45, timing: at(450), zones: [zone("Basement", 1)] }),
        spawn({
          chance: 0.6,
          timing: at(450),
          zones: [zone("Second Floor", 1)],
          groupSize: [{ count: 2, chance: 1 }],
        }),
      ],
      { badge: { icon: "☾", title: "night only" } },
    );
    const [row] = buildSpawnTimeline([raiders], 30).timed;
    expect(row?.subjects).toEqual([
      {
        name: "Raiders",
        imagePortraitLink: null,
        tone: "warm",
        badge: { icon: "☾", title: "night only" },
        chance: 0.45,
        groupSize: null,
        zones: ["Basement"],
      },
      {
        name: "Raiders",
        imagePortraitLink: null,
        tone: "hot",
        badge: { icon: "☾", title: "night only" },
        chance: 0.6,
        groupSize: [{ count: 2, chance: 1 }],
        zones: ["Second Floor"],
      },
    ]);
  });

  it("carries the pill's chance note, so Partisan's 0% isn't read as never", () => {
    const partisan = pill("Partisan", [spawn({ chance: 0, timing: at(900) })], {
      note: "higher with low-karma PMCs in the raid",
    });
    const [row] = buildSpawnTimeline([partisan], 35).timed;
    expect(row?.subjects[0]?.note).toBe("higher with low-karma PMCs in the raid");
  });

  it("groups triggered spawns by switch in upstream order, unnamed switches last, with linked times", () => {
    const raiders = pill("Raiders", [
      spawn({
        chance: 0.35,
        timing: start,
        trigger: onSwitch(null),
        zones: [zone("First Floor", 1)],
      }),
      spawn({ chance: 0.4, timing: start, trigger: onSwitch("Cargo Elevator Power Button") }),
      spawn({
        chance: 0.45,
        timing: start,
        trigger: onSwitch("Hangar Gate Switch"),
        zones: [zone("Hangar Gate", 1)],
      }),
      spawn({
        chance: 0.35,
        timing: at(600),
        trigger: onSwitch("Hangar Gate Switch"),
        zones: [zone("First Floor", 0.5), zone("Second Floor", 0.5)],
      }),
      spawn({
        chance: 0.35,
        timing: start,
        trigger: onSwitch(null),
        zones: [zone("First Floor", 1)],
      }),
    ]);
    const { triggered, timed } = buildSpawnTimeline([raiders], 30);
    expect(timed).toEqual([]);
    expect(
      triggered.map((group) => [
        group.switchName,
        group.subjects.map((s) => [s.chance, s.zones, s.linkedSeconds]),
      ]),
    ).toEqual([
      ["Cargo Elevator Power Button", [[0.4, [], null]]],
      [
        "Hangar Gate Switch",
        [
          [0.45, ["Hangar Gate"], null],
          [0.35, ["First Floor", "Second Floor"], 600],
        ],
      ],
      // The two unnamed switches' identical spawn is listed once.
      [null, [[0.35, ["First Floor"], null]]],
    ]);
  });

  it("keeps a repeated spawn under a named switch or a timer, since each is its own roll", () => {
    const twice = (overrides: Partial<BossSpawn>) => [spawn(overrides), spawn(overrides)];
    const { triggered, timed } = buildSpawnTimeline(
      [
        pill("Raiders", [
          ...twice({ timing: start, trigger: onSwitch("D-2 Power Switch") }),
          ...twice({ timing: at(300) }),
        ]),
      ],
      40,
    );
    expect(triggered[0]?.subjects).toHaveLength(2);
    expect(timed[0]?.subjects).toHaveLength(2);
  });

  it("lists random-time and raid-start spawns per pill, and leaves scripted and untimed ones out", () => {
    const timeline = buildSpawnTimeline(
      [
        pill("Knight", [spawn({ timing: random })]),
        pill("Reshala", [spawn({ timing: start }), spawn({ timing: start })]),
        pill("The Wedge", [spawn({ timing: scripted })]),
        pill("Mystery", [spawn()]),
      ],
      35,
    );
    expect(timeline.random.map((s) => s.name)).toEqual(["Knight"]);
    expect(timeline.atStart.map((s) => s.name)).toEqual(["Reshala"]);
    expect(timeline.timed).toEqual([]);
    expect(timeline.triggered).toEqual([]);
  });
});

describe("unnamedSwitchesFor", () => {
  it("explains Labs' unnamed extract switches, and stays generic elsewhere", () => {
    expect(unnamedSwitchesFor("the-lab").title).toBe("Other extract switches");
    expect(unnamedSwitchesFor("the-lab").note).toContain("Main Elevator");
    expect(unnamedSwitchesFor("reserve").title).toBe("Unnamed switches");
  });
});
