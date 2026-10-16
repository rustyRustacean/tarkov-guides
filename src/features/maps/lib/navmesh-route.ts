import type { PathResult, Point } from "./exit-path";

/**
 * Routing over the game's own walkable-area mesh (Unity NavMesh polygons).
 *
 * The mesh says exactly where the game's AI can walk: it already excludes
 * walls, fences, props, water and anything else solid, and it connects through
 * doorways. A route is the shortest chain of polygons (Dijkstra over their
 * adjacency) pulled tight with the funnel algorithm, so it hugs corners
 * instead of wandering through polygon centres.
 *
 * Everything is in game space; the ground plane is x/z and `y` is only used to
 * pick between stacked floors that share an x/z.
 */

/** Wire format written by `scripts/navmesh/extract-navmesh.py`. */
export interface NavMeshData {
  /** x, y, z per vertex, flat. */
  verts: ArrayLike<number>;
  polys: readonly (readonly number[])[];
  /** Parallel to `polys`: per edge a polygon index, -1 for a wall, -2 for a tile-border edge. */
  nei: readonly (readonly number[])[];
}

/** A position, optionally with a height for choosing between floors. */
export interface NavPoint extends Point {
  y?: number | null | undefined;
}

interface Link {
  to: number;
  /** Portal endpoints (left/right are resolved when walking the corridor). */
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export interface NavMesh {
  readonly data: NavMeshData;
  /** Centroid per polygon (x, y, z). */
  readonly centre: Float64Array;
  readonly links: readonly (readonly Link[])[];
  /** Spatial hash: cell key -> polygon indices whose bounding box touches the cell. */
  readonly buckets: ReadonlyMap<number, readonly number[]>;
}

const BUCKET = 8; // metres
const EPS = 1e-3;

function bucketKey(cx: number, cz: number): number {
  return (cx + 32768) * 65536 + (cz + 32768);
}

/** Builds adjacency (including across tile borders) and the spatial index. */
export function buildNavMesh(
  data: NavMeshData,
  /** Gaps to bridge as walkable, `[x1, z1, x2, z2]` each (gates that were shut when the mesh was baked). */
  passages: readonly (readonly [number, number, number, number])[] = [],
): NavMesh {
  const { verts, polys, nei } = data;
  const count = polys.length;
  const centre = new Float64Array(count * 3);
  const links: Link[][] = Array.from({ length: count }, () => []);
  const buckets = new Map<number, number[]>();

  const vx = (i: number) => verts[i * 3] ?? 0;
  const vy = (i: number) => verts[i * 3 + 1] ?? 0;
  const vz = (i: number) => verts[i * 3 + 2] ?? 0;

  // Tile-border edges, grouped by the axis-aligned line they lie on.
  interface Border {
    poly: number;
    lo: number;
    hi: number;
    ax: number;
    az: number;
    bx: number;
    bz: number;
  }
  const borderLines = new Map<string, Border[]>();

  for (let p = 0; p < count; p += 1) {
    const poly = polys[p];
    const neighbours = nei[p];
    if (!poly || !neighbours) continue;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const v of poly) {
      cx += vx(v);
      cy += vy(v);
      cz += vz(v);
      minX = Math.min(minX, vx(v));
      maxX = Math.max(maxX, vx(v));
      minZ = Math.min(minZ, vz(v));
      maxZ = Math.max(maxZ, vz(v));
    }
    centre[p * 3] = cx / poly.length;
    centre[p * 3 + 1] = cy / poly.length;
    centre[p * 3 + 2] = cz / poly.length;

    const x0 = Math.floor(minX / BUCKET);
    const x1 = Math.floor(maxX / BUCKET);
    const z0 = Math.floor(minZ / BUCKET);
    const z1 = Math.floor(maxZ / BUCKET);
    for (let bx = x0; bx <= x1; bx += 1) {
      for (let bz = z0; bz <= z1; bz += 1) {
        const key = bucketKey(bx, bz);
        const list = buckets.get(key);
        if (list) list.push(p);
        else buckets.set(key, [p]);
      }
    }

    for (let e = 0; e < poly.length; e += 1) {
      const a = poly[e] ?? 0;
      const b = poly[(e + 1) % poly.length] ?? 0;
      const n = neighbours[e] ?? -1;
      if (n >= 0) {
        links[p]?.push({ to: n, ax: vx(a), az: vz(a), bx: vx(b), bz: vz(b) });
      } else if (n === -2) {
        const ax = vx(a);
        const az = vz(a);
        const bx = vx(b);
        const bz = vz(b);
        const alongZ = Math.abs(ax - bx) < EPS; // x = const
        const alongX = Math.abs(az - bz) < EPS; // z = const
        if (!alongZ && !alongX) continue;
        const key = alongZ
          ? `x${String(Math.round(ax * 100))}`
          : `z${String(Math.round(az * 100))}`;
        const lo = alongZ ? Math.min(az, bz) : Math.min(ax, bx);
        const hi = alongZ ? Math.max(az, bz) : Math.max(ax, bx);
        const list = borderLines.get(key);
        const entry = { poly: p, lo, hi, ax, az, bx, bz };
        if (list) list.push(entry);
        else borderLines.set(key, [entry]);
      }
    }
  }

