import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { routeAround, type PathResult, type Point, type RouteTarget } from "../lib/exit-path";
import { buildGrid, GridRouter, type Grid, type ObstacleData } from "../lib/grid-route";
import { boundsOf, withinBounds, type Bounds } from "../lib/map-bounds";
import { hasNavMesh } from "../lib/map-navmesh";
import { loadObstacles } from "../lib/map-obstacles";
import { parseNavMesh } from "../lib/navmesh-format";
import { buildNavMesh, NavRouter, type NavMesh } from "../lib/navmesh-route";
import { findFenceGaps } from "../lib/passages";
import { FAILURE_MEMORY_MS, FETCH_TIMEOUT_MS, MAP_EDGE_MARGIN_M } from "../lib/route-limits";

import { getMapRouteData, NO_MAP_DATA, type MapRouteData } from "./map-route-data";

/**
 * Server-side walking routes. The game's walkable mesh lives only here: it is
 * read from disk (`NAVMESH_DIR`, default `private/navmesh`) or fetched from a
 * private location (`NAVMESH_BASE_URL`, optional `NAVMESH_TOKEN`), and never
 * sent to a browser. Callers get back only the route they asked for.
 *
 * Exits and minefields are the server's own (`map-route-data.ts`): a request
 * carries only a map, a start and the targets, so it cannot change what other
 * requests are routed around.
 */

// ─── mesh ──────────────────────────────────────────────────────────────────

interface MeshEntry {
  mesh: Promise<NavMesh | null>;
  /** Set once a load came back empty or failed: until then the answer is not retried. */
  retryAt: number | null;
}

/** One loaded mesh per map per server instance: building one costs far more than a route. */
const MESHES = new Map<string, MeshEntry>();

