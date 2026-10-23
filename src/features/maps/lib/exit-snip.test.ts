import { describe, expect, it } from "vitest";

import { describeOutcome, matchExitSnip, normalizeExitName, type ExitSnipRow } from "./exit-snip";

import type { RawMap, RawMapExtract, RawMapTransit } from "@/shared/lib/tarkov-api/types";

// Real names from tarkov.dev's maps data (translated); positions are stand-ins.
function extract(
  id: string,
  name: string,
  faction: RawMapExtract["faction"],
  x = 1,
): RawMapExtract {
  return { id, name, faction, position: { x, y: 0, z: x * 2 } };
}
function transit(id: string, name: string, toMap: string): RawMapTransit {
  return { id, name, toMap, position: { x: 5, y: 0, z: 5 } };
}
function map(
  normalizedName: string,
  nameId: string,
  extracts: RawMapExtract[],
  transits: RawMapTransit[] = [],
): RawMap {
  return {
    name: normalizedName,
    normalizedName,
    nameId,
    raidDuration: null,
    players: null,
    bosses: [],
    extracts,
    transits,
  };
}

const FACTORY = map(
  "factory",
  "factory4_day",
  [
    extract("f-med", "Med Tent Gate", "pmc"),
    extract("f-cel", "Cellars", "pmc"),
    extract("f-g3s", "Gate 3", "scav", 2),
    extract("f-g3p", "Gate 3", "pmc", 3),
    extract("f-smu", "Smugglers' Passage", "pmc"),
    extract("f-cou", "Courtyard Gate", "pmc"),
    extract("f-cam", "Camera Bunker Door", "scav"),
    extract("f-g2", "Gate 2", "pmc"),
    extract("f-off", "Office Window", "scav"),
    extract("f-g0", "Gate 0", "pmc"),
  ],
  [
    transit("t3", "Transit to Woods", "woods"),
    transit("t4", "Transit to Customs", "customs"),
    transit("t5", "Transit to The Lab", "the-lab"),
  ],
);

const INTERCHANGE = map(
  "interchange",
  "Interchange",
  [
    extract("i-rs", "Railway Exfil", "scav", 2),
    extract("i-saf", "Saferoom Exfil", "pmc"),
    extract("i-rp", "Railway Exfil", "pmc", 3),
    extract("i-em", "Emercom Checkpoint", "pmc"),
    extract("i-sc", "Scav Camp (Co-Op)", "shared"),
    extract("i-fl", "Path to River (Flare)", "pmc"),
    extract("i-pw", "Power Station V-Ex", "pmc"),
    extract("i-ho", "Hole in the Fence", "pmc"),
  ],
  [
    transit("t1", "Transit to Customs", "customs"),
    transit("t2", "Transit to Streets of Tarkov", "streets-of-tarkov"),
  ],
);

const SHORELINE = map(
  "shoreline",
  "Shoreline",
  [
    extract("s-cl", "Climber's Trail", "pmc"),
    extract("s-tu", "Tunnel", "pmc"),
    extract("s-sm", "Smugglers' Path (Co-op)", "shared"),
    extract("s-pa", "Path to Lighthouse", "pmc"),
    extract("s-pi", "Pier Boat", "pmc"),
    extract("s-no", "Road to North V-Ex", "pmc"),
    extract("s-rc", "Road to Customs", "pmc", 4),
    extract("s-rcs", "Road to Customs", "scav", 5),
  ],
  [
    transit("t7", "Transit to Lighthouse", "lighthouse"),
    transit("t8", "Transit to Icebreaker", "icebreaker"),
  ],
);

const MAPS = [FACTORY, INTERCHANGE, SHORELINE];

function row(
  kind: ExitSnipRow["kind"],
  index: number | null,
  name: string,
  hasTimer = false,
): ExitSnipRow {
  return { kind, index, name, hasTimer };
}

// What the companion's OCR actually returned for three real snips.
const FACTORY_SNIP = [
  row("exfil", 1, "Cellars"),
  row("exfil", 2, "Gate 3"),
  row("exfil", 3, "Gate"), // OCR dropped the slashed zero of "Gate 0"
  row("exfil", 4, "Med Tent Gate"),
  row("exfil", 5, "Courtyard Gate"),
  row("transit", 1, "Transit to Woods", true),
  row("transit", 2, "Transit to Customs", true),
  row("transit", 3, "Transit to The Lab", true),
];
const INTERCHANGE_SNIP = [
  row("exfil", 1, "Railway Exfil"),
  row("exfil", 2, "Power Station V-Ex", true), // ??:??:??
  row("exfil", 3, "Scav Camp (Co-Op)"),
  row("exfil", 4, "Hole in the Fence"),
  row("exfil", 5, "Saferoom Exfil"),
  row("transit", 1, "Transit to Customs", true),
  row("transit", 2, "Transit to Streets of Tarkov", true),
];
const SHORELINE_SNIP = [
  row("exfil", 1, "Road to North V-Ex"),
  row("exfil", 2, "Tunnel"),
  row("exfil", 3, "Path to Lighthouse"),
  row("exfil", 4, "Smugglers' Path (Co-op)"),
  row("exfil", 5, "Pier Boat", true),
  row("exfil", 6, "Climber's Trail"),
  row("transit", 1, "Transit to Lighthouse", true),
  row("transit", null, "Transit to Icebreaker", true),
];

describe("normalizeExitName", () => {
  it("folds the slashed zero, case, spacing and punctuation", () => {
    expect(normalizeExitName("Gate Ø")).toBe("gate0");
    expect(normalizeExitName("  Smugglers'  Path (Co-op) ")).toBe("smugglerspathcoop");
  });
});