  // Neighbouring tiles do not subdivide a shared border the same way, so match
  // by overlap of the intervals on the same line.
  for (const [key, edges] of borderLines) {
    const alongZ = key.startsWith("x");
    edges.sort((a, b) => a.lo - b.lo);
    for (let i = 0; i < edges.length; i += 1) {
      const a = edges[i];
      if (!a) continue;
      for (let j = i + 1; j < edges.length; j += 1) {
        const b = edges[j];
        if (!b || b.lo >= a.hi - EPS) break;
        if (a.poly === b.poly) continue;
        const lo = Math.max(a.lo, b.lo);
        const hi = Math.min(a.hi, b.hi);
        if (hi - lo < 0.05) continue;
        const fixed = alongZ ? a.ax : a.az;
        const portal = alongZ
          ? { ax: fixed, az: lo, bx: fixed, bz: hi }
          : { ax: lo, az: fixed, bx: hi, bz: fixed };
        links[a.poly]?.push({ to: b.poly, ...portal });
        links[b.poly]?.push({ to: a.poly, ...portal });
      }
    }
  }

  const mesh: NavMesh = { data, centre, links, buckets };
  bridgePassages(mesh, links, passages);
  return mesh;
}

/**
 * Connects the polygons on either side of each passage. The sides are sampled
 * a metre or so off the line (clear of the fence ends) at a few places along
 * it, and two polygons on about the same floor get a link whose portal is the
 * passage itself.
 */
function bridgePassages(
  mesh: NavMesh,
  links: Link[][],
  passages: readonly (readonly [number, number, number, number])[],
): void {
  const SIDE = 1.2;
  for (const [x1, z1, x2, z2] of passages) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < EPS) continue;
    // Unit normal to the gap.
    const nx = -(z2 - z1) / length;
    const nz = (x2 - x1) / length;
    for (const t of [0.25, 0.5, 0.75]) {
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      const sideA = locate(mesh, { x: px + nx * SIDE, z: pz + nz * SIDE }, 0.01);
      const sideB = locate(mesh, { x: px - nx * SIDE, z: pz - nz * SIDE }, 0.01);
      for (const a of sideA) {
        for (const b of sideB) {
          if (a.poly === b.poly) continue;
          const dy = Math.abs(
            (mesh.centre[a.poly * 3 + 1] ?? 0) - (mesh.centre[b.poly * 3 + 1] ?? 0),
          );
          if (dy > 1.5) continue;
          if ((links[a.poly] ?? []).some((l) => l.to === b.poly)) continue;
          links[a.poly]?.push({ to: b.poly, ax: x1, az: z1, bx: x2, bz: z2 });
          links[b.poly]?.push({ to: a.poly, ax: x1, az: z1, bx: x2, bz: z2 });
        }
      }
    }
  }
}

// ─── point location ────────────────────────────────────────────────────────

function insidePoly(mesh: NavMesh, p: number, x: number, z: number): boolean {
  const poly = mesh.data.polys[p];
  if (!poly) return false;
  const verts = mesh.data.verts;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i] ?? 0;
    const b = poly[j] ?? 0;
    const xi = verts[a * 3] ?? 0;
    const zi = verts[a * 3 + 2] ?? 0;
    const xj = verts[b * 3] ?? 0;
    const zj = verts[b * 3 + 2] ?? 0;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function nearestOnSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { x: number; z: number; d: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  const x = ax + dx * t;
  const z = az + dz * t;
  return { x, z, d: Math.hypot(px - x, pz - z) };
}

interface Located {
  poly: number;
  /** The point actually used: the query point, or its nearest point on the mesh. */
  x: number;
  z: number;
  /** Distance from the query to the mesh point (0 when it was inside). */
  off: number;
}

