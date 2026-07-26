import L from "leaflet";
import { describe, expect, it } from "vitest";

import {
  containFitBounds,
  fractionalToLatLng,
  latLngToFractional,
  leafletBoundsFor,
  leafletCRSFor,
  toLatLngBounds,
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

describe("containFitBounds", () => {
  // A 100x100 (square) calibrated box centered on [0,0].
  const squareBounds: L.LatLngBoundsExpression = [
    [-50, -50],
    [50, 50],
  ];
  // `L.CRS.Simple` projects lat/lng straight to screen x/y with no rotation
  // (matches `leafletCRSFor` with `coordinateRotation: 0`) - the right stand-in
  // for these unrotated fixtures.
  const identityCrs = L.CRS.Simple;

  it("returns bounds unchanged when naturalSize is null (image not loaded yet)", () => {
    expect(containFitBounds(squareBounds, null, identityCrs)).toBe(squareBounds);
  });

  it("returns bounds unchanged for a degenerate (zero) natural size", () => {
    expect(containFitBounds(squareBounds, { width: 0, height: 100 }, identityCrs)).toBe(
      squareBounds,
    );
    expect(containFitBounds(squareBounds, { width: 100, height: 0 }, identityCrs)).toBe(
      squareBounds,
    );
  });

  it("shrinks height (letterboxes top/bottom) for a wider-than-box image", () => {
    // 2:1 image inside a 1:1 box -> full width, half height, centered.
    const result = toLatLngBounds(
      containFitBounds(squareBounds, { width: 200, height: 100 }, identityCrs),
    );
    expect(result.getWest()).toBeCloseTo(-50, 9);
    expect(result.getEast()).toBeCloseTo(50, 9);
    expect(result.getSouth()).toBeCloseTo(-25, 9);
    expect(result.getNorth()).toBeCloseTo(25, 9);
  });

  it("shrinks width (letterboxes left/right) for a taller-than-box image", () => {
    // 1:2 image inside a 1:1 box -> full height, half width, centered.
    const result = toLatLngBounds(
      containFitBounds(squareBounds, { width: 100, height: 200 }, identityCrs),
    );
    expect(result.getSouth()).toBeCloseTo(-50, 9);
    expect(result.getNorth()).toBeCloseTo(50, 9);
    expect(result.getWest()).toBeCloseTo(-25, 9);
    expect(result.getEast()).toBeCloseTo(25, 9);
  });

  it("leaves an already-matching aspect ratio effectively unchanged", () => {
    // Reserve's real calibrated bounds (592 wide x 537 tall, aspect ~1.10)
    // against Reserve.svg's real pixel size (827x761, aspect ~1.09) - the
    // "interactive"/"overview" variants' real-world case, which this
    // function must leave visually unresized (small rounding aside).
    const reserveBounds: L.LatLngBoundsExpression = [
      [-293, 289],
      [244, -303],
    ];
    const result = toLatLngBounds(
      containFitBounds(reserveBounds, { width: 827, height: 761 }, identityCrs),
    );
    const original = toLatLngBounds(reserveBounds);
    expect(Math.abs(result.getWest() - original.getWest())).toBeLessThan(10);
    expect(Math.abs(result.getNorth() - original.getNorth())).toBeLessThan(10);
  });

  it("keeps the same center as the original bounds", () => {
    const result = toLatLngBounds(
      containFitBounds(squareBounds, { width: 300, height: 100 }, identityCrs),
    );
    const resultCenter = result.getCenter();
    expect(resultCenter.lat).toBeCloseTo(0, 9);
    expect(resultCenter.lng).toBeCloseTo(0, 9);
  });

  it("fits against the projected (screen-space) axes, not raw lat/lng, under a 90 degree rotation", () => {
    // A tall-in-lat/lng box (100 lat span x 40 lng span) under a 90 degree
    // rotation swaps which raw span is on-screen width vs. height (see
    // `applyLeafletRotation`) - screen space here is actually 100 wide x 40
    // tall. Fitting a 2:1 (wide) image should use the screen-space aspect,
    // not the raw lng/lat one - this is the exact bug that squished
    // Factory's and The Lab's 2D images (both 90/270 degree rotated maps)
    // before `crs` was threaded into this function.
    const rotatedCrs = leafletCRSFor({
      transform: [1, 0, 1, 0],
      coordinateRotation: 90,
      bounds: [
        [0, 0],
        [1, 1],
      ],
    });
    const tallBounds: L.LatLngBoundsExpression = [
      [-50, -20],
      [50, 20],
    ];

    const result = containFitBounds(tallBounds, { width: 200, height: 100 }, rotatedCrs);

    // Project the result's corners back through the same rotated CRS and
    // confirm the on-screen box is actually 2:1 (matching the image), not
    // stretched/squished by the raw-lat/lng bug this test guards against.
    const b = toLatLngBounds(result);
    const p1 = rotatedCrs.project(b.getSouthWest());
    const p2 = rotatedCrs.project(b.getNorthEast());
    const screenAspect = Math.abs(p2.x - p1.x) / Math.abs(p2.y - p1.y);
    expect(screenAspect).toBeCloseTo(2, 6);
  });
});
