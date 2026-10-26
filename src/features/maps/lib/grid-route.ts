import { MAX_GRID_CELLS } from "./route-limits";

import type { PathResult, Point } from "./exit-path";

/**
 * Obstacle-aware routing over a coarse grid.
 *
 * The obstacles come from the map SVGs (`scripts/build-map-obstacles.mjs`):
 * ground-level buildings, water, fences and the map border, in game meters.
 * Minefield polygons from the map data are added on top. What it does NOT
 * know: doors, gaps in fences, floors above or below ground, climbable walls
 * and ledges. A fence is treated as solid, so a route may go further than
 * strictly needed; it should never cross something solid.
 */

/** One map's obstacle layers; polygons/lines are flat `[x0, z0, x1, z1, ...]`. */
export interface ObstacleData {
  map: string;
  buildings: readonly (readonly number[])[];
  water: readonly (readonly number[])[];
  fences: readonly (readonly number[])[];
  limit: readonly (readonly number[])[];
}

const BUILDING = 1;
const WATER = 2;
const LINE = 4;
const MINE = 8;

/** Cell size in meters. 2 m keeps the biggest map near 400k cells. */
const CELL = 2;
/** Grid margin around the obstacle bounds, in meters. */
const MARGIN = 80;
const SQRT2 = Math.SQRT2;

export interface Grid {
  minX: number;
  minZ: number;
  w: number;
  h: number;
  /** Bit flags per cell: building, water, line (fence/border), mine. */
  flags: Uint8Array;
  /** Which polygon (building or minefield) owns a cell, 0 for none. Lets a start inside one walk out of it. */
  owner: Int32Array;
  /** Every building/minefield polygon by owner id (index = id - 1), for "which one is the start in". */
  polygons: readonly (readonly number[])[];
}

function pointInFlat(x: number, z: number, poly: readonly number[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i] ?? 0;
    const zi = poly[i + 1] ?? 0;
    const xj = poly[j] ?? 0;
    const zj = poly[j + 1] ?? 0;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function fillPolygon(grid: Grid, poly: readonly number[], flag: number, ownerId: number): void {
  if (poly.length < 6) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    minX = Math.min(minX, poly[i] ?? 0);
    maxX = Math.max(maxX, poly[i] ?? 0);
    minZ = Math.min(minZ, poly[i + 1] ?? 0);
    maxZ = Math.max(maxZ, poly[i + 1] ?? 0);
  }
  const cx0 = Math.max(0, Math.floor((minX - grid.minX) / CELL));
  const cx1 = Math.min(grid.w - 1, Math.floor((maxX - grid.minX) / CELL));
  const cz0 = Math.max(0, Math.floor((minZ - grid.minZ) / CELL));
  const cz1 = Math.min(grid.h - 1, Math.floor((maxZ - grid.minZ) / CELL));
  for (let cz = cz0; cz <= cz1; cz += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      const x = grid.minX + (cx + 0.5) * CELL;
      const z = grid.minZ + (cz + 0.5) * CELL;
      if (pointInFlat(x, z, poly)) {
        const at = cz * grid.w + cx;
        grid.flags[at] = (grid.flags[at] ?? 0) | flag;
        if (ownerId > 0) grid.owner[at] = ownerId;
      }
    }
  }
  // Centre-in-polygon alone lets a thin building slip between cells (a 3 m
  // hut can miss every cell centre). Every cell the outline passes through is
  // blocked too, so a "free" cell never holds any part of the polygon.
  drawLine(grid, poly, flag, ownerId, true);
}

function drawLine(
  grid: Grid,
  line: readonly number[],
  flag: number,
  ownerId = 0,
  closed = false,
): void {
  const points = line.length / 2;
  const edges = closed ? points : points - 1;
  for (let edge = 0; edge < edges; edge += 1) {
    const i = edge * 2;
    const j = ((edge + 1) % points) * 2;
    const x0 = line[i] ?? 0;
    const z0 = line[i + 1] ?? 0;
    const x1 = line[j] ?? 0;
    const z1 = line[j + 1] ?? 0;
    // A quarter-cell step so a thin line cannot hop over a cell.
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 4)));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const cx = Math.floor((x0 + (x1 - x0) * t - grid.minX) / CELL);
      const cz = Math.floor((z0 + (z1 - z0) * t - grid.minZ) / CELL);
      if (cx < 0 || cz < 0 || cx >= grid.w || cz >= grid.h) continue;
      const at = cz * grid.w + cx;
      grid.flags[at] = (grid.flags[at] ?? 0) | flag;
      if (ownerId > 0) grid.owner[at] = ownerId;
    }
  }
}

