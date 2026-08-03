/**
 * Pure URL-building helpers for locally-hosted map images. Ported concept
 * from `old/TarkovTrackerWB-main/src/lib/mapsConfig.js`'s `MAP_PATH`/
 * `getVariantFile`. Map imagery (39 files, ~64MB - 11 SVG + 28 JPG) is
 * bundled under `public/maps/{svg,jpg}/` - see `public/maps/SOURCES.md` for
 * exactly where each file came from and its licensing. `MapViewer`'s
 * `ImageOverlay` still handles a missing/failed-to-load image gracefully
 * (a fallback state, not a crash), since custom user-uploaded variants
 * resolve through a different path (IndexedDB, not this helper) and can
 * still fail independently of the bundled set here.
 */

const SVG_DIR = "/maps/svg";
const JPG_DIR = "/maps/jpg";

/** Builds the local URL for an interactive/overview SVG variant, e.g. `svgAssetPath("Reserve.svg")` → `/maps/svg/Reserve.svg`. */
export function svgAssetPath(fileName: string): string {
  return `${SVG_DIR}/${fileName}`;
}

/** Builds the local URL for a 2D/3D raster variant, e.g. `jpgAssetPath("reserve-2d.jpg")` → `/maps/jpg/reserve-2d.jpg`. */
export function jpgAssetPath(fileName: string): string {
  return `${JPG_DIR}/${fileName}`;
}
