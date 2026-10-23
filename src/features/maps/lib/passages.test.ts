import { describe, expect, it } from "vitest";

import { findFenceGaps } from "./passages";

describe("findFenceGaps", () => {
  it("finds a gate: two fence ends pointing at each other across a few metres", () => {
    // Two collinear fences along z=0, leaving a 3 m opening at x 50..53.
    const left = [0, 0, 50, 0];
    const right = [53, 0, 100, 0];
    expect(findFenceGaps([left, right], [])).toEqual([[50, 0, 53, 0]]);
  });

  it("ignores gaps that are too narrow or too wide", () => {
    expect(
      findFenceGaps(
        [
          [0, 0, 50, 0],
          [50.5, 0, 100, 0],
        ],
        [],
      ),
    ).toEqual([]);
    expect(
      findFenceGaps(
        [
          [0, 0, 50, 0],
          [70, 0, 120, 0],
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("ignores fences that only run side by side", () => {
    const a = [0, 0, 50, 0];
    const b = [48, 3, 98, 3];
    expect(findFenceGaps([a, b], [])).toEqual([]);
  });

  it("ignores a gap inside a building (a break in the drawing, not a gate)", () => {
    const building = [45, -5, 58, -5, 58, 5, 45, 5];
    expect(
      findFenceGaps(
        [
          [0, 0, 50, 0],
          [53, 0, 100, 0],
        ],
        [building],
      ),
    ).toEqual([]);
  });

  it("does not treat a closed loop as having free ends", () => {
    const loop = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
    expect(findFenceGaps([loop, [14, 0, 30, 0]], [])).toEqual([]);
  });

  it("pairs each end once", () => {
    const gaps = findFenceGaps(
      [
        [0, 0, 50, 0],
        [53, 0, 100, 0],
        [53, 40, 100, 40],
      ],
      [],
    );
    expect(gaps).toHaveLength(1);
  });
});