/** Rasterizes the obstacle layers and any minefield polygons into one grid. */
export function buildGrid(
  data: ObstacleData,
  minefields: readonly (readonly { x: number; z: number }[])[],
  /** Points the grid must cover even when the SVG does not (exits outside the drawn area, such as flare and sniper exits). */
  extraPoints: readonly { x: number; z: number }[] = [],
): Grid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const widen = (list: readonly (readonly number[])[]) => {
    for (const flat of list) {
      for (let i = 0; i < flat.length; i += 2) {
        minX = Math.min(minX, flat[i] ?? 0);
        maxX = Math.max(maxX, flat[i] ?? 0);
        minZ = Math.min(minZ, flat[i + 1] ?? 0);
        maxZ = Math.max(maxZ, flat[i + 1] ?? 0);
      }
    }
  };
  widen(data.buildings);
  widen(data.water);
  widen(data.fences);
  widen(data.limit);
  for (const mine of minefields) {
    for (const p of mine) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
  }
  for (const p of extraPoints) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 1;
    minZ = 0;
    maxZ = 1;
  }
  minX -= MARGIN;
  minZ -= MARGIN;
  const w = Math.ceil((maxX + MARGIN - minX) / CELL);
  const h = Math.ceil((maxZ + MARGIN - minZ) / CELL);
  // Refuse before allocating: the arrays below are 5 bytes per cell, and each route adds 12 more.
  if (!(w * h <= MAX_GRID_CELLS)) {
    throw new RangeError(`obstacle grid too large (${String(w)} x ${String(h)} cells)`);
  }
  const polygons: (readonly number[])[] = [];
  const grid: Grid = {
    minX,
    minZ,
    w,
    h,
    flags: new Uint8Array(w * h),
    owner: new Int32Array(w * h),
    polygons,
  };

  for (const poly of data.water) fillPolygon(grid, poly, WATER, 0);
  for (const poly of data.buildings) {
    polygons.push(poly);
    fillPolygon(grid, poly, BUILDING, polygons.length);
  }
  for (const mine of minefields) {
    const flat = mine.flatMap((p) => [p.x, p.z]);
    polygons.push(flat);
    fillPolygon(grid, flat, MINE, polygons.length);
  }
  for (const line of data.fences) drawLine(grid, line, LINE);
  for (const line of data.limit) drawLine(grid, line, LINE);
  return grid;
}

// ─── search ────────────────────────────────────────────────────────────────

class MinHeap {
  private keys: number[] = [];
  private items: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(key: number, item: number): void {
    let i = this.items.length;
    this.keys.push(key);
    this.items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.keys[parent] ?? 0) <= key) break;
      this.keys[i] = this.keys[parent] ?? 0;
      this.items[i] = this.items[parent] ?? 0;
      i = parent;
    }
    this.keys[i] = key;
    this.items[i] = item;
  }
  pop(): { key: number; item: number } | null {
    const n = this.items.length;
    if (n === 0) return null;
    const topKey = this.keys[0] ?? 0;
    const topItem = this.items[0] ?? 0;
    const lastKey = this.keys.pop() ?? 0;
    const lastItem = this.items.pop() ?? 0;
    if (n > 1) {
      let i = 0;
      const half = (n - 1) >> 1;
      while (i < half) {
        let child = 2 * i + 1;
        if (child + 1 < n - 1 && (this.keys[child + 1] ?? 0) < (this.keys[child] ?? 0)) child += 1;
        if ((this.keys[child] ?? 0) >= lastKey) break;
        this.keys[i] = this.keys[child] ?? 0;
        this.items[i] = this.items[child] ?? 0;
        i = child;
      }
      this.keys[i] = lastKey;
      this.items[i] = lastItem;
    }
    return { key: topKey, item: topItem };
  }
}

