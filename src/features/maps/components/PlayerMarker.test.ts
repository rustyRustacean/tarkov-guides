import { describe, expect, it } from "vitest";

import { chevronYawDeg, playerMarkerCenter } from "./PlayerMarker";

import type { CompanionPosition } from "@/features/companion/companion-config";

function pos(overrides: Partial<CompanionPosition> = {}): CompanionPosition {
  return { x: 100, z: 200, yaw: 30, at: 0, ...overrides };
}

describe("playerMarkerCenter", () => {
  it("places the dot at [z, x] in game space when uncalibrated", () => {
    expect(playerMarkerCenter(pos({ x: 100, z: 200 }), undefined, undefined)).toEqual([200, 100]);
  });

  it("ignores calibration when imageBounds is missing", () => {
    const cal = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    expect(playerMarkerCenter(pos({ x: 5, z: 9 }), cal, undefined)).toEqual([9, 5]);
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
