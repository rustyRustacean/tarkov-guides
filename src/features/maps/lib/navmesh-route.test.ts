import { describe, expect, it } from "vitest";

import { buildNavMesh, locate, NavRouter, type NavMeshData } from "./navmesh-route";

/**
 * A grid of `size` metre squares, `cols` x `rows`, with some cells removed
 * (walls). Neighbours are linked internally; `tileEvery` columns the grid is
 * split into "tiles" whose shared edges are flagged -2 (border) the way the
 * real data is, to exercise the geometric matching.
 */
function gridMesh(
  cols: number,
  rows: number,
  size: number,
  removed: ReadonlySet<string> = new Set(),
  tileEvery = 0,
): NavMeshData {
  const verts: number[] = [];
  const vertIndex = new Map<string, number>();
  const vert = (x: number, z: number): number => {
    const key = `${String(x)},${String(z)}`;
    let at = vertIndex.get(key);
    if (at === undefined) {
      at = verts.length / 3;
      verts.push(x, 0, z);
      vertIndex.set(key, at);
    }
    return at;
  };
  const polys: number[][] = [];
  const cellPoly = new Map<string, number>();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (removed.has(`${String(c)},${String(r)}`)) continue;
      const x = c * size;
      const z = r * size;
      // Counter-clockwise: (x,z) -> (x+s,z) -> (x+s,z+s) -> (x,z+s)
      polys.push([vert(x, z), vert(x + size, z), vert(x + size, z + size), vert(x, z + size)]);
      cellPoly.set(`${String(c)},${String(r)}`, polys.length - 1);
    }
  }
  const nei: number[][] = polys.map(() => []);
  for (const [key, p] of cellPoly) {
    const [cs, rs] = key.split(",");
    const c = Number(cs);
    const r = Number(rs);
    // Edge order matches the vertex order above: south, east, north, west.
    const sides: [number, number][] = [
      [c, r - 1],
      [c + 1, r],
      [c, r + 1],
      [c - 1, r],
    ];
    nei[p] = sides.map(([nc, nr], edge) => {
      const other = cellPoly.get(`${String(nc)},${String(nr)}`);
      if (other === undefined) return -1;
      const crossesTile =
        tileEvery > 0 &&
        (edge === 1 || edge === 3) &&
        Math.floor(c / tileEvery) !== Math.floor(nc / tileEvery);
      return crossesTile ? -2 : other;
    });
  }
  return { verts, polys, nei };
}

describe("buildNavMesh / NavRouter", () => {
  it("goes straight across open ground", () => {
    const mesh = buildNavMesh(gridMesh(10, 10, 10));
    const route = new NavRouter(mesh, { x: 5, z: 5 }).routeTo({ x: 95, z: 5 });
    expect(route).not.toBeNull();
    expect(route?.length).toBeCloseTo(90, 0);
    expect(route?.detoured).toBe(false);
  });

  it("goes around a wall and pulls the path tight to its corner", () => {
    // A wall of removed cells at column 5, rows 0..7: the gap is rows 8-9.
    const removed = new Set(Array.from({ length: 8 }, (_, r) => `5,${String(r)}`));
    const mesh = buildNavMesh(gridMesh(10, 10, 10, removed));
    const route = new NavRouter(mesh, { x: 5, z: 5 }).routeTo({ x: 95, z: 5 });
    expect(route?.detoured).toBe(true);
    // Tight over the wall tip: (5,5) -> (50,80) -> (60,80) -> (95,5).
    const expected = Math.hypot(45, 75) + 10 + Math.hypot(35, 75);
    expect(route?.length).toBeGreaterThan(expected - 1);
    expect(route?.length).toBeLessThan(expected + 1);
    // Never inside a removed cell.
    for (const point of route?.points ?? []) {
      const inWall = point.x > 50 && point.x < 60 && point.z < 80;
      expect(inWall).toBe(false);
    }
  });

  it("returns null when the exit is sealed off", () => {
    const removed = new Set(Array.from({ length: 10 }, (_, r) => `5,${String(r)}`));
    const mesh = buildNavMesh(gridMesh(10, 10, 10, removed));
    expect(new NavRouter(mesh, { x: 5, z: 5 }).routeTo({ x: 95, z: 5 })).toBeNull();
  });

  it("links polygons across tile borders by geometry", () => {
    const mesh = buildNavMesh(gridMesh(10, 4, 10, new Set(), 5));
    const route = new NavRouter(mesh, { x: 5, z: 5 }).routeTo({ x: 95, z: 25 });
    expect(route).not.toBeNull();
    expect(route?.length).toBeCloseTo(Math.hypot(90, 20), 0);
  });

  it("snaps a start standing just off the mesh", () => {
    const mesh = buildNavMesh(gridMesh(10, 10, 10));
    const route = new NavRouter(mesh, { x: -3, z: 5 }).routeTo({ x: 95, z: 5 });
    expect(route).not.toBeNull();
    expect(route?.points[0]).toEqual({ x: -3, z: 5 });
  });

  it("does not snap far off the mesh", () => {
    const mesh = buildNavMesh(gridMesh(10, 10, 10));
    expect(new NavRouter(mesh, { x: -300, z: 5 }).routeTo({ x: 95, z: 5 })).toBeNull();
  });
});

describe("locate", () => {
  it("returns every stacked floor, closest in height first", () => {
    // Two squares on the same x/z at different heights.
    const verts = [0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10, 0, 5, 0, 10, 5, 0, 10, 5, 10, 0, 5, 10];
    const mesh = buildNavMesh({
      verts,
      polys: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
      nei: [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
      ],
    });
    const found = locate(mesh, { x: 5, z: 5, y: 5 });
    expect(found.map((f) => f.poly)).toEqual([1, 0]);
  });
});
