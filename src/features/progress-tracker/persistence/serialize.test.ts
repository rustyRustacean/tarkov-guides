import { describe, expect, it } from "vitest";

import { emptyProfileProgress } from "../types";

import { deserializeSnapshot, serializeSnapshot } from "./serialize";

import type { Profile } from "../types";

const profile: Profile = {
  id: "profile-1",
  name: "PMC",
  mode: "PVP",
  faction: "BEAR",
  face: null,
};

describe("serializeSnapshot / deserializeSnapshot round-trip", () => {
  it("round-trips through JSON with no data loss", () => {
    const snapshot = serializeSnapshot({
      profiles: [profile],
      activeProfileId: "profile-1",
      progressByProfile: {
        "profile-1": {
          ...emptyProfileProgress(),
          have: { "item-a": 3 },
          taskStatus: {
            "task-1": { status: "done", autoDone: true, completedAt: "2026-07-10T00:00:00.000Z" },
          },
        },
      },
      autoStartNext: true,
    });

    const roundTripped = deserializeSnapshot(JSON.parse(JSON.stringify(snapshot)) as unknown);
    expect(roundTripped).toEqual(snapshot);
  });

  it("stamps schemaVersion 1 and a real exportedAt timestamp", () => {
    const snapshot = serializeSnapshot({
      profiles: [],
      activeProfileId: null,
      progressByProfile: {},
      autoStartNext: true,
    });
    expect(snapshot.schemaVersion).toBe(1);
    expect(() => new Date(snapshot.exportedAt).toISOString()).not.toThrow();
  });
});

describe("deserializeSnapshot malformed input handling", () => {
  it.each([
    ["null", null],
    ["a string", "not an object"],
    ["an array", []],
    ["wrong schemaVersion", { schemaVersion: 2 }],
    ["missing exportedAt", { schemaVersion: 1 }],
    ["profiles not an array", { schemaVersion: 1, exportedAt: "x", profiles: "nope" }],
    [
      "a profile with an invalid faction",
      {
        schemaVersion: 1,
        exportedAt: "x",
        profiles: [{ ...profile, faction: "SPACE_MARINES" }],
        activeProfileId: null,
        progressByProfile: {},
        autoStartNext: true,
      },
    ],
    [
      "progressByProfile with an invalid taskStatus status value",
      {
        schemaVersion: 1,
        exportedAt: "x",
        profiles: [profile],
        activeProfileId: "profile-1",
        progressByProfile: {
          "profile-1": { ...emptyProfileProgress(), taskStatus: { t: { status: "bogus" } } },
        },
        autoStartNext: true,
      },
    ],
    [
      "autoStartNext not a boolean",
      {
        schemaVersion: 1,
        exportedAt: "x",
        profiles: [],
        activeProfileId: null,
        progressByProfile: {},
        autoStartNext: "yes",
      },
    ],
  ])("returns null, never throws, for: %s", (_label, input) => {
    expect(() => deserializeSnapshot(input)).not.toThrow();
    expect(deserializeSnapshot(input)).toBeNull();
  });

  it("accepts a valid minimal snapshot with no profiles", () => {
    const result = deserializeSnapshot({
      schemaVersion: 1,
      exportedAt: "2026-07-10T00:00:00.000Z",
      profiles: [],
      activeProfileId: null,
      progressByProfile: {},
      autoStartNext: true,
    });
    expect(result).not.toBeNull();
  });

  it("backfills a missing prestigeLevel to 0 on pre-2026-07-16 snapshots instead of rejecting them", () => {
    const progressWithoutPrestigeLevel: Record<string, unknown> = { ...emptyProfileProgress() };
    delete progressWithoutPrestigeLevel.prestigeLevel;
    const result = deserializeSnapshot({
      schemaVersion: 1,
      exportedAt: "2026-07-10T00:00:00.000Z",
      profiles: [profile],
      activeProfileId: "profile-1",
      progressByProfile: { "profile-1": progressWithoutPrestigeLevel },
      autoStartNext: true,
    });
    expect(result?.progressByProfile["profile-1"]?.prestigeLevel).toBe(0);
  });
});
