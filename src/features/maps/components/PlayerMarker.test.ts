import { describe, expect, it } from "vitest";

import { gameCenter } from "../lib/leaflet-crs";

import { chevronYawDeg, playerMarkerCenter } from "./PlayerMarker";

import type { CompanionPosition } from "@/features/companion/companion-config";

function pos(overrides: Partial<CompanionPosition> = {}): CompanionPosition {
  return { x: 100, z: 200, yaw: 30, at: 0, map: null, ...overrides };
}

describe("playerMarkerCenter", () => {
  it("places the dot at [z, x] in game space when uncalibrated", () => {
    expect(playerMarkerCenter(pos({ x: 100, z: 200 }), undefined, undefined)).toEqual([200, 100]);
  });

  it("ignores calibration when imageBounds is missing", () => {
    const cal = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    expect(playerMarkerCenter(pos({ x: 5, z: 9 }), cal, undefined)).toEqual([9, 5]);
  });

  // The load-bearing one: a screenshot's coordinates and a task objective's
  // coordinates are the same kind of Unity world position, so the same numbers
  // must draw on the same spot. Both sides go through `gameCenter`; this fails
  // the moment either grows its own projection again.
  it("lands exactly where a task marker with the same coordinates lands", () => {
    const bounds: [[number, number], [number, number]] = [
      [-100, -100],
      [100, 100],
    ];
    const cal = { a: 0.001, b: 0.0002, c: 0.4, d: 0.0003, e: 0.0015, f: 0.55 };

    for (const [x, z] of [
      [159.9, -246.7],
      [-33.16, 25.81],
      [0, 0],
    ] as const) {
      expect(playerMarkerCenter(pos({ x, z }), undefined, undefined)).toEqual(
        gameCenter(x, z, undefined, undefined),
      );
      expect(playerMarkerCenter(pos({ x, z }), cal, bounds)).toEqual(gameCenter(x, z, cal, bounds));
    }
  });
});

describe("chevronYawDeg", () => {
  it("adds the map coordinate rotation to the screenshot yaw", () => {
    expect(chevronYawDeg(30, 180)).toBe(210);
    expect(chevronYawDeg(0, 0)).toBe(0);
  });

  it("stays null when facing is unknown", () => {
    expect(chevronYawDeg(null, 180)).toBeNull();
  });
});