/**
 * Distances from one start to every reachable cell, computed once; then each
 * exit's path is read back from it. A start inside a building or a minefield
 * is allowed to walk out of that one polygon (it would otherwise be boxed in
 * by its own footprint), which gives the side-facing-the-exit behaviour.
 */
export class GridRouter {
  private readonly dist: Float64Array;
  private readonly parent: Int32Array;
  private readonly free: Set<number>;
  private readonly start: Point;
  private readonly startCell: number;

  constructor(
    private readonly grid: Grid,
    start: Point,
  ) {
    this.start = start;
    this.free = new Set<number>();
    for (let id = 1; id <= grid.polygons.length; id += 1) {
      const poly = grid.polygons[id - 1];
      if (poly && pointInFlat(start.x, start.z, poly)) this.free.add(id);
    }
    this.dist = new Float64Array(grid.w * grid.h).fill(Infinity);
    this.parent = new Int32Array(grid.w * grid.h).fill(-1);
    this.startCell = this.nearestPassable(this.cellOf(start.x, start.z), 6);
    this.search();
  }

  private cellOf(x: number, z: number): number {
    const cx = Math.floor((x - this.grid.minX) / CELL);
    const cz = Math.floor((z - this.grid.minZ) / CELL);
    if (cx < 0 || cz < 0 || cx >= this.grid.w || cz >= this.grid.h) return -1;
    return cz * this.grid.w + cx;
  }