/**
 * Polygons under a point (several when floors stack). When the point is off
 * the mesh, snaps to the nearest mesh point within `snap` metres.
 */
export function locate(mesh: NavMesh, point: NavPoint, snap = 6): Located[] {
  const cx = Math.floor(point.x / BUCKET);
  const cz = Math.floor(point.z / BUCKET);
  const here = mesh.buckets.get(bucketKey(cx, cz)) ?? [];
  const found: Located[] = [];
  for (const p of here) {
    if (insidePoly(mesh, p, point.x, point.z))
      found.push({ poly: p, x: point.x, z: point.z, off: 0 });
  }
  if (found.length > 0) {
    if (point.y != null && found.length > 1) {
      found.sort(
        (a, b) =>
          Math.abs((mesh.centre[a.poly * 3 + 1] ?? 0) - (point.y ?? 0)) -
          Math.abs((mesh.centre[b.poly * 3 + 1] ?? 0) - (point.y ?? 0)),
      );
    }
    return found;
  }

  // Off the mesh: nearest edge point among polygons in the surrounding buckets.
  const reach = Math.ceil(snap / BUCKET);
  let best: Located | null = null;
  const verts = mesh.data.verts;
  for (let dx = -reach; dx <= reach; dx += 1) {
    for (let dz = -reach; dz <= reach; dz += 1) {
      for (const p of mesh.buckets.get(bucketKey(cx + dx, cz + dz)) ?? []) {
        const poly = mesh.data.polys[p];
        if (!poly) continue;
        for (let i = 0; i < poly.length; i += 1) {
          const a = poly[i] ?? 0;
          const b = poly[(i + 1) % poly.length] ?? 0;
          const hit = nearestOnSegment(
            point.x,
            point.z,
            verts[a * 3] ?? 0,
            verts[a * 3 + 2] ?? 0,
            verts[b * 3] ?? 0,
            verts[b * 3 + 2] ?? 0,
          );
          if (hit.d <= snap && (best === null || hit.d < best.off)) {
            best = { poly: p, x: hit.x, z: hit.z, off: hit.d };
          }
        }
      }
    }
  }
  return best ? [best] : [];
}

/** True when the point is inside the polygon or within `tol` metres of its boundary. */
function nearPoly(mesh: NavMesh, p: number, x: number, z: number, tol = 0.04): boolean {
  if (insidePoly(mesh, p, x, z)) return true;
  const poly = mesh.data.polys[p];
  if (!poly) return false;
  const verts = mesh.data.verts;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i] ?? 0;
    const b = poly[(i + 1) % poly.length] ?? 0;
    const hit = nearestOnSegment(
      x,
      z,
      verts[a * 3] ?? 0,
      verts[a * 3 + 2] ?? 0,
      verts[b * 3] ?? 0,
      verts[b * 3 + 2] ?? 0,
    );
    if (hit.d <= tol) return true;
  }
  return false;
}

/**
 * Can the straight segment a -> b be walked without leaving the mesh?
 *
 * Walks along it in small steps, and at each step the point must lie in the
 * current polygon or one reachable in two hops of adjacency. Following
 * adjacency (rather than asking "is this x/z on the mesh at all") is what stops
 * a shortcut from hopping between stacked floors that merely share an x/z.
 */
function segmentWalkable(mesh: NavMesh, start: number, a: Point, b: Point, step = 0.25): boolean {
  let current = start;
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / step));
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (nearPoly(mesh, current, x, z)) continue;
    let moved = -1;
    for (const first of mesh.links[current] ?? []) {
      if (nearPoly(mesh, first.to, x, z)) {
        moved = first.to;
        break;
      }
    }
    if (moved < 0) {
      for (const first of mesh.links[current] ?? []) {
        for (const second of mesh.links[first.to] ?? []) {
          if (nearPoly(mesh, second.to, x, z)) {
            moved = second.to;
            break;
          }
        }
        if (moved >= 0) break;
      }
    }
    if (moved < 0) return false;
    current = moved;
  }
  return true;
}

// ─── search ────────────────────────────────────────────────────────────────

class MinHeap {
  private keys: number[] = [];
  private items: number[] = [];
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
 * Twice the signed area of triangle (a, b, c) on the x/z plane: positive when
 * c lies counter-clockwise of the ray a -> b. In this convention "left" is the
 * counter-clockwise side and "right" the clockwise one.
 */
const triArea2 = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) =>
  (bx - ax) * (cz - az) - (bz - az) * (cx - ax);

