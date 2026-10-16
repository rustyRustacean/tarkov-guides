import { describe, expect, it } from "vitest";

import { trimRoute } from "./route-reuse";

import type { PathResult } from "./exit-path";

/** An L-shaped route: 100 m east, then 100 m north. */
const route: PathResult = {
  points: [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 100, z: 100 },
  ],
  length: 200,
  detoured: true,
};

describe("trimRoute", () => {
  it("drops the part already walked and keeps the corner", () => {
    const trimmed = trimRoute(route, { x: 40, z: 1 });
    expect(trimmed).not.toBeNull();
    expect(trimmed?.points.at(-1)).toEqual({ x: 100, z: 100 });
    expect(trimmed?.points).toContainEqual({ x: 100, z: 0 });
    // 60 m to the corner, 100 m up, plus the 1 m step back onto the line.
    expect(trimmed?.length).toBeCloseTo(161, 0);
  });

  it("starts the new line at the player", () => {
    expect(trimRoute(route, { x: 40, z: 1 })?.points[0]).toEqual({ x: 40, z: 1 });
  });

  it("works on the second leg too", () => {
    const trimmed = trimRoute(route, { x: 101, z: 60 });
    expect(trimmed?.points).not.toContainEqual({ x: 100, z: 0 });
    expect(trimmed?.length).toBeCloseTo(41, 0);
  });

  it("asks for a new route when the player is off the line", () => {
    expect(trimRoute(route, { x: 40, z: 20 })).toBeNull();
  });

  it("respects a custom tolerance", () => {
    expect(trimRoute(route, { x: 40, z: 6 }, 8)).not.toBeNull();
    expect(trimRoute(route, { x: 40, z: 6 }, 3)).toBeNull();
  });

  it("keeps a short line when the player is at the exit", () => {
    const trimmed = trimRoute(route, { x: 100, z: 100 });
    expect(trimmed?.length).toBeCloseTo(0, 5);
  });

  it("is no longer a detour once the straight line is nearly as short", () => {
    const trimmed = trimRoute(route, { x: 100, z: 90 });
    expect(trimmed?.detoured).toBe(false);
  });
});
