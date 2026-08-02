import { describe, expect, it } from "vitest";

import { variantHasAccurateMarkers, type MapVariant } from "./map-config";

function variant(overrides: Partial<MapVariant>): MapVariant {
  return { id: "x", label: "X", imageUrl: "/x.png", ...overrides };
}

describe("variantHasAccurateMarkers", () => {
  it("shows markers on the interactive Satellite View", () => {
    expect(variantHasAccurateMarkers(variant({ id: "interactive", interactive: true }))).toBe(true);
  });

  it("shows markers on the Overview", () => {
    expect(variantHasAccurateMarkers(variant({ id: "overview" }))).toBe(true);
  });

  it("shows markers on a calibrated variant (e.g. Reserve 2D)", () => {
    const calibration = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    expect(variantHasAccurateMarkers(variant({ id: "2d", calibration }))).toBe(true);
  });

  it("hides markers on an uncalibrated 2D variant", () => {
    expect(variantHasAccurateMarkers(variant({ id: "2d" }))).toBe(false);
  });

  it("hides markers on a 3D variant", () => {
    expect(variantHasAccurateMarkers(variant({ id: "3d" }))).toBe(false);
  });
});
