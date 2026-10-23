import { describe, expect, it } from "vitest";

import { buildGrid } from "./grid-route";
import { loadObstacles } from "./map-obstacles";
import { MAX_GRID_CELLS } from "./route-limits";

const MAPS = [
  "customs",
  "ground-zero",
  "interchange",
  "lighthouse",
  "reserve",
  "shoreline",
  "streets-of-tarkov",
  "terminal",
  "woods",
] as const;

/** Bytes per cell while a route is computed: flags 1, owner 4, dist 8, parent 4. */
const BYTES_PER_CELL = 17;

describe("real map grids", () => {
  it.each(MAPS)("%s fits well under the cell cap", async (map) => {
    const obstacles = await loadObstacles(map);
    expect(obstacles).not.toBeNull();
    if (obstacles === null) return;
    const grid = buildGrid(obstacles, []);
    const cells = grid.w * grid.h;
    const megabytes = (cells * BYTES_PER_CELL) / 1e6;
    // Every real map is far smaller than the cap; a jump here means the data or the cell size changed.
    expect(cells).toBeLessThan(MAX_GRID_CELLS / 2);
    expect(megabytes).toBeLessThan(20);
  });
});
