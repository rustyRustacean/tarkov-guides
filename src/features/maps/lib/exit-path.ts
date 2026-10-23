import type { AppliedExit } from "./exit-snip";

/**
 * Path from the player's last known position to an exit.
 *
 * WHAT THIS KNOWS: the polygons of minefields (from the map data) and the
 * straight-line geometry between points. WHAT IT DOES NOT KNOW: walls,
 * fences, buildings, water, floors or out-of-bounds ground. That is why
 * `routeAround` is only the server's last fallback, and why the exit path is
 * not offered at all on a map with no walking data (`walkingRouteAvailable`)
 * rather than drawing a line that looks authoritative. Everything here is
 * plain x/z in game meters.
 */

export interface Point {
  x: number;
  z: number;
}

export interface PathResult {
  /** Start, any detour corners, then the end. At least two points. */
  points: readonly Point[];
  /** Total length in meters. */
  length: number;
  /** True when the line had to bend around at least one minefield. */
  detoured: boolean;
}

/** How far outside a minefield's edge the detour keeps, in meters. */
const DETOUR_MARGIN = 2.5;
const EPSILON = 1e-9;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function centroid(polygon: readonly Point[]): Point {
  let x = 0;
  let z = 0;
  for (const point of polygon) {
    x += point.x;
    z += point.z;
  }
  return { x: x / polygon.length, z: z / polygon.length };
}

/** Ray casting. Points exactly on an edge may land either side; callers add margin. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const crosses =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

/** Proper crossing only: touching at an endpoint or running along an edge is not a crossing. */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < -EPSILON && o3 * o4 < -EPSILON;
}

function segmentBlocked(a: Point, b: Point, polygons: readonly (readonly Point[])[]): boolean {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  for (const polygon of polygons) {
    if (pointInPolygon(mid, polygon)) return true;
    for (let i = 0; i < polygon.length; i += 1) {
      const c = polygon[i];
      const d = polygon[(i + 1) % polygon.length];
      if (c && d && segmentsCross(a, b, c, d)) return true;
    }
  }
  return false;
}

/** The polygon pushed outward from its centre by `margin` meters (fine for the convex quads the data uses). */
function inflate(polygon: readonly Point[], margin: number): Point[] {
  const centre = centroid(polygon);
  return polygon.map((point) => {
    const length = distance(point, centre);
    if (length < EPSILON) return point;
    const scale = (length + margin) / length;
    return {
      x: centre.x + (point.x - centre.x) * scale,
      z: centre.z + (point.z - centre.z) * scale,
    };
  });
}

/**
 * Shortest path from `start` to `end` that does not cross any of `obstacles`.
 *
 * A visibility graph over the obstacle corners (pushed outward by a margin),
 * searched with Dijkstra. An obstacle that already contains `start` or `end`
 * is ignored: if you are standing in a minefield, or the exit is inside one,
 * routing "around" it is meaningless, and refusing to draw would be worse.
 */
export function routeAround(
  start: Point,
  end: Point,
  obstacles: readonly (readonly Point[])[],
): PathResult {
  const active = obstacles.filter(
    (polygon) =>
      polygon.length >= 3 && !pointInPolygon(start, polygon) && !pointInPolygon(end, polygon),
  );

  const direct: PathResult = {
    points: [start, end],
    length: distance(start, end),
    detoured: false,
  };
  if (active.length === 0 || !segmentBlocked(start, end, active)) return direct;

  // Waypoints: inflated corners that are not themselves inside some obstacle.
  const corners: Point[] = [];
  for (const polygon of active) {
    for (const corner of inflate(polygon, DETOUR_MARGIN)) {
      if (!active.some((other) => pointInPolygon(corner, other))) corners.push(corner);
    }
  }

  const nodes: Point[] = [start, ...corners, end];
  const last = nodes.length - 1;
  const best = new Array<number>(nodes.length).fill(Infinity);
  const previous = new Array<number>(nodes.length).fill(-1);
  const done = new Array<boolean>(nodes.length).fill(false);
  best[0] = 0;

  // One node is settled per pass, so at most `nodes.length` passes.
  for (let remaining = nodes.length; remaining > 0; remaining -= 1) {
    let current = -1;
    for (let i = 0; i < nodes.length; i += 1) {
      if (!done[i] && (current === -1 || (best[i] ?? Infinity) < (best[current] ?? Infinity))) {
        current = i;
      }
    }
    if (current === -1 || (best[current] ?? Infinity) === Infinity) break;
    done[current] = true;
    if (current === last) break;
    const from = nodes[current];
    if (!from) continue;
    for (let next = 0; next < nodes.length; next += 1) {
      if (done[next]) continue;
      const to = nodes[next];
      if (!to) continue;
      const candidate = (best[current] ?? Infinity) + distance(from, to);
      if (candidate >= (best[next] ?? Infinity)) continue;
      if (segmentBlocked(from, to, active)) continue;
      best[next] = candidate;
      previous[next] = current;
    }
  }

  if ((best[last] ?? Infinity) === Infinity) return { ...direct, detoured: false };

  const points: Point[] = [];
  for (let at = last; at !== -1; at = previous[at] ?? -1) {
    const node = nodes[at];
    if (node) points.unshift(node);
  }
  return { points, length: best[last] ?? direct.length, detoured: true };
}

/** A stable key for an exit, used for selection. */
export function exitKey(exit: Pick<AppliedExit, "kind" | "id">): string {
  return `${exit.kind}:${exit.id}`;
}

export interface ExitTarget {
  exit: AppliedExit;
  /** The path, or `null` when no walkable route to this exit exists on the map's obstacle grid. */
  route: PathResult | null;
  /** Why this exit was chosen. */
  reason: "selected" | "closest";
}

/**
 * Which exit to route to.
 *
 * A selected exit always wins (even a `???` one or a transit: the player
 * asked for it). Otherwise the closest AVAILABLE extract by route length:
 * `???` exits are skipped because their availability is unknown, and
 * transits are skipped because they leave the map rather than exit the raid.
 */
/** A destination; `y` lets a router pick the right floor where floors stack. */
export type RouteTarget = Point & { y?: number | null | undefined };

export type Router = (to: RouteTarget) => PathResult | null;

/** A router that bends around the given polygons only (minefields); see {@link routeAround}. */
export function polygonRouter(from: Point, obstacles: readonly (readonly Point[])[]): Router {
  return (to) => routeAround(from, to, obstacles);
}

/**
 *
 */
export function chooseTarget(
  exits: readonly AppliedExit[],
  selectedKey: string | null,
  route: Router,
): ExitTarget | null {
  const located = exits.filter(
    (exit): exit is AppliedExit & { position: { x: number; y: number; z: number } } =>
      exit.position !== null,
  );

  if (selectedKey !== null) {
    const chosen = located.find((exit) => exitKey(exit) === selectedKey);
    if (chosen) {
      return {
        exit: chosen,
        route: route(chosen.position),
        reason: "selected",
      };
    }
  }

  let best: ExitTarget | null = null;
  for (const exit of located) {
    if (exit.kind !== "exfil" || exit.unknown) continue;
    const candidate = route(exit.position);
    // An exit that cannot be walked to is never "the closest".
    if (candidate === null) continue;
    if (best?.route == null || candidate.length < best.route.length) {
      best = { exit, route: candidate, reason: "closest" };
    }
  }
  return best;
}