async function readMeshBytes(map: string): Promise<Buffer | null> {
  const dir = process.env.NAVMESH_DIR ?? path.join(process.cwd(), "private", "navmesh");
  try {
    return await readFile(path.join(dir, `${map}.bin.gz`));
  } catch {
    // Not on disk: try the private URL, if one is configured.
  }
  const base = process.env.NAVMESH_BASE_URL;
  if (!base) return null;
  const token = process.env.NAVMESH_TOKEN;
  const response = await fetch(`${base.replace(/\/$/, "")}/${map}.bin.gz`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function buildMesh(map: string, obstacles: ObstacleData | null): Promise<NavMesh | null> {
  const bytes = await readMeshBytes(map);
  if (bytes === null) return null;
  const raw = gunzipSync(bytes);
  const data = parseNavMesh(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const passages = obstacles
    ? findFenceGaps(obstacles.fences, [...obstacles.buildings, ...obstacles.water])
    : [];
  return buildNavMesh(data, passages);
}

/**
 * The map's mesh, or `null` when it has none or it could not be loaded. A good
 * mesh is kept for the life of the server; a missing or failed one is retried
 * after a minute, so a mesh store that comes back is picked up without a restart
 * and a broken one is not hit on every request.
 */
async function loadMesh(map: string, obstacles: ObstacleData | null): Promise<NavMesh | null> {
  if (!hasNavMesh(map)) return null;
  let entry = MESHES.get(map);
  const retryAt = entry?.retryAt ?? null;
  if (retryAt !== null && Date.now() >= retryAt) {
    MESHES.delete(map);
    entry = undefined;
  }
  if (entry === undefined) {
    const created: MeshEntry = {
      mesh: buildMesh(map, obstacles).catch((error: unknown) => {
        console.error(`[route-path] mesh load failed for ${map}:`, error);
        return null;
      }),
      retryAt: null,
    };
    void created.mesh.then((mesh) => {
      if (mesh === null) created.retryAt = Date.now() + FAILURE_MEMORY_MS;
    });
    MESHES.set(map, created);
    entry = created;
  }
  return entry.mesh;
}

// ─── grid ──────────────────────────────────────────────────────────────────

interface GridEntry {
  /** The data the grid was built from: a refetch makes a new object and so a new grid. */
  data: MapRouteData;
  grid: Grid | null;
}

const GRIDS = new Map<string, GridEntry>();

/**
 * The map's obstacle grid, built once from the SVG obstacles plus the server's
 * own minefields and exit positions. `null` when the map has no obstacle
 * layers or the grid would be over the size cap.
 */
function gridFor(map: string, obstacles: ObstacleData | null, data: MapRouteData): Grid | null {
  if (obstacles === null) return null;
  const cached = GRIDS.get(map);
  if (cached?.data === data) return cached.grid;
  let grid: Grid | null = null;
  try {
    grid = buildGrid(obstacles, data.minefields, data.anchors);
  } catch (error) {
    console.error(`[route-path] no grid for ${map}:`, error);
  }
  GRIDS.set(map, { data, grid });
  return grid;
}

// ─── routing ───────────────────────────────────────────────────────────────

/** What one request did, for the usage log. */
export interface RouteStats {
  /** The start was off the map, so nothing was routed. */
  refused: boolean;
  /** Targets answered by the mesh, and by the grid. */
  viaMesh: number;
  viaGrid: number;
  /** Cells in the grid the request used, 0 when it never needed one. */
  gridCells: number;
}

export interface RouteOutcome {
  routes: (PathResult | null)[];
  stats: RouteStats;
}

function mapBounds(obstacles: ObstacleData | null, data: MapRouteData): Bounds | null {
  const layers = obstacles
    ? [obstacles.buildings, obstacles.water, obstacles.fences, obstacles.limit]
    : [];
  const mines = data.minefields.map((polygon) => polygon.flatMap((p) => [p.x, p.z]));
  return boundsOf([...layers, mines], data.anchors);
}

/**
 * Routes from one start to many targets (a start's search is shared). Best
 * data first: the mesh, then the obstacle grid (built only for a target the
 * mesh cannot reach), then minefields only. With the mesh or the grid there is
 * no straight-line fallback: "no route" is `null`.
 *
 * A start off the map is not routed at all, and a target off the map has no
 * route. Exits count as part of the map, so ones at its edge are never cut off.
 */
export async function routeMany(
  map: string,
  from: Point,
  targets: readonly RouteTarget[],
): Promise<RouteOutcome> {
  const obstacles = await loadObstacles(map);
  const data = (await getMapRouteData(map)) ?? NO_MAP_DATA;
  const bounds = mapBounds(obstacles, data);
  const stats: RouteStats = { refused: false, viaMesh: 0, viaGrid: 0, gridCells: 0 };

  if (bounds !== null && !withinBounds(bounds, from, MAP_EDGE_MARGIN_M)) {
    stats.refused = true;
    return { routes: targets.map(() => null), stats };
  }

  const mesh = await loadMesh(map, obstacles);
  const nav = mesh !== null ? new NavRouter(mesh, from) : null;
  let gridRouter: GridRouter | null | undefined;
  const grid = (): GridRouter | null => {
    if (gridRouter === undefined) {
      const built = gridFor(map, obstacles, data);
      stats.gridCells = built ? built.w * built.h : 0;
      gridRouter = built ? new GridRouter(built, from) : null;
    }
    return gridRouter;
  };

  const routes = targets.map((to) => {
    if (bounds !== null && !withinBounds(bounds, to, MAP_EDGE_MARGIN_M)) return null;
    const viaNav = nav?.routeTo(to) ?? null;
    if (viaNav !== null) {
      stats.viaMesh += 1;
      return viaNav;
    }
    const router = grid();
    if (nav === null && router === null) return routeAround(from, to, data.minefields);
    const viaGrid = router?.routeTo(to) ?? null;
    if (viaGrid !== null) stats.viaGrid += 1;
    return viaGrid;
  });
  return { routes, stats };
}

/** For tests: forget every cached mesh and grid. */
export function resetRouteService(): void {
  MESHES.clear();
  GRIDS.clear();
}