/**
 * The simple stupid funnel algorithm over a sequence of portals.
 * Portals are given as [left, right] pairs in travel order.
 */
function funnel(
  start: Point,
  end: Point,
  portals: readonly { lx: number; lz: number; rx: number; rz: number }[],
): Point[] {
  const all = [
    { lx: start.x, lz: start.z, rx: start.x, rz: start.z },
    ...portals,
    { lx: end.x, lz: end.z, rx: end.x, rz: end.z },
  ];
  const path: Point[] = [start];
  let apexX = start.x;
  let apexZ = start.z;
  let leftX = start.x;
  let leftZ = start.z;
  let rightX = start.x;
  let rightZ = start.z;
  let apexIndex = 0;
  let leftIndex = 0;
  let rightIndex = 0;

  for (let i = 1; i < all.length; i += 1) {
    const portal = all[i];
    if (!portal) continue;
    // Tighten the right side.
    if (triArea2(apexX, apexZ, rightX, rightZ, portal.rx, portal.rz) >= 0) {
      const sameApex = Math.abs(apexX - rightX) < EPS && Math.abs(apexZ - rightZ) < EPS;
      if (sameApex || triArea2(apexX, apexZ, leftX, leftZ, portal.rx, portal.rz) < 0) {
        rightX = portal.rx;
        rightZ = portal.rz;
        rightIndex = i;
      } else {
        path.push({ x: leftX, z: leftZ });
        apexX = leftX;
        apexZ = leftZ;
        apexIndex = leftIndex;
        leftX = apexX;
        leftZ = apexZ;
        rightX = apexX;
        rightZ = apexZ;
        leftIndex = apexIndex;
        rightIndex = apexIndex;
        i = apexIndex;
        continue;
      }
    }
    // Tighten the left side.
    if (triArea2(apexX, apexZ, leftX, leftZ, portal.lx, portal.lz) <= 0) {
      const sameApex = Math.abs(apexX - leftX) < EPS && Math.abs(apexZ - leftZ) < EPS;
      if (sameApex || triArea2(apexX, apexZ, rightX, rightZ, portal.lx, portal.lz) > 0) {
        leftX = portal.lx;
        leftZ = portal.lz;
        leftIndex = i;
      } else {
        path.push({ x: rightX, z: rightZ });
        apexX = rightX;
        apexZ = rightZ;
        apexIndex = rightIndex;
        leftX = apexX;
        leftZ = apexZ;
        rightX = apexX;
        rightZ = apexZ;
        leftIndex = apexIndex;
        rightIndex = apexIndex;
        i = apexIndex;
      }
    }
  }
  path.push(end);
  return path;
}

/** Shortest paths from one start to every polygon, then read back per exit. */
export class NavRouter {
  private readonly dist: Float64Array;
  private readonly parent: Int32Array;
  private readonly via: Int32Array;
  private readonly posX: Float64Array;
  private readonly posZ: Float64Array;
  private readonly start: NavPoint;
  private readonly startPoly: number;
  private readonly startOn: Located | null;

  constructor(
    private readonly mesh: NavMesh,
    start: NavPoint,
  ) {
    const count = mesh.data.polys.length;
    this.start = start;
    this.dist = new Float64Array(count).fill(Infinity);
    this.parent = new Int32Array(count).fill(-1);
    this.via = new Int32Array(count).fill(-1);
    const located = locate(mesh, start, 10);
    this.startOn = located[0] ?? null;
    this.startPoly = this.startOn?.poly ?? -1;
    const heap = new MinHeap();
    // Where each polygon was entered: the start for the first one, the middle of
    // the crossed edge after that. Costs are measured between these points
    // (as Detour does), not between polygon centres, which on a regular grid
    // would pick staircase corridors that the straight line cannot fit inside.
    this.posX = new Float64Array(count);
    this.posZ = new Float64Array(count);
    // Every floor under the start is a candidate; the shortest wins per exit.
    for (const entry of located) {
      this.dist[entry.poly] = 0;
      this.posX[entry.poly] = entry.x;
      this.posZ[entry.poly] = entry.z;
      heap.push(0, entry.poly);
    }
    for (let top = heap.pop(); top !== null; top = heap.pop()) {
      const at = top.item;
      if (top.key > (this.dist[at] ?? Infinity)) continue;
      const out = mesh.links[at] ?? [];
      const fromX = this.posX[at] ?? 0;
      const fromZ = this.posZ[at] ?? 0;
      for (let k = 0; k < out.length; k += 1) {
        const link = out[k];
        if (!link) continue;
        const to = link.to;
        const midX = (link.ax + link.bx) / 2;
        const midZ = (link.az + link.bz) / 2;
        const candidate = top.key + Math.hypot(fromX - midX, fromZ - midZ);
        if (candidate < (this.dist[to] ?? Infinity)) {
          this.dist[to] = candidate;
          this.parent[to] = at;
          this.via[to] = k;
          this.posX[to] = midX;
          this.posZ[to] = midZ;
          heap.push(candidate, to);
        }
      }
    }
  }

