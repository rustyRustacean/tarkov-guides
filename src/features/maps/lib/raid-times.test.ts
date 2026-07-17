import { describe, expect, it } from "vitest";

import { getRaidTimes } from "./raid-times";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

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

describe("getRaidTimes", () => {
  it("computes extractMinutes as raidMinutes - 7", () => {
    expect(getRaidTimes(makeMap({ raidDuration: 45 }))).toEqual({
      raidMinutes: 45,
      extractMinutes: 38,
      players: "8-12",
    });
  });

  it("clamps extractMinutes at 0 rather than going negative for a very short raid", () => {
    expect(getRaidTimes(makeMap({ raidDuration: 5 })).extractMinutes).toBe(0);
  });

  it("reports null raidMinutes/extractMinutes for a zero or negative duration", () => {
    expect(getRaidTimes(makeMap({ raidDuration: 0 }))).toEqual({
      raidMinutes: null,
      extractMinutes: null,
      players: "8-12",
    });
    expect(getRaidTimes(makeMap({ raidDuration: -1 })).raidMinutes).toBeNull();
  });

  it("reports null raidMinutes/extractMinutes for a null duration", () => {
    expect(getRaidTimes(makeMap({ raidDuration: null }))).toEqual({
      raidMinutes: null,
      extractMinutes: null,
      players: "8-12",
    });
  });

  it("reports null players when absent", () => {
    expect(getRaidTimes(makeMap({ players: null })).players).toBeNull();
  });

  it("reports every field null for an undefined map", () => {
    expect(getRaidTimes(undefined)).toEqual({
      raidMinutes: null,
      extractMinutes: null,
      players: null,
    });
  });
});
