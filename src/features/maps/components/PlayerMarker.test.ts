import L from "leaflet";
import { describe, expect, it } from "vitest";

import { gameCenter, leafletCRSFor } from "../lib/leaflet-crs";
import { MAP_CONFIGS } from "../lib/map-config";

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
  it("subtracts the map coordinate rotation from the screenshot yaw", () => {
    expect(chevronYawDeg(30, 180)).toBe(-150);
    expect(chevronYawDeg(0, 0)).toBe(0);
    expect(chevronYawDeg(0, 90)).toBe(-90);
  });

  // Ground truth is the real CRS every marker is drawn through: walk 10 m along
  // the heading in game space, see which way that moves on screen, and require
  // the chevron to point the same way. Covers every configured map, so a
  // rotation the formula gets wrong (Factory 90, Lab 270) cannot slip through.
  describe.each(Object.entries(MAP_CONFIGS))("%s", (_id, config) => {
    const crs = leafletCRSFor(config);
    // The projection applies the map rotation only. The full transformation also
    // scales the axes (unequally on Ice Breaker, 2.0 vs 3.5), which skews diagonal
    // angles on screen but is not a rotation and is not what the chevron corrects.
    const project = (x: number, z: number) => crs.project(L.latLng(z, x));

    it.each([0, 45, 90, 135, 180, 225, 270, 315])("points along yaw %i on screen", (yaw) => {
      const rad = (yaw * Math.PI) / 180;
      const from = project(0, 0);
      const to = project(10 * Math.sin(rad), 10 * Math.cos(rad));
      // Projected y grows upward, so screen-up is +y here.
      const moved = Math.atan2(to.x - from.x, to.y - from.y);

      const chevron = chevronYawDeg(yaw, config.coordinateRotation ?? 0);
      const chevronRad = ((chevron ?? 0) * Math.PI) / 180;

      expect(Math.sin(chevronRad)).toBeCloseTo(Math.sin(moved), 6);
      expect(Math.cos(chevronRad)).toBeCloseTo(Math.cos(moved), 6);
    });
  });

  it("stays null when facing is unknown", () => {
    expect(chevronYawDeg(null, 180)).toBeNull();
  });
});
