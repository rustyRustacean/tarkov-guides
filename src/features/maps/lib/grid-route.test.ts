import { describe, expect, it } from "vitest";

import { buildGrid, GridRouter, type ObstacleData } from "./grid-route";

/** A flat polygon (clockwise square) as `[x0, z0, x1, z1, ...]`. */
function box(x0: number, z0: number, x1: number, z1: number): number[] {
  return [x0, z0, x1, z0, x1, z1, x0, z1];
}

function data(parts: Partial<ObstacleData>): ObstacleData {
  return { map: "test", buildings: [], water: [], fences: [], limit: [], ...parts };
}

/** Samples a route densely and reports whether any sample sits inside `poly`. */
function crosses(points: readonly { x: number; z: number }[], poly: number[]): boolean {
  const [x0 = 0, z0 = 0, , , x1 = 0, z1 = 0] = poly;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (x > x0 && x < x1 && z > z0 && z < z1) return true;
    }
  }
  return false;
}

describe("GridRouter", () => {
  it("goes straight across open ground", () => {
    const grid = buildGrid(
      data({ buildings: [box(500, 500, 510, 510)], fences: [[-60, -60, 160, -60]] }),
      [],
    );
    const route = new GridRouter(grid, { x: 0, z: 0 }).routeTo({ x: 100, z: 0 });
    expect(route).not.toBeNull();
    expect(route?.detoured).toBe(false);
    expect(route?.length).toBeCloseTo(100, 0);
  });

  it("goes around a building instead of through it", () => {
    const building = box(40, -30, 60, 30);
    const grid = buildGrid(data({ buildings: [building] }), []);
    const route = new GridRouter(grid, { x: 0, z: 0 }).routeTo({ x: 100, z: 0 });
    expect(route?.detoured).toBe(true);
    expect(route?.length).toBeGreaterThan(100);
    expect(crosses(route?.points ?? [], building)).toBe(false);
  });

  it("will not cross water or a fence", () => {
    const water = box(40, -200, 60, 200);
    const fence = [80, -200, 80, 200];
    const grid = buildGrid(data({ water: [water], fences: [fence] }), []);
    // Walled in on both sides over the whole tall area: no way round within the grid margin
    // is shorter than a detour past the ends, but it must never cross either.
    const route = new GridRouter(grid, { x: 0, z: 0 }).routeTo({ x: 100, z: 0 });
    expect(route === null || route.length > 400).toBe(true);
    if (route) {
      expect(crosses(route.points, water)).toBe(false);
    }
  });

  it("does not slip through a diagonal gap in a fence", () => {
    // A staircase fence line that is only diagonally connected.
    const fence: number[] = [];
    for (let i = 0; i <= 40; i += 1) fence.push(i * 2, i * 2);
    const grid = buildGrid(data({ fences: [fence] }), []);
    const route = new GridRouter(grid, { x: 60, z: 20 }).routeTo({ x: 20, z: 60 });
    // Both sides of a long diagonal wall: crossing it directly would be ~57 m.
    expect(route === null || route.length > 70).toBe(true);
  });

  it("lets a start inside a building walk out of that building only", () => {
    const home = box(0, 0, 20, 20);
    const other = box(40, -10, 60, 30);
    const grid = buildGrid(data({ buildings: [home, other] }), []);
    const route = new GridRouter(grid, { x: 10, z: 10 }).routeTo({ x: 100, z: 10 });
    expect(route).not.toBeNull();
    expect(crosses(route?.points ?? [], other)).toBe(false);
    expect(route?.length).toBeGreaterThan(90);
  });

  it("walks out of a minefield it starts in, but avoids the others", () => {
    const here = [
      { x: -10, z: -10 },
      { x: 10, z: -10 },
      { x: 10, z: 10 },
      { x: -10, z: 10 },
    ];
    const ahead = [
      { x: 40, z: -25 },
      { x: 60, z: -25 },
      { x: 60, z: 25 },
      { x: 40, z: 25 },
    ];
    const grid = buildGrid(data({}), [here, ahead]);
    const route = new GridRouter(grid, { x: 0, z: 0 }).routeTo({ x: 100, z: 0 });
    expect(route).not.toBeNull();
    expect(route?.detoured).toBe(true);
    expect(crosses(route?.points ?? [], box(40, -25, 60, 25))).toBe(false);
  });

  it("reaches an exit inside a building by its nearest reachable edge", () => {
    const hut = box(80, -10, 100, 10);
    const grid = buildGrid(data({ buildings: [hut] }), []);
    const route = new GridRouter(grid, { x: 0, z: 0 }).routeTo({ x: 90, z: 0 });
    expect(route).not.toBeNull();
    expect(route?.points[route.points.length - 1]).toEqual({ x: 90, z: 0 });
  });

  it("returns null for an exit far outside the grid", () => {
    const grid = buildGrid(data({ buildings: [box(0, 0, 10, 10)] }), []);
    expect(new GridRouter(grid, { x: 5, z: 20 }).routeTo({ x: 5000, z: 5000 })).toBeNull();
  });

  it("covers an exit outside the drawn map when given its position", () => {
    const outside = { x: 400, z: 0 };
    const withoutPoint = buildGrid(data({ buildings: [box(0, 0, 10, 10)] }), []);
    expect(new GridRouter(withoutPoint, { x: 5, z: 20 }).routeTo(outside)).toBeNull();
    const withPoint = buildGrid(data({ buildings: [box(0, 0, 10, 10)] }), [], [outside]);
    expect(new GridRouter(withPoint, { x: 5, z: 20 }).routeTo(outside)).not.toBeNull();
  });
});
