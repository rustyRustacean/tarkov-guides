import { describe, expect, it } from "vitest";

import { exitPathAvailable, walkingRouteAvailable } from "./exit-path-maps";
import { hasNavMesh } from "./map-navmesh";
import { hasObstacleData } from "./map-obstacles";

const ALL_MAPS = [
  "customs",
  "factory",
  "ground-zero",
  "icebreaker",
  "interchange",
  "lighthouse",
  "reserve",
  "shoreline",
  "streets-of-tarkov",
  "terminal",
  "the-lab",
  "the-labyrinth",
  "woods",
];

describe("exitPathAvailable", () => {
  it("is off for Terminal and Icebreaker only", () => {
    expect(exitPathAvailable("terminal")).toBe(false);
    expect(exitPathAvailable("icebreaker")).toBe(false);
    for (const name of ["customs", "shoreline", "woods", "factory", "the-lab"]) {
      expect(exitPathAvailable(name)).toBe(true);
    }
  });
});

describe("walkingRouteAvailable", () => {
  it("is off where the only route would be a straight line through walls", () => {
    for (const name of ["factory", "the-lab", "the-labyrinth", "terminal", "icebreaker"]) {
      expect(walkingRouteAvailable(name)).toBe(false);
    }
    for (const name of ["customs", "shoreline", "woods", "streets-of-tarkov"]) {
      expect(walkingRouteAvailable(name)).toBe(true);
    }
  });

  it("only offers maps whose obstacle grid can stand in for a missing mesh", () => {
    for (const name of ALL_MAPS) {
      if (walkingRouteAvailable(name)) {
        expect(hasNavMesh(name)).toBe(true);
        expect(hasObstacleData(name)).toBe(true);
      }
    }
  });
});
