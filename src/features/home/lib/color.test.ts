import { describe, expect, it } from "vitest";

import { hexToHsl } from "./color";

describe("hexToHsl", () => {
  it("converts pure red", () => {
    expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
  });

  it("converts pure white to zero saturation", () => {
    expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
  });

  it("converts pure black to zero saturation", () => {
    expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
  });

  it("converts a real warm-gold/inventory accent token", () => {
    // --accent: #d4a548 (src/app/globals.css, [data-theme="warm-gold"]).
    // Exact values independently hand-computed from the RGB channels
    // (212, 165, 72): an amber hue around 40°.
    const { h, s, l } = hexToHsl("#d4a548");
    expect(h).toBeCloseTo(39.86, 1);
    expect(s).toBeCloseTo(61.95, 1);
    expect(l).toBeCloseTo(55.69, 1);
  });

  it("handles a value without a leading #", () => {
    expect(hexToHsl("ff0000")).toEqual({ h: 0, s: 100, l: 50 });
  });

  it("falls back to neutral grey for a malformed value", () => {
    expect(hexToHsl("not-a-color")).toEqual({ h: 0, s: 0, l: 50 });
  });
});
