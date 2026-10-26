import { hasNavMesh } from "./map-navmesh";

/**
 * Maps where the exit controls are not offered at all. Terminal's obstacle
 * layers are too thin to place exits against, and Icebreaker has no exit
 * data to show.
 */
const NO_EXIT_CONTROLS: ReadonlySet<string> = new Set(["terminal", "icebreaker"]);

/** Whether the exit controls (exit list status, Show all exits) are offered on this map tab. */
export function exitPathAvailable(normalizedName: string): boolean {
  return !NO_EXIT_CONTROLS.has(normalizedName);
}

/**
 * Whether a walking route (Go to Exit, the ruler, `POST /api/route-path`) is
 * offered on this map tab: only where there is a walkable mesh
 * (`map-navmesh.ts`). Every one of those maps also has SVG obstacle layers,
 * so a server without the mesh files still routes around buildings on the
 * grid (the test checks this stays true).
 *
 * Anywhere else the only fallback is the minefield-only route, a straight
 * line through walls, and a confident distance and time for that is worse
 * than none. Factory, Labs and The Labyrinth have no walking data at all.
 */
export function walkingRouteAvailable(normalizedName: string): boolean {
  return exitPathAvailable(normalizedName) && hasNavMesh(normalizedName);
}
