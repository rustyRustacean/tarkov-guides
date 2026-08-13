import { toLatLngBounds } from "./leaflet-crs";

import type { LatLngBoundsExpression, Map as LeafletMapInstance } from "leaflet";

/**
 * Frames `bounds` so the entire map is visible within the container on
 * first load ("contain" fit): zooms out to whichever of width/height needs
 * more room, leaving letterbox margin on the other axis rather than
 * cropping any of the map off-screen. Structurally ported from
 * `old/TarkovTrackerWB-main`'s `_leafletFillWidthView` (`leaflet.js`), same
 * project/measure/`setView` shape and `zoomSnap` workaround, but that
 * routine deliberately fit *width only*, cropping top/bottom whenever a map
 * was taller (relative to its width) than the container's own aspect ratio.
 * Fine for wide landscape maps (most of them, where width already happens
 * to be the more-constraining axis), but it silently hid part of squarer or
 * portrait-leaning variants (e.g. some SVG "Satellite View"/"Overview" tabs)
 * below the fold on first load, worse than the mild letterboxing a full
 * contain-fit costs on those maps.
 *
 * Uses only public Leaflet APIs (`project`/`getSize`/`setView`); legacy
 * reached into `map._limitZoom`, a private method, and clamping against
 * `getMinZoom`/`getMaxZoom` here is the public equivalent. Rotation-safe:
 * measures the bounding box of all four projected corners, so a rotated CRS
 * (Factory/The Lab use 90°/270°) still fits correctly. No-ops if the
 * container has no real size yet (e.g. mid-transition, or in a test
 * environment without a real layout engine).
 */
export function applyContainFitView(map: LeafletMapInstance, bounds: LatLngBoundsExpression): void {
  const b = toLatLngBounds(bounds);
  const containerSize = map.getSize();
  const containerWidth = containerSize.x;
  const containerHeight = containerSize.y;
  if (containerWidth <= 0 || containerHeight <= 0) return;

  let referenceZoom = map.getZoom();
  if (!Number.isFinite(referenceZoom)) referenceZoom = map.getBoundsZoom(b, false);
  if (!Number.isFinite(referenceZoom)) referenceZoom = map.getMinZoom();
  if (!Number.isFinite(referenceZoom)) referenceZoom = 0;

  const corners = [b.getNorthWest(), b.getNorthEast(), b.getSouthWest(), b.getSouthEast()];
  const projected = corners.map((corner) => map.project(corner, referenceZoom));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const widthAtReferenceZoom = Math.max(...xs) - Math.min(...xs);
  const heightAtReferenceZoom = Math.max(...ys) - Math.min(...ys);
  if (
    widthAtReferenceZoom <= 0 ||
    heightAtReferenceZoom <= 0 ||
    !Number.isFinite(widthAtReferenceZoom) ||
    !Number.isFinite(heightAtReferenceZoom)
  ) {
    map.setView(b.getCenter(), referenceZoom, { animate: false });
    return;
  }

  // The smaller (more zoomed-out) of the two candidate zooms is the one
  // that keeps BOTH axes within the container. The larger one would fit
  // one axis exactly while letting the other overflow (crop) instead.
  const zoomForWidth = referenceZoom + Math.log2(containerWidth / widthAtReferenceZoom);
  const zoomForHeight = referenceZoom + Math.log2(containerHeight / heightAtReferenceZoom);
  const targetZoom = Math.min(zoomForWidth, zoomForHeight);
  const clampedZoom = Math.min(Math.max(targetZoom, map.getMinZoom()), map.getMaxZoom());

  // `setView` snaps its zoom argument to the map's configured `zoomSnap`
  // (default: whole integers), so without this the fit would round down to
  // the nearest full zoom level and leave a visible gap, up to ~41% of the
  // constraining axis at the worst case (a target zoom landing right on a .5
  // boundary). Loosened to a near-continuous step for this one call, then
  // restored immediately. Not 0, which Leaflet's own tile math treats as
  // "infinite zoom levels" and throws on for any active `TileLayer` (matches
  // `old/TarkovTrackerWB-main`'s identical `zoomSnap:0.001` workaround in
  // `_leafletFillWidthView`).
  const savedZoomSnap = map.options.zoomSnap;
  map.options.zoomSnap = 0.001;
  map.setView(b.getCenter(), clampedZoom, { animate: false });
  map.options.zoomSnap = savedZoomSnap;
}
