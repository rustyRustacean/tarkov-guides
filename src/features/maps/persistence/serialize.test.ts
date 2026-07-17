import { describe, expect, it } from "vitest";

import { DEFAULT_TOP_DOLLAR_THRESHOLD_RUB } from "../lib/map-valuables";
import { emptyMapProfileState } from "../types";

import { deserializeSnapshot, serializeSnapshot } from "./serialize";

import type { MapsSnapshot } from "./types";

function validSnapshot(): MapsSnapshot {
  return serializeSnapshot({
    currentMap: "reserve",
    mapVariants: { reserve: "overview" },
    customMaps: { reserve: [{ id: "c1", label: "Mine", custom: true }] },
    profileState: {
      "profile-1": {
        annotations: {
          reserve: {
            overview: {
              strokes: [
                { id: "s1", type: "pen", color: "#fff", width: 4, points: [{ fx: 0.1, fy: 0.2 }] },
                {
                  id: "s2",
                  type: "circle",
                  color: "#000",
                  width: 2,
                  center: { fx: 0.5, fy: 0.5 },
                  edge: { fx: 0.6, fy: 0.5 },
                },
              ],
              locks: [{ id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 0.1, fy: 0.1 } }],
            },
          },
        },
        taskDisplayOverrides: { "task-1": true },
      },
    },
    topDollarThresholdRub: 50_000,
  });
}

describe("serializeSnapshot", () => {
  it("stamps schemaVersion 1 and a real exportedAt timestamp", () => {
    const snapshot = validSnapshot();
    expect(snapshot.schemaVersion).toBe(1);
    expect(new Date(snapshot.exportedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("deserializeSnapshot", () => {
  it("round-trips a valid snapshot exactly (minus exportedAt)", () => {
    const snapshot = validSnapshot();
    const roundTripped = deserializeSnapshot(JSON.parse(JSON.stringify(snapshot)) as unknown);
    expect(roundTripped).toEqual(snapshot);
  });

  it.each([null, undefined, "a string", 42, []])("rejects non-object input: %p", (value) => {
    expect(deserializeSnapshot(value)).toBeNull();
  });

  it("rejects the wrong schemaVersion", () => {
    expect(deserializeSnapshot({ ...validSnapshot(), schemaVersion: 2 })).toBeNull();
  });

  it("rejects a malformed stroke (missing color)", () => {
    const snapshot = validSnapshot();
    const malformed = {
      ...snapshot,
      profileState: {
        "profile-1": {
          annotations: {
            reserve: {
              overview: { strokes: [{ id: "s1", type: "pen", width: 4, points: [] }], locks: [] },
            },
          },
          taskDisplayOverrides: {},
        },
      },
    };
    expect(deserializeSnapshot(malformed)).toBeNull();
  });

  it("rejects a malformed lock rect", () => {
    const snapshot = validSnapshot();
    const malformed = {
      ...snapshot,
      profileState: {
        "profile-1": {
          annotations: {
            reserve: { overview: { strokes: [], locks: [{ id: "l1", corner1: { fx: 0 } }] } },
          },
          taskDisplayOverrides: {},
        },
      },
    };
    expect(deserializeSnapshot(malformed)).toBeNull();
  });

  it("rejects a malformed custom map entry", () => {
    const snapshot = validSnapshot();
    const malformed = { ...snapshot, customMaps: { reserve: [{ id: "c1", label: "Mine" }] } };
    expect(deserializeSnapshot(malformed)).toBeNull();
  });

  it("accepts an empty-but-valid snapshot", () => {
    const snapshot = serializeSnapshot({
      currentMap: "reserve",
      mapVariants: {},
      customMaps: {},
      profileState: { "profile-1": emptyMapProfileState() },
      topDollarThresholdRub: DEFAULT_TOP_DOLLAR_THRESHOLD_RUB,
    });
    expect(deserializeSnapshot(snapshot)).toEqual(snapshot);
  });

  it("defaults topDollarThresholdRub instead of rejecting a snapshot from before that field existed", () => {
    const snapshot = validSnapshot();
    const withoutField = { ...snapshot } as Partial<MapsSnapshot>;
    delete withoutField.topDollarThresholdRub;
    expect(deserializeSnapshot(withoutField)).toEqual({
      ...snapshot,
      topDollarThresholdRub: DEFAULT_TOP_DOLLAR_THRESHOLD_RUB,
    });
  });
});