describe("matchExitSnip", () => {
  it("matches a whole Factory list on the PMC side, including the dropped zero", () => {
    const outcome = matchExitSnip(FACTORY_SNIP, "factory4_day", MAPS);
    expect(outcome.status).toBe("applied");
    if (outcome.status !== "applied") return;
    expect(outcome.side).toBe("pmc");
    expect(outcome.unmatched).toEqual([]);
    const byName = Object.fromEntries(outcome.exits.map((e) => [e.name, e]));
    // The PMC "Gate 3", not the scav one with the same name.
    expect(byName["Gate 3"]?.id).toBe("f-g3p");
    expect(byName["Gate 0"]?.id).toBe("f-g0");
    expect(byName["Gate 0"]?.match).toBe("inferred");
    expect(outcome.exits.filter((e) => e.kind === "transit")).toHaveLength(3);
  });

  it("marks an EXFIL row with a timer as unknown, and never a transit", () => {
    const outcome = matchExitSnip(INTERCHANGE_SNIP, "Interchange", MAPS);
    if (outcome.status !== "applied") throw new Error("expected applied");
    const unknown = outcome.exits.filter((e) => e.unknown).map((e) => e.name);
    expect(unknown).toEqual(["Power Station V-Ex"]);
    // The same label exists for scav too: the whole-list side check picks PMC.
    expect(outcome.exits.find((e) => e.name === "Railway Exfil")?.id).toBe("i-rp");
    expect(outcome.exits.find((e) => e.name === "Scav Camp (Co-Op)")?.id).toBe("i-sc");
  });

  it("reads a Shoreline list with a numberless transit tag", () => {
    const outcome = matchExitSnip(SHORELINE_SNIP, "Shoreline", MAPS);
    if (outcome.status !== "applied") throw new Error("expected applied");
    expect(outcome.exits.filter((e) => e.kind === "exfil")).toHaveLength(6);
    expect(outcome.exits.find((e) => e.name === "Pier Boat")?.unknown).toBe(true);
    expect(outcome.exits.find((e) => e.name === "Transit to Icebreaker")).toBeDefined();
  });

  it("refuses a snip taken for a different map than the game says, and says why", () => {
    const outcome = matchExitSnip(SHORELINE_SNIP, "factory4_day", MAPS);
    expect(outcome.status).toBe("refused");
    if (outcome.status !== "refused") return;
    expect(outcome.reason).toBe("map-mismatch");
    expect(outcome.message).toContain("shoreline");
  });

  it("never uses the snip to pick the map when the game's map is unknown", () => {
    expect(matchExitSnip(SHORELINE_SNIP, null, MAPS)).toMatchObject({
      status: "refused",
      reason: "no-map",
    });
    expect(matchExitSnip(SHORELINE_SNIP, "NotAMap", MAPS)).toMatchObject({ reason: "no-map" });
  });

  it("flags rows it cannot match instead of guessing", () => {
    const rows = [...SHORELINE_SNIP, row("exfil", 7, "Totally Made Up Exit")];
    const outcome = matchExitSnip(rows, "Shoreline", MAPS);
    if (outcome.status !== "applied") throw new Error("expected applied");
    expect(outcome.unmatched).toEqual([
      { kind: "exfil", name: "Totally Made Up Exit", reason: "no-candidate" },
    ]);
    expect(outcome.exits.some((e) => e.name === "Totally Made Up Exit")).toBe(false);
  });

  it("refuses when too few rows match", () => {
    const rows = [
      row("exfil", 1, "Tunnel"),
      row("exfil", 2, "Nope One"),
      row("exfil", 3, "Nope Two"),
      row("exfil", 4, "Nope Three"),
    ];
    expect(matchExitSnip(rows, "Shoreline", MAPS)).toMatchObject({
      status: "refused",
      reason: "too-few-matches",
    });
  });

  it("does not claim one exit for two rows", () => {
    const rows = [
      row("exfil", 1, "Tunnel"),
      row("exfil", 2, "Tunnel"),
      row("exfil", 3, "Pier Boat"),
    ];
    const outcome = matchExitSnip(rows, "Shoreline", MAPS);
    if (outcome.status !== "applied") throw new Error("expected applied");
    expect(outcome.exits.filter((e) => e.name === "Tunnel")).toHaveLength(1);
    expect(outcome.unmatched).toHaveLength(1);
  });

  it("tolerates a single misread letter", () => {
    const rows = [row("exfil", 1, "Pier Boal"), row("exfil", 2, "Tunnel")];
    const outcome = matchExitSnip(rows, "Shoreline", MAPS);
    if (outcome.status !== "applied") throw new Error("expected applied");
    expect(outcome.exits.find((e) => e.id === "s-pi")?.match).toBe("inferred");
  });

  it("refuses an empty row list", () => {
    expect(matchExitSnip([], "Shoreline", MAPS)).toMatchObject({ reason: "not-exit-list" });
  });
});

describe("describeOutcome", () => {
  it("summarizes counts, unknowns and unrecognized rows", () => {
    const outcome = matchExitSnip(
      [...INTERCHANGE_SNIP, row("transit", 3, "Transit to Nowhere", true)],
      "Interchange",
      MAPS,
    );
    if (outcome.status !== "applied") throw new Error("expected applied");
    const text = describeOutcome(outcome);
    expect(text).toContain("5 extracts (1 unknown)");
    expect(text).toContain("2 transits");
    expect(text).toContain("Not recognized: Transit to Nowhere");
  });
});
