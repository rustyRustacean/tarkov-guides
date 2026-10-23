import L from "leaflet";
import { describe, expect, it } from "vitest";

import { gamePointFromLatLng } from "./exit-path-geo";

describe("gamePointFromLatLng", () => {
  it("is [z, x] on the shared game-space CRS", () => {
    expect(gamePointFromLatLng(L.latLng(30, 10), undefined, undefined)).toEqual({ x: 10, z: 30 });
  });

  it("inverts a calibrated variant's affine", () => {
    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [100, 200],
    ];
    // fx = 0.002*x + 0.1, fy = 0.004*z + 0.2
    const calibration = { a: 0.002, b: 0, c: 0.1, d: 0, e: 0.004, f: 0.2 };
    // x = 100 -> fx = 0.3 ; z = 50 -> fy = 0.4
    const lng = 0 + 0.3 * 200;
    const lat = 100 - 0.4 * 100;
    const point = gamePointFromLatLng(L.latLng(lat, lng), calibration, bounds);
    expect(point.x).toBeCloseTo(100);
    expect(point.z).toBeCloseTo(50);
  });
});
