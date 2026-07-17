import L from "leaflet";
import { describe, expect, it } from "vitest";

import {
  fractionalToLatLng,
  latLngToFractional,
  leafletBoundsFor,
  leafletCRSFor,
} from "./leaflet-crs";

describe("leafletBoundsFor", () => {
  it("converts [[x,z],[x,z]] Unity-space bounds to Leaflet's [[z,x],[z,x]]", () => {
    // Real reserve config from taskMarkers.js - transform is irrelevant here.
    expect(
      leafletBoundsFor({
        transform: [0.395, 122.0, 0.395, 137.65],
        bounds: [
          [289, -293],
          [-303, 244],
        ],
      }),
    ).toEqual([
      [-293, 289],
      [244, -303],
    ]);
  });
});

describe("leafletCRSFor", () => {
  it.each([0, 90, 180, 270])("round-trips project/unproject for a %d° rotation", (rotation) => {
    const crs = leafletCRSFor({
      transform: [1, 0, 1, 0],
      coordinateRotation: rotation,
      bounds: [
        [0, 0],
        [1, 1],
      ],
    });
    const original = L.latLng(123.4, -56.7);

    const projected = crs.project(original);
    const roundTripped = crs.unproject(projected);

    expect(roundTripped.lat).toBeCloseTo(original.lat, 6);
    expect(roundTripped.lng).toBeCloseTo(original.lng, 6);
  });

  it("defaults rotation to 0 when coordinateRotation is omitted", () => {
    const bounds = [
      [0, 0],
      [1, 1],
    ] as const;
    const withDefault = leafletCRSFor({ transform: [1, 0, 1, 0], bounds });
    const explicitZero = leafletCRSFor({ transform: [1, 0, 1, 0], coordinateRotation: 0, bounds });

    const point = L.latLng(10, 20);
    expect(withDefault.project(point)).toEqual(explicitZero.project(point));
  });

  it("a 90 degree rotation actually changes the projected point vs. no rotation", () => {
    const bounds = [
      [0, 0],
      [1, 1],
    ] as const;
    const unrotated = leafletCRSFor({ transform: [1, 0, 1, 0], bounds });
    const rotated = leafletCRSFor({ transform: [1, 0, 1, 0], coordinateRotation: 90, bounds });

    const point = L.latLng(10, 20);
    expect(rotated.project(point)).not.toEqual(unrotated.project(point));
  });
});

describe("fractionalToLatLng / latLngToFractional", () => {
  const bounds: L.LatLngBoundsExpression = [
    [-303, 289],
    [244, -293],
  ];

  it("maps the four corners correctly - fy=0 is north/top, fy=1 is south/bottom", () => {
    expect(fractionalToLatLng({ fx: 0, fy: 0 }, bounds)).toEqual(L.latLng(244, -293));
    expect(fractionalToLatLng({ fx: 1, fy: 0 }, bounds)).toEqual(L.latLng(244, 289));
    expect(fractionalToLatLng({ fx: 0, fy: 1 }, bounds)).toEqual(L.latLng(-303, -293));
    expect(fractionalToLatLng({ fx: 1, fy: 1 }, bounds)).toEqual(L.latLng(-303, 289));
  });

  it("maps the center to fx=0.5, fy=0.5", () => {
    const center = fractionalToLatLng({ fx: 0.5, fy: 0.5 }, bounds);
    expect(center.lat).toBeCloseTo((-303 + 244) / 2, 6);
    expect(center.lng).toBeCloseTo((289 + -293) / 2, 6);
  });

  it("round-trips through latLngToFractional", () => {
    for (const point of [
      { fx: 0, fy: 0 },
      { fx: 1, fy: 1 },
      { fx: 0.37, fy: 0.82 },
    ]) {
      const latLng = fractionalToLatLng(point, bounds);
      const roundTripped = latLngToFractional(latLng, bounds);
      expect(roundTripped.fx).toBeCloseTo(point.fx, 9);
      expect(roundTripped.fy).toBeCloseTo(point.fy, 9);
    }
  });
});