  /**
   * Skips corners the funnel kept only because the corridor was a staircase:
   * from each corner, jump to the furthest later corner the straight segment
   * can reach while staying on the mesh.
   */
  private shortcut(points: readonly Point[], chain: readonly number[]): Point[] {
    if (points.length <= 2) return [...points];
    const startPolyFor = (point: Point): number => {
      for (const p of chain) if (nearPoly(this.mesh, p, point.x, point.z)) return p;
      return -1;
    };
    const out: Point[] = [];
    let i = 0;
    const first = points[0];
    if (first) out.push(first);
    while (i < points.length - 1) {
      const here = points[i];
      const poly = here ? startPolyFor(here) : -1;
      let next = i + 1;
      if (here && poly >= 0) {
        for (let j = points.length - 1; j > i + 1; j -= 1) {
          const target = points[j];
          if (target && segmentWalkable(this.mesh, poly, here, target)) {
            next = j;
            break;
          }
        }
      }
      const picked = points[next];
      if (picked) out.push(picked);
      i = next;
    }
    return out;
  }

  /** The route to `end`, or `null` when it is off the mesh or not connected to the start. */
  routeTo(end: NavPoint): PathResult | null {
    if (this.startPoly < 0 || this.startOn === null) return null;
    const targets = locate(this.mesh, end, 6);
    let target: Located | null = null;
    let best = Infinity;
    for (const t of targets) {
      const reach = this.dist[t.poly] ?? Infinity;
      if (reach === Infinity) continue;
      const total =
        reach + Math.hypot((this.posX[t.poly] ?? 0) - t.x, (this.posZ[t.poly] ?? 0) - t.z);
      if (target === null || total < best) {
        target = t;
        best = total;
      }
    }
    if (target === null) return null;

    const chain: number[] = [];
    const viaIndex: number[] = [];
    for (let at = target.poly; at !== -1; at = this.parent[at] ?? -1) {
      chain.push(at);
      viaIndex.push(this.via[at] ?? -1);
    }
    chain.reverse();
    viaIndex.reverse();

    // Portals in travel order, oriented left/right of the direction of travel.
    const portals: { lx: number; lz: number; rx: number; rz: number }[] = [];
    for (let i = 1; i < chain.length; i += 1) {
      const from = chain[i - 1];
      const k = viaIndex[i];
      if (from === undefined || k === undefined || k < 0) continue;
      const link = this.mesh.links[from]?.[k];
      if (!link) continue;
      const fx = this.mesh.centre[from * 3] ?? 0;
      const fz = this.mesh.centre[from * 3 + 2] ?? 0;
      // Which endpoint is on the left when facing from the polygon centre across the edge.
      const cross = triArea2(fx, fz, link.ax, link.az, link.bx, link.bz);
      if (cross > 0) portals.push({ lx: link.bx, lz: link.bz, rx: link.ax, rz: link.az });
      else portals.push({ lx: link.ax, lz: link.az, rx: link.bx, rz: link.bz });
    }

    const from: Point = { x: this.start.x, z: this.start.z };
    const to: Point = { x: end.x, z: end.z };
    // Start/end on the mesh edge when the real point was off it.
    const a: Point = { x: this.startOn.x, z: this.startOn.z };
    const b: Point = { x: target.x, z: target.z };
    const tight = funnel(a, b, portals);
    const core = this.shortcut(tight, chain);
    const points = [from, ...core.slice(1, -1), to];
    if (a.x !== from.x || a.z !== from.z) points.splice(1, 0, a);
    if (b.x !== to.x || b.z !== to.z) points.splice(points.length - 1, 0, b);

    let length = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p = points[i];
      const q = points[i + 1];
      if (p && q) length += Math.hypot(p.x - q.x, p.z - q.z);
    }
    const straight = Math.hypot(from.x - to.x, from.z - to.z);
    return { points, length, detoured: length > straight * 1.03 + 3 };
  }
}
