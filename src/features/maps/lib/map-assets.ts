/**
 * URL-building helpers for the bundled map images. Ported concept from
 * `old/TarkovTrackerWB-main/src/lib/mapsConfig.js`'s `MAP_PATH`/
 * `getVariantFile`. Map imagery (38 files, 12 SVG + 26 WebP) is mirrored
 * under `public/maps/{svg,webp}/` - see `public/maps/SOURCES.md` for
 * exactly where each file came from, its licensing, and the JPG->WebP
 * transcode. `MapViewer`'s `ImageOverlay` still handles a missing/failed-to-
 * load image gracefully (a fallback state, not a crash), since custom
 * user-uploaded variants resolve through a different path (IndexedDB, not
 * this helper) and can still fail independently of the bundled set here.
 *
 * Routed through `assetPath()` so these resolve to a CDN URL once
 * `NEXT_PUBLIC_ASSET_CDN_URL` is set (see that function's doc comment) -
 * today it's unset, so every path below is identical to the local
 * `public/` URL it always was.
 */

import { assetPath } from "@/shared/lib/asset-cdn";

const SVG_DIR = "/maps/svg";
const WEBP_DIR = "/maps/webp";

/** Builds the URL for an interactive/overview SVG variant, e.g. `svgAssetPath("Reserve.svg")` → `/maps/svg/Reserve.svg`. */
export function svgAssetPath(fileName: string): string {
  return assetPath(`${SVG_DIR}/${fileName}`);
}

/** Builds the URL for a 2D/3D raster variant, e.g. `webpAssetPath("reserve-2d.webp")` → `/maps/webp/reserve-2d.webp`. */
export function webpAssetPath(fileName: string): string {
  return assetPath(`${WEBP_DIR}/${fileName}`);
}
