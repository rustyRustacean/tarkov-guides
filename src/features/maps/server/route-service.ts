import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { routeAround, type PathResult, type Point, type RouteTarget } from "../lib/exit-path";
import { buildGrid, GridRouter, type Grid } from "../lib/grid-route";
import { hasNavMesh } from "../lib/map-navmesh";
import { loadObstacles } from "../lib/map-obstacles";
import { parseNavMesh } from "../lib/navmesh-format";
import { buildNavMesh, NavRouter, type NavMesh } from "../lib/navmesh-route";
import { findFenceGaps } from "../lib/passages";

/**
 * Server-side walking routes. The game's walkable mesh lives only here: it is
 * read from disk (`NAVMESH_DIR`, default `private/navmesh`) or fetched from a
 * private location (`NAVMESH_BASE_URL`, optional `NAVMESH_TOKEN`), and never
 * sent to a browser. Callers get back only the route they asked for.
 */

interface Prepared {
  mesh: NavMesh | null;
  grid: Grid | null;
}

/** One prepared map per server instance: building a mesh costs far more than a route. */
const PREPARED = new Map<string, Promise<Prepared>>();

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
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function prepare(
  map: string,
  minefields: readonly (readonly Point[])[],
  anchors: readonly Point[],
): Promise<Prepared> {
  const obstacles = await loadObstacles(map);
  const grid = obstacles ? buildGrid(obstacles, minefields, anchors) : null;

  let mesh: NavMesh | null = null;
  if (hasNavMesh(map)) {
    const bytes = await readMeshBytes(map);
    if (bytes !== null) {
      const raw = gunzipSync(bytes);
      const data = parseNavMesh(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
      const passages = obstacles
        ? findFenceGaps(obstacles.fences, [...obstacles.buildings, ...obstacles.water])
        : [];
      mesh = buildNavMesh(data, passages);
    }
  }
  return { mesh, grid };
}

/**
 * Routes from one start to many targets (a start's search is shared). Best
 * data first: the mesh, then the obstacle grid, then minefields only. With the
 * mesh or the grid there is no straight-line fallback: "no route" is `null`.
 */
export async function routeMany(
  map: string,
  from: Point,
  targets: readonly RouteTarget[],
  minefields: readonly (readonly Point[])[],
  anchors: readonly Point[],
): Promise<(PathResult | null)[]> {
  let prepared = PREPARED.get(map);
  if (prepared === undefined) {
    prepared = prepare(map, minefields, anchors);
    PREPARED.set(map, prepared);
    // A failed build must not stick: the next request tries again.
    prepared.catch(() => {
      PREPARED.delete(map);
    });
  }
  const { mesh, grid } = await prepared;
  const nav = mesh !== null ? new NavRouter(mesh, from) : null;
  const gridRouter = grid !== null ? new GridRouter(grid, from) : null;
  return targets.map((to) => {
    if (nav === null && gridRouter === null) return routeAround(from, to, minefields);
    return nav?.routeTo(to) ?? gridRouter?.routeTo(to) ?? null;
  });
}
