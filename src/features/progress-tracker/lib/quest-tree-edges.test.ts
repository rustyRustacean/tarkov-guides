import { describe, expect, it } from "vitest";

import { buildEdgePath, computeEdgeLabelPositions } from "./quest-tree-edges";

describe("buildEdgePath", () => {
  it("returns a plain straight line for a cross-trader edge, even when x1 differs from x2", () => {
    expect(buildEdgePath(10, 0, 50, 100, false)).toBe("M 10 0 L 50 100");
  });

  it("returns a 4-point elbow jogging at the vertical midpoint for a same-trader edge", () => {
    expect(buildEdgePath(10, 0, 50, 100, true)).toBe("M 10 0 L 10 50 L 50 50 L 50 100");
  });

  it("collapses a same-trader edge to a straight line when x1 equals x2 (no jog needed)", () => {
    expect(buildEdgePath(30, 0, 30, 100, true)).toBe("M 30 0 L 30 100");
  });
});

describe("computeEdgeLabelPositions", () => {
  it("offsets the from-label below the source point and the to-label above the target point, preserving x", () => {
    const result = computeEdgeLabelPositions(10, 0, 50, 100);
    expect(result.from).toEqual({ x: 10, y: 6 });
    expect(result.to).toEqual({ x: 50, y: 94 });
  });
});