  /** `at` itself if it can be stood on, else the closest free cell within `radiusCells`, else -1. */
  private nearestPassable(at: number, radiusCells: number): number {
    if (at < 0) return -1;
    if (this.passable(at)) return at;
    const { w, h } = this.grid;
    const bx = at % w;
    const bz = (at - bx) / w;
    let best = -1;
    let bestDist = Infinity;
    for (let dz = -radiusCells; dz <= radiusCells; dz += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        const nx = bx + dx;
        const nz = bz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const cell = nz * w + nx;
        if (!this.passable(cell)) continue;
        const d = Math.hypot(dx, dz);
        if (d < bestDist) {
          bestDist = d;
          best = cell;
        }
      }
    }
    return best;
  }

  private passable(at: number): boolean {
    const flags = this.grid.flags[at] ?? 0;
    if (flags === 0) return true;
    // Only solid layers (water, fences/border) block outright; a building or
    // minefield blocks unless the start is inside that very polygon.
    if ((flags & (WATER | LINE)) !== 0) return false;
    const owner = this.grid.owner[at] ?? 0;
    return owner !== 0 && this.free.has(owner);
  }

  private search(): void {
    if (this.startCell < 0) return;
    const { w, h } = this.grid;
    const heap = new MinHeap();
    this.dist[this.startCell] = 0;
    heap.push(0, this.startCell);
    // A start standing on a fence line or the shore is let off its own cell.
    const neighbours: readonly [number, number, number][] = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, SQRT2],
      [1, -1, SQRT2],
      [-1, 1, SQRT2],
      [-1, -1, SQRT2],
    ];
    for (let top = heap.pop(); top !== null; top = heap.pop()) {
      const at = top.item;
      if (top.key > (this.dist[at] ?? Infinity)) continue;
      const cx = at % w;
      const cz = (at - cx) / w;
      for (const [dx, dz, cost] of neighbours) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const next = nz * w + nx;
        if (!this.passable(next) && next !== this.startCell) continue;
        // No cutting a corner between two blocked cells (a diagonal gap in a fence).
        if (dx !== 0 && dz !== 0) {
          if (!this.passable(cz * w + nx) && !this.passable(nz * w + cx)) continue;
        }
        const candidate = top.key + cost;
        if (candidate < (this.dist[next] ?? Infinity)) {
          this.dist[next] = candidate;
          this.parent[next] = at;
          heap.push(candidate, next);
        }
      }
    }
  }

  /** The nearest cell the search reached, within `radiusCells` of `at` (an exit inside a building, say). */
  private nearestReached(x: number, z: number, radiusCells: number): number {
    const base = this.cellOf(x, z);
    if (base < 0) return -1;
    if ((this.dist[base] ?? Infinity) !== Infinity) return base;
    const { w, h } = this.grid;
    const bx = base % w;
    const bz = (base - bx) / w;
    let best = -1;
    let bestDist = Infinity;
    for (let dz = -radiusCells; dz <= radiusCells; dz += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
        const nx = bx + dx;
        const nz = bz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const at = nz * w + nx;
        if ((this.dist[at] ?? Infinity) === Infinity) continue;
        const d = Math.hypot(dx, dz);
        if (d < bestDist) {
          bestDist = d;
          best = at;
        }
      }
    }
    return best;
  }

  private centre(at: number): Point {
    const cx = at % this.grid.w;
    const cz = (at - cx) / this.grid.w;
    return {
      x: this.grid.minX + (cx + 0.5) * CELL,
      z: this.grid.minZ + (cz + 0.5) * CELL,
    };
  }

  /**
   * Is the straight run between two cells free of blocked cells?
   *
   * Conservative on purpose: a sample near a cell edge or corner also tests
   * the neighbours across it. A thin diagonal wall is a chain of blocked cells
   * that only touch at corners, and a plain "which cell is this point in"
   * check passes straight between them.
   */
  private clear(a: number, b: number): boolean {
    const { w, h } = this.grid;
    const ax = a % w;
    const az = (a - ax) / w;
    const bx = b % w;
    const bz = (b - bx) / w;
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 8;
    const NEAR = 0.2;
    for (let s = 0; s <= steps; s += 1) {
      const t = steps === 0 ? 0 : s / steps;
      const u = ax + (bx - ax) * t;
      const v = az + (bz - az) * t;
      const i0 = Math.floor(u + 0.5);
      const j0 = Math.floor(v + 0.5);
      const fu = u + 0.5 - i0;
      const fv = v + 0.5 - j0;
      const xs = [i0];
      if (fu < NEAR) xs.push(i0 - 1);
      if (fu > 1 - NEAR) xs.push(i0 + 1);
      const zs = [j0];
      if (fv < NEAR) zs.push(j0 - 1);
      if (fv > 1 - NEAR) zs.push(j0 + 1);
      for (const x of xs) {
        for (const z of zs) {
          if (x < 0 || z < 0 || x >= w || z >= h) return false;
          if (!this.passable(z * w + x)) return false;
        }
      }
    }
    return true;
  }

  /** Route to `end`, or `null` when it cannot be reached on the grid. */
  routeTo(end: Point): PathResult | null {
    if (this.startCell < 0) return null;
    // An exit inside a building or fenced off is approached to its nearest reachable cell.
    // Reaching "nearby" far away is only acceptable for an exit that really is
    // inside a building or minefield polygon: the last leg then crosses that
    // interior. An exit on open ground that merely sits next to a wall gets a
    // cell or two, never a long straight run through something.
    const inside = this.grid.polygons.some((poly) => pointInFlat(end.x, end.z, poly));
    const target = this.nearestReached(end.x, end.z, inside ? 40 : 3);
    if (target < 0) return null;

    const cells: number[] = [];
    for (let at = target; at !== -1; at = this.parent[at] ?? -1) cells.push(at);
    cells.reverse();

    // String-pulling: keep only the corners a straight run cannot skip.
    const kept: number[] = [cells[0] ?? this.startCell];
    let anchor = 0;
    for (let i = 2; i < cells.length; i += 1) {
      const from = cells[anchor];
      const to = cells[i];
      if (from === undefined || to === undefined) continue;
      if (!this.clear(from, to)) {
        const previous = cells[i - 1];
        if (previous !== undefined) kept.push(previous);
        anchor = i - 1;
      }
    }
    const lastCell = cells[cells.length - 1];
    if (lastCell !== undefined && lastCell !== kept[kept.length - 1]) kept.push(lastCell);

    const points: Point[] = [this.start];
    for (const cell of kept.slice(1, -1)) points.push(this.centre(cell));
    // Finish on the real exit position, not its cell centre.
    points.push(end);

    let length = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (a && b) length += Math.hypot(a.x - b.x, a.z - b.z);
    }
    const straight = Math.hypot(this.start.x - end.x, this.start.z - end.z);
    return { points, length, detoured: length > straight * 1.03 + 3 };
  }
}
