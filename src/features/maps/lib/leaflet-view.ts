import { toLatLngBounds } from "./leaflet-crs";

import type { LatLngBoundsExpression, Map as LeafletMapInstance } from "leaflet";

/**
 * Frames `bounds` so its left/right edges sit flush against the map
 * container's width ("fill-width"), cropping a little top/bottom when the
 * map is taller than the container's aspect rather than leaving letterbox
 * bars on the sides - ported from `old/TarkovTrackerWB-main`'s
 * `_leafletFillWidthView` (`leaflet.js`), the routine legacy used for both
 * the opening view and its Home button. React-leaflet's own default
 * (`MapContainer`'s `bounds` prop triggers a plain `fitBounds` - a
 * "contain" fit) leaves visible letterboxing on whichever axis is less
 * constrained, which is what made the map look too zoomed out by default.
 *
 * Uses only public Leaflet APIs (`project`/`getSize`/`setView`) - legacy
 * reached into `map._limitZoom`, a private method; clamping against
 * `getMinZoom`/`getMaxZoom` here is the public equivalent. Rotation-safe:
 * measures the bounding box of all four projected corners, so a rotated CRS
 * (Factory/Labyrinth use 90°/270°) still fills correctly. No-ops if the
 * container has no real size yet (e.g. mid-transition, or in a test
 * environment without a real layout engine).
 */
export function applyFillWidthView(map: LeafletMapInstance, bounds: LatLngBoundsExpression): void {
  const b = toLatLngBounds(bounds);
  const containerWidth = map.getSize().x;
  if (containerWidth <= 0) return;

  let referenceZoom = map.getZoom();
  if (!Number.isFinite(referenceZoom)) referenceZoom = map.getBoundsZoom(b, false);
  if (!Number.isFinite(referenceZoom)) referenceZoom = map.getMinZoom();
  if (!Number.isFinite(referenceZoom)) referenceZoom = 0;

  const corners = [b.getNorthWest(), b.getNorthEast(), b.getSouthWest(), b.getSouthEast()];
  const xs = corners.map((corner) => map.project(corner, referenceZoom).x);
  const widthAtReferenceZoom = Math.max(...xs) - Math.min(...xs);
  if (widthAtReferenceZoom <= 0 || !Number.isFinite(widthAtReferenceZoom)) {
    map.setView(b.getCenter(), referenceZoom, { animate: false });
    return;
  }

  const targetZoom = referenceZoom + Math.log2(containerWidth / widthAtReferenceZoom);
  const clampedZoom = Math.min(Math.max(targetZoom, map.getMinZoom()), map.getMaxZoom());

  // `setView` snaps its zoom argument to the map's configured `zoomSnap`
  // (default: whole integers), so without this the "fill" would round down
  // to the nearest full zoom level and leave a visible gap - up to ~41% of
  // the container's width at the worst case (a target zoom landing right on
  // a .5 boundary). Loosened to a near-continuous step for this one call,
  // then restored immediately - not 0, which Leaflet's own tile math treats
  // as "infinite zoom levels" and throws on for any active `TileLayer`
  // (confirmed via `old/TarkovTrackerWB-main`'s identical `zoomSnap:0.001`
  // workaround in `_leafletFillWidthView`).
  const savedZoomSnap = map.options.zoomSnap;
  map.options.zoomSnap = 0.001;
  map.setView(b.getCenter(), clampedZoom, { animate: false });
  map.options.zoomSnap = savedZoomSnap;
}
