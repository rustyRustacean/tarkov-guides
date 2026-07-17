import L from "leaflet";

/**
 * The raw per-map geometry a custom CRS is built from - copied verbatim
 * from tarkov.dev's own `maps.json` data (via
 * `old/TarkovTrackerWB-main/src/lib/taskMarkers.js`'s `MAP_LEAFLET_CONFIG`).
 * `transform` feeds `L.Transformation` directly; `bounds` is Unity
 * world-space `[[x,z],[x,z]]`, not `[lat,lng]` - see {@link leafletBoundsFor}.
 */
export interface MapGeometryConfig {
  transform: readonly [number, number, number, number];
  /** Degrees. Defaults to 0 when absent (matches legacy's `cfg.coordinateRotation || 0`). */
  coordinateRotation?: number;
  bounds: readonly [readonly [number, number], readonly [number, number]];
}

/**
 * Rotates a lat/lng pair by `rotationDegrees` before Leaflet's standard
 * LonLat projection runs. Ported verbatim from `taskMarkers.js`'s
 * `_applyLeafletRotation` - real trigonometry, not a heuristic; every
 * marker/tile/stroke on a rotated map (Factory/Labyrinth use 270°) depends
 * on this exact formula to land in the right place.
 */
function applyLeafletRotation(latLng: L.LatLng, rotationDegrees: number): L.LatLng {
  const rad = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = latLng.lng;
  const y = latLng.lat;
  return L.latLng(x * sin + y * cos, x * cos - y * sin);
}

/**
 * Builds the custom Leaflet CRS a map's tile/image layer and every marker/
 * stroke on it must share to stay aligned - ported verbatim from
 * `taskMarkers.js`'s `_leafletCRSFor`. Constructs the object the same way
 * Leaflet's own docs recommend for a custom CRS: extending `L.CRS.Simple`
 * with a custom `transformation`/`projection` via `L.extend`.
 */
export function leafletCRSFor(cfg: MapGeometryConfig): L.CRS {
  const [tx, mx, ty, my] = cfg.transform;
  const rotation = cfg.coordinateRotation ?? 0;

  const projection = L.extend({}, L.Projection.LonLat, {
    project: (latLng: L.LatLng) =>
      L.Projection.LonLat.project(applyLeafletRotation(latLng, rotation)),
    unproject: (point: L.Point) =>
      applyLeafletRotation(L.Projection.LonLat.unproject(point), -rotation),
  });

  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(tx, mx, -ty, my),
    projection,
  });
}

/**
 * Converts a map's `[[x,z],[x,z]]` Unity-world-space bounds into Leaflet's
 * `[[lat,lng],[lat,lng]]` = `[[z,x],[z,x]]` convention - ported verbatim
 * from `taskMarkers.js`'s `_leafletBoundsFor`.
 */
export function leafletBoundsFor(cfg: MapGeometryConfig): L.LatLngBoundsExpression {
  const [[x1, z1], [x2, z2]] = cfg.bounds;
  return [
    [z1, x1],
    [z2, x2],
  ];
}

/** `LatLngBoundsExpression` is `LatLngBounds | LatLngBoundsLiteral` - neither of `L.latLngBounds`'s two overloads accepts that full union directly, so narrow first. */
function toLatLngBounds(bounds: L.LatLngBoundsExpression): L.LatLngBounds {
  return bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
}

/**
 * Converts an image-local fractional point (`{fx,fy}`, `0..1`) to a real
 * `LatLng` within `bounds` - the same bounds an `ImageOverlay`/`TileLayer`
 * for that variant is drawn against, so a stroke anchored this way stays
 * pinned to the image regardless of pan/zoom. `fx` runs west(0)->east(1);
 * `fy` runs north/top(0)->south/bottom(1), matching normal image pixel
 * convention (unlike `LatLng` itself, where north is the larger value).
 */
export function fractionalToLatLng(
  point: { fx: number; fy: number },
  bounds: L.LatLngBoundsExpression,
): L.LatLng {
  const b = toLatLngBounds(bounds);
  const lng = b.getWest() + point.fx * (b.getEast() - b.getWest());
  const lat = b.getNorth() - point.fy * (b.getNorth() - b.getSouth());
  return L.latLng(lat, lng);
}

/** Inverse of {@link fractionalToLatLng} - converts a real `LatLng` back to an image-local fractional point. */
export function latLngToFractional(
  latLng: L.LatLng,
  bounds: L.LatLngBoundsExpression,
): { fx: number; fy: number } {
  const b = toLatLngBounds(bounds);
  const fx = (latLng.lng - b.getWest()) / (b.getEast() - b.getWest());
  const fy = (b.getNorth() - latLng.lat) / (b.getNorth() - b.getSouth());
  return { fx, fy };
}
