/**
 * Maps that have a walkable-area mesh (the game's own navigation mesh), as
 * `private/navmesh/<map>.bin.gz` (outside `public/`, never served), written by
 * `scripts/navmesh/extract-navmesh.py`. Only the server reads them
 * (`server/route-service.ts`); a browser only ever gets finished routes.
 *
 * A map not listed falls back to the SVG obstacle grid (`map-obstacles.ts`),
 * then to minefields only. Factory, Labs and Terminal have no confidently
 * identified mesh yet.
 */
const HAS_NAVMESH: ReadonlySet<string> = new Set([
  "customs",
  "ground-zero",
  "interchange",
  "lighthouse",
  "reserve",
  "shoreline",
  "streets-of-tarkov",
  "woods",
]);

/** Whether this map tab has a walkable-area mesh. */
export function hasNavMesh(normalizedName: string): boolean {
  return HAS_NAVMESH.has(normalizedName);
}
