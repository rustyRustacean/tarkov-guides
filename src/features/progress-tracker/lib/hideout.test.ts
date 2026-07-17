import { describe, expect, it } from "vitest";

import { hideoutBuiltKey } from "../types";

import { getHideoutGoalPath, getHideoutLevelStatus, toggleHideoutBuiltPatch } from "./hideout";

import type { HideoutBuiltKey } from "../types";
import type { RawHideoutStation } from "@/shared/lib/tarkov-api/types";

const stationA: RawHideoutStation = {
  id: "station-a",
  name: "Station A",
  normalizedName: "station-a",
  levels: [
    { level: 1, itemRequirements: [], stationLevelRequirements: [] },
    { level: 2, itemRequirements: [], stationLevelRequirements: [] },
    { level: 3, itemRequirements: [], stationLevelRequirements: [] },
  ],
};

const stationB: RawHideoutStation = {
  id: "station-b",
  name: "Station B",
  normalizedName: "station-b",
  levels: [
    {
      level: 1,
      itemRequirements: [],
      stationLevelRequirements: [{ station: { normalizedName: "station-a" }, level: 2 }],
    },
  ],
};

describe("toggleHideoutBuiltPatch", () => {
  it("building a level cascades down through every lower level of the same station", () => {
    const result = toggleHideoutBuiltPatch([stationA], {}, "station-a", 3);
    expect(result).toEqual({
      "station-a:1": true,
      "station-a:2": true,
      "station-a:3": true,
    });
  });

  it("un-building only undoes the exact level clicked, no cascade", () => {
    const built: Record<HideoutBuiltKey, true> = {
      "station-a:1": true,
      "station-a:2": true,
      "station-a:3": true,
    };
    const result = toggleHideoutBuiltPatch([stationA], built, "station-a", 3);
    expect(result).toEqual({ "station-a:1": true, "station-a:2": true });
  });
});

describe("getHideoutGoalPath", () => {
  it("returns [] when the target level is already built", () => {
    const built: Record<HideoutBuiltKey, true> = { "station-a:3": true };
    expect(getHideoutGoalPath([stationA], built, "station-a", 3)).toEqual([]);
  });

  it("resolves same-station lower levels first, strictly sequentially, target last and marked isGoal", () => {
    const path = getHideoutGoalPath([stationA], {}, "station-a", 3);
    expect(path.map((step) => step.level)).toEqual([1, 2, 3]);
    expect(path.map((step) => step.isGoal)).toEqual([false, false, true]);
  });

  it("skips already-built lower levels", () => {
    const built: Record<HideoutBuiltKey, true> = { "station-a:1": true };
    const path = getHideoutGoalPath([stationA], built, "station-a", 3);
    expect(path.map((step) => step.level)).toEqual([2, 3]);
  });

  it("resolves cross-station stationLevelRequirements before the goal itself", () => {
    const path = getHideoutGoalPath([stationA, stationB], {}, "station-b", 1);
    expect(path).toEqual([
      { stationNormalizedName: "station-a", stationName: "Station A", level: 1, isGoal: false },
      { stationNormalizedName: "station-a", stationName: "Station A", level: 2, isGoal: false },
      { stationNormalizedName: "station-b", stationName: "Station B", level: 1, isGoal: true },
    ]);
  });

  it("dedupes a diamond dependency (two branches converging on the same prerequisite), keeping first occurrence", () => {
    // station-c level 1 requires BOTH station-a level 2 directly AND station-b
    // level 1 (which itself requires station-a level 2) - station-a:2 must
    // appear exactly once in the resolved path.
    const stationC: RawHideoutStation = {
      id: "station-c",
      name: "Station C",
      normalizedName: "station-c",
      levels: [
        {
          level: 1,
          itemRequirements: [],
          stationLevelRequirements: [
            { station: { normalizedName: "station-a" }, level: 2 },
            { station: { normalizedName: "station-b" }, level: 1 },
          ],
        },
      ],
    };
    const path = getHideoutGoalPath([stationA, stationB, stationC], {}, "station-c", 1);
    const keys = path.map((step) => hideoutBuiltKey(step.stationNormalizedName, step.level));
    expect(new Set(keys).size).toBe(keys.length);
    expect(path[path.length - 1]).toMatchObject({
      stationNormalizedName: "station-c",
      isGoal: true,
    });
  });

  it("returns [] for an unknown station or level", () => {
    expect(getHideoutGoalPath([stationA], {}, "unknown-station", 1)).toEqual([]);
    expect(getHideoutGoalPath([stationA], {}, "station-a", 99)).toEqual([]);
  });
});

describe("getHideoutLevelStatus", () => {
  it("returns 'done' for an already-built level", () => {
    const built: Record<HideoutBuiltKey, true> = { "station-a:1": true };
    expect(getHideoutLevelStatus([stationA], built, "station-a", 1)).toBe("done");
  });

  it("returns 'started' for a level with no unbuilt prerequisites", () => {
    expect(getHideoutLevelStatus([stationA], {}, "station-a", 1)).toBe("started");
  });

  it("returns 'locked' when a same-station lower level is unbuilt", () => {
    expect(getHideoutLevelStatus([stationA], {}, "station-a", 3)).toBe("locked");
  });

  it("returns 'locked' when a cross-station stationLevelRequirements entry is unmet", () => {
    expect(getHideoutLevelStatus([stationA, stationB], {}, "station-b", 1)).toBe("locked");
  });
});
