import { describe, expect, it } from "vitest";

import { positionBelongsOnMap, tabForRaidLocation } from "./raid-location";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

function map(normalizedName: string, nameId: string | null): RawMap {
  return {
    name: normalizedName,
    normalizedName,
    nameId,
    raidDuration: null,
    players: null,
    bosses: [],
  };
}

// The ids EFT actually writes into its logs, paired with the `nameId` the live
// API publishes for each map, taken from `json.tarkov.dev/regular/maps`.
const MAPS: readonly RawMap[] = [
  map("reserve", "RezervBase"),
  map("customs", "bigmap"),
  map("woods", "Woods"),
  map("factory", "factory4_day"),
  map("night-factory", "factory4_night"),
  map("the-lab", "laboratory"),
  map("the-lab-dark", "laboratory_dark"),
  map("ground-zero", "Sandbox"),
  map("ground-zero-21", "Sandbox_high"),
  map("streets-of-tarkov", "TarkovStreets"),
  map("icebreaker", "Icebreaker"),
];

describe("tabForRaidLocation", () => {
  it("resolves an internal location id to its map tab", () => {
    expect(tabForRaidLocation("RezervBase", MAPS)).toBe("reserve");
    expect(tabForRaidLocation("bigmap", MAPS)).toBe("customs");
    expect(tabForRaidLocation("TarkovStreets", MAPS)).toBe("streets-of-tarkov");
  });

  it("is case-insensitive", () => {
    expect(tabForRaidLocation("rezervbase", MAPS)).toBe("reserve");
  });

  it("folds sub-locations onto the tab that actually shows them", () => {
    // The game treats these as their own locations; the app has one tab each.
    expect(tabForRaidLocation("factory4_night", MAPS)).toBe("factory");
    expect(tabForRaidLocation("Sandbox_high", MAPS)).toBe("ground-zero");
    expect(tabForRaidLocation("laboratory_dark", MAPS)).toBe("the-lab");
  });

  it("returns null for an unknown or absent location", () => {
    expect(tabForRaidLocation("SomeNewMap2027", MAPS)).toBeNull();
    expect(tabForRaidLocation(null, MAPS)).toBeNull();
    expect(tabForRaidLocation("", MAPS)).toBeNull();
  });

  it("returns null when upstream published no nameId to match on", () => {
    expect(tabForRaidLocation("RezervBase", [map("reserve", null)])).toBeNull();
  });
});

describe("positionBelongsOnMap", () => {
  it("allows a position only on the map it was captured on", () => {
    expect(positionBelongsOnMap("RezervBase", "reserve", MAPS)).toBe(true);
    expect(positionBelongsOnMap("RezervBase", "woods", MAPS)).toBe(false);
  });

  it("allows a night-Factory position on the Factory tab", () => {
    expect(positionBelongsOnMap("factory4_night", "factory", MAPS)).toBe(true);
  });

  it("refuses a position whose map is unknown rather than guessing", () => {
    // Falling back to "whatever tab is open" is the bug this prevents: a bare
    // x/z would render as a real in-game position on the wrong map.
    expect(positionBelongsOnMap(null, "reserve", MAPS)).toBe(false);
    expect(positionBelongsOnMap("SomeNewMap2027", "reserve", MAPS)).toBe(false);
  });
});
