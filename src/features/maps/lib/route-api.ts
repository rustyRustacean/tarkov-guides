import type { PathResult, Point, RouteTarget } from "./exit-path";

export interface RouteRequest {
  map: string;
  from: Point;
  to: readonly RouteTarget[];
  /** Minefield outlines of the map (kept clear of when no mesh covers the spot). */
  minefields?: readonly (readonly Point[])[];
  /** Every exit position of the map, so the server sizes its grid to include them. */
  anchors?: readonly Point[];
}

/**
 * Asks the server for walking routes from one start to several targets, one
 * result per target (`null` = no walkable route). The walkable data is private
 * to the server; only the routes come back.
 */
export async function fetchRoutes(
  request: RouteRequest,
  signal?: AbortSignal,
): Promise<(PathResult | null)[]> {
  const response = await fetch("/api/route-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`route request failed (${String(response.status)})`);
  const data = (await response.json()) as { routes?: (PathResult | null)[] };
  return data.routes ?? [];
}
