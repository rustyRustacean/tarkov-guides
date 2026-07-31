import { describe, expect, it } from "vitest";

import { estimateSectionWeight, selectFeaturedSectionIndex } from "./quest-detail-bento";

describe("estimateSectionWeight", () => {
  it("sums each line's character length plus a fixed per-line overhead", () => {
    expect(estimateSectionWeight(["ab", "abcd"])).toBe(2 + 24 + (4 + 24));
  });

  it("is 0 for no lines", () => {
    expect(estimateSectionWeight([])).toBe(0);
  });

  it("accepts a custom per-line overhead", () => {
    expect(estimateSectionWeight(["ab"], 100)).toBe(2 + 100);
  });
});

describe("selectFeaturedSectionIndex", () => {
  it("returns null for an even-length weights array", () => {
    expect(selectFeaturedSectionIndex([10, 50, 20, 5])).toBeNull();
  });

  it("returns the index of the largest weight for an odd-length array", () => {
    expect(selectFeaturedSectionIndex([10, 50, 20])).toBe(1);
  });

  it("returns null for arrays shorter than 2", () => {
    expect(selectFeaturedSectionIndex([])).toBeNull();
    expect(selectFeaturedSectionIndex([10])).toBeNull();
  });
});
