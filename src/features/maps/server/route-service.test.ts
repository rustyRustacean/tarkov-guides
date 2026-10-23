import { beforeEach, describe, expect, it, vi } from "vitest";

import { boundsOf } from "../lib/map-bounds";
import { loadObstacles } from "../lib/map-obstacles";
import { MAX_GRID_CELLS } from "../lib/route-limits";

import { getMapRouteData, type MapRouteData } from "./map-route-data";
import { resetRouteService, routeMany } from "./route-service";

vi.mock("./map-route-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./map-route-data")>()),
  getMapRouteData: vi.fn(),
}));

const mockedData = vi.mocked(getMapRouteData);

function dataWith(anchors: { x: number; z: number }[] = []): MapRouteData {
  return { minefields: [], anchors };
}

/** Customs' own extent, so the tests stand somewhere that really is on the map. */
async function customsCentre() {
  const obstacles = await loadObstacles("customs");
  if (obstacles === null) throw new Error("customs obstacles missing");
  const bounds = boundsOf(
    [obstacles.buildings, obstacles.water, obstacles.fences, obstacles.limit],
    [],
  );
  if (bounds === null) throw new Error("customs has no extent");
  return {
    bounds,
    centre: { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 },
  };
}

beforeEach(() => {
  resetRouteService();
  mockedData.mockReset();
  // No mesh on disk and no private store: customs falls back to the obstacle grid.
  process.env.NAVMESH_DIR = "Z:/does-not-exist";
  delete process.env.NAVMESH_BASE_URL;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("routeMany", () => {
  it("does not route a start that is off the map", async () => {
    mockedData.mockResolvedValue(dataWith());
    const { bounds, centre } = await customsCentre();
    const out = await routeMany("customs", { x: bounds.maxX + 2000, z: centre.z }, [centre]);
    expect(out.routes).toEqual([null]);
    expect(out.stats.refused).toBe(true);
    expect(out.stats.gridCells).toBe(0);
  });

  it("gives no route to a target off the map but still routes the others", async () => {
    mockedData.mockResolvedValue(dataWith());
    const { bounds, centre } = await customsCentre();
    const out = await routeMany("customs", centre, [
      { x: centre.x + 20, z: centre.z },
      { x: bounds.maxX + 2000, z: centre.z },
    ]);
    expect(out.stats.refused).toBe(false);
    expect(out.routes[1]).toBeNull();
    expect(out.stats.gridCells).toBeGreaterThan(0);
    expect(out.stats.gridCells).toBeLessThanOrEqual(MAX_GRID_CELLS);
  });

  it("keeps an exit at the edge of the map reachable (it is part of the map)", async () => {
    const { bounds, centre } = await customsCentre();
    const edgeExit = { x: bounds.maxX + 60, z: centre.z };
    mockedData.mockResolvedValue(dataWith([edgeExit]));
    const out = await routeMany("customs", centre, [edgeExit]);
    expect(out.stats.refused).toBe(false);
    expect(out.stats.gridCells).toBeGreaterThan(0);
  });

  it("builds no grid, and does not fail, when server data would make one over the cap", async () => {
    // A bad exit position upstream must not turn into a 25M-cell grid.
    mockedData.mockResolvedValue(dataWith([{ x: 4900, z: 4900 }]));
    const { centre } = await customsCentre();
    const out = await routeMany("customs", centre, [{ x: centre.x + 20, z: centre.z }]);
    expect(out.stats.gridCells).toBe(0);
    expect(out.routes).toHaveLength(1);
  });

  it("rebuilds the grid when the server's data is refreshed", async () => {
    const { centre } = await customsCentre();
    const first = dataWith();
    mockedData.mockResolvedValue(first);
    const a = await routeMany("customs", centre, [{ x: centre.x + 20, z: centre.z }]);
    const second = dataWith([{ x: centre.x + 40, z: centre.z + 40 }]);
    mockedData.mockResolvedValue(second);
    const b = await routeMany("customs", centre, [{ x: centre.x + 20, z: centre.z }]);
    expect(a.stats.gridCells).toBeGreaterThan(0);
    expect(b.stats.gridCells).toBeGreaterThan(0);
  });
});
