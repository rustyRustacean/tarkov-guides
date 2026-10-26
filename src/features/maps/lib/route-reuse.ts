import type { PathResult, Point } from "./exit-path";

/** How far off the line a player may stand and still be "on" it, in metres. */
export const REUSE_TOLERANCE_M = 3;

/** Metres short of a straight line before a route is called a detour (matches the router). */
const DETOUR_FACTOR = 1.03;
const DETOUR_SLACK_M = 3;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

interface Nearest {
  /** Index of the segment's first point. */
  segment: number;
  /** The closest point on that segment. */
  point: Point;
  /** How far `from` is from it. */
  distance: number;
}

function nearestOnRoute(points: readonly Point[], from: Point): Nearest | null {
  let best: Nearest | null = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t =
      lengthSq === 0
        ? 0
        : Math.min(1, Math.max(0, ((from.x - a.x) * dx + (from.z - a.z) * dz) / lengthSq));
    const point = { x: a.x + dx * t, z: a.z + dz * t };
    const d = distance(from, point);
    if (best === null || d < best.distance) best = { segment: i, point, distance: d };
  }
  return best;
}

/**
 * The same route, seen from where the player has moved to: the part already
 * walked is dropped and the line starts at `from`. `null` when `from` is more
 * than `tolerance` metres off the line (the route must be worked out again).
 *
 * The remaining points are the original ones, so the line still bends
 * exactly where the real route does; only the first leg (at most `tolerance`
 * long) is new.
 */
export function trimRoute(
  route: PathResult,
  from: Point,
  tolerance: number = REUSE_TOLERANCE_M,
): PathResult | null {
  const nearest = nearestOnRoute(route.points, from);
  if (nearest === null || nearest.distance > tolerance) return null;

  const rest = route.points.slice(nearest.segment + 1);
  const points: Point[] = [{ x: from.x, z: from.z }];
  // Rejoin the line at the closest point, unless that is the next corner itself.
  const next = rest[0];
  if (next === undefined || distance(nearest.point, next) > 0.05) points.push(nearest.point);
  points.push(...rest);

  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p = points[i];
    const q = points[i + 1];
    if (p && q) length += distance(p, q);
  }
  const end = points[points.length - 1];
  const straight = end ? distance(from, end) : 0;
  return {
    points,
    length,
    detoured: route.detoured && length > straight * DETOUR_FACTOR + DETOUR_SLACK_M,
  };
}
