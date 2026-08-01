import { describe, expect, it } from "vitest";

import { clampPercent, nextPercentFromKey, percentFromClientX } from "./video-compare-slider";

describe("clampPercent", () => {
  it("passes values already in range through unchanged", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(100)).toBe(100);
  });

  it("clamps below 0 up to 0", () => {
    expect(clampPercent(-20)).toBe(0);
  });

  it("clamps above 100 down to 100", () => {
    expect(clampPercent(150)).toBe(100);
  });
});

describe("percentFromClientX", () => {
  it("maps the left edge to 0 and the right edge to 100", () => {
    const rect = { left: 100, width: 400 };
    expect(percentFromClientX(100, rect)).toBe(0);
    expect(percentFromClientX(500, rect)).toBe(100);
  });

  it("maps the midpoint to 50", () => {
    expect(percentFromClientX(300, { left: 100, width: 400 })).toBe(50);
  });

  it("clamps clientX outside the rect instead of returning out-of-range percentages", () => {
    const rect = { left: 100, width: 400 };
    expect(percentFromClientX(0, rect)).toBe(0);
    expect(percentFromClientX(1000, rect)).toBe(100);
  });

  it("falls back to 50 for a zero-width rect rather than dividing by zero", () => {
    expect(percentFromClientX(250, { left: 100, width: 0 })).toBe(50);
  });
});

describe("nextPercentFromKey", () => {
  it("nudges left on ArrowLeft/ArrowDown", () => {
    expect(nextPercentFromKey(50, "ArrowLeft")).toBe(45);
    expect(nextPercentFromKey(50, "ArrowDown")).toBe(45);
  });

  it("nudges right on ArrowRight/ArrowUp", () => {
    expect(nextPercentFromKey(50, "ArrowRight")).toBe(55);
    expect(nextPercentFromKey(50, "ArrowUp")).toBe(55);
  });

  it("jumps further on PageUp/PageDown", () => {
    expect(nextPercentFromKey(50, "PageUp")).toBe(60);
    expect(nextPercentFromKey(50, "PageDown")).toBe(40);
  });

  it("goes straight to the ends on Home/End", () => {
    expect(nextPercentFromKey(50, "Home")).toBe(0);
    expect(nextPercentFromKey(50, "End")).toBe(100);
  });

  it("clamps at the boundaries instead of going out of range", () => {
    expect(nextPercentFromKey(2, "ArrowLeft")).toBe(0);
    expect(nextPercentFromKey(98, "ArrowRight")).toBe(100);
  });

  it("returns null for keys it doesn't handle", () => {
    expect(nextPercentFromKey(50, "Tab")).toBeNull();
    expect(nextPercentFromKey(50, "a")).toBeNull();
  });
});
